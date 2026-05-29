import { Injectable, Inject } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import {
  DocumentErrorCodes,
  ErrorMessages,
} from '@devbrain/db';
import type { DocumentJobPayload, ObjectStorage } from '@devbrain/db';
import { OBJECT_STORAGE } from './constants';
import {
  parseMarkdown,
  splitBlocks,
  computeContentHash,
  CONTENT_HASH_VERSION,
  generateAnchor,
  ChunkRepository,
  EmbeddingProviderError,
} from './ingestion';
import type { EmbeddingProvider } from './ingestion';
import { EMBEDDING_PROVIDER } from './constants';

const prisma = getPrismaClient();

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function validateMarkdownBuffer(buffer: Buffer): string | null {
  if (buffer.length === 0) {
    return DocumentErrorCodes.MARKDOWN_EMPTY;
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return DocumentErrorCodes.MARKDOWN_TOO_LARGE;
  }

  const text = buffer.toString('utf-8');

  const reserialized = Buffer.from(text, 'utf-8');
  if (!buffer.equals(reserialized)) {
    return DocumentErrorCodes.MARKDOWN_INVALID_ENCODING;
  }

  const sampleSize = Math.min(buffer.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    if (byte === 0) return DocumentErrorCodes.MARKDOWN_BINARY_CONTENT;
    if (byte < 0x09) return DocumentErrorCodes.MARKDOWN_BINARY_CONTENT;
    if (byte >= 0x0e && byte <= 0x1f && byte !== 0x1b)
      return DocumentErrorCodes.MARKDOWN_BINARY_CONTENT;
    if (byte === 0x7f) return DocumentErrorCodes.MARKDOWN_BINARY_CONTENT;
  }

  return null;
}

@Injectable()
export class DocumentProcessorService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    private readonly chunkRepository: ChunkRepository,
  ) {}

  async process(payload: DocumentJobPayload): Promise<void> {
    const doc = await prisma.document.findUnique({
      where: { id: payload.documentId },
    });

    if (!doc || doc.deletedAt) return;

    if (doc.sourceType !== 'markdown') {
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.getObjectBuffer(payload.objectKey);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.failDocument(
          payload.documentId,
          DocumentErrorCodes.STORAGE_OBJECT_NOT_FOUND,
        );
      } else {
        await this.failDocument(
          payload.documentId,
          DocumentErrorCodes.STORAGE_READ_FAILED,
        );
      }
      return;
    }

    const validationError = validateMarkdownBuffer(buffer);
    if (validationError) {
      await this.failDocument(payload.documentId, validationError);
      return;
    }

    const markdown = buffer.toString('utf-8');

    const blocks = parseMarkdown(markdown);
    if (blocks.length === 0) {
      await this.failDocument(
        payload.documentId,
        DocumentErrorCodes.INGESTION_PARSE_FAILED,
      );
      return;
    }

    const chunkCandidates = splitBlocks(blocks);
    if (chunkCandidates.length === 0) {
      await this.failDocument(
        payload.documentId,
        DocumentErrorCodes.INGESTION_EMPTY_CHUNKS,
      );
      return;
    }

    let embeddingResults;
    try {
      embeddingResults = await this.embeddingProvider.embedDocuments(
        chunkCandidates.map((c) => c.content),
      );
    } catch (err) {
      const errorCode = this.mapEmbeddingError(err);
      await this.failDocument(payload.documentId, errorCode);
      return;
    }

    const embedMap = new Map<number, number[]>();
    for (const r of embeddingResults) {
      embedMap.set(r.index, r.vector);
    }

    let chunkInputs;
    try {
      chunkInputs = chunkCandidates.map((candidate, i) => {
        const hash = computeContentHash(candidate.content, candidate.headingPath);
        const anchor = generateAnchor(
          candidate.headingPath,
          candidate.ordinal,
          hash,
        );

        const embedding = embedMap.get(i);
        if (!embedding) {
          throw new Error(`embedding 缺失: chunk ${i}`);
        }
        if (embedding.length !== this.embeddingProvider.dimension) {
          throw new Error(
            `embedding 维度不匹配: chunk ${i}, 实际 ${embedding.length}, 预期 ${this.embeddingProvider.dimension}`,
          );
        }

        return {
          documentId: payload.documentId,
          kbId: payload.kbId,
          sourceType: 'markdown',
          content: candidate.content,
          contentHash: hash,
          headingPath: candidate.headingPath,
          anchor,
          tokenCount: candidate.tokenCount,
          embedding,
          metadata: {
            rawText: candidate.rawText,
            startLine: candidate.startLine ?? null,
            endLine: candidate.endLine ?? null,
            blockTypes: candidate.blockTypes,
            ordinal: candidate.ordinal,
            contentHashVersion: CONTENT_HASH_VERSION,
            splitterConfig: {
              targetTokens: 500,
              overlapTokens: 50,
            },
          },
        };
      });

      await prisma.$transaction(async (tx) => {
        await this.chunkRepository.replaceDocumentChunks(
          payload.documentId,
          chunkInputs,
          tx,
        );

        await tx.document.update({
          where: { id: payload.documentId },
          data: {
            status: 'ready',
            errorCode: null,
            errorMessage: null,
          },
        });
      });
    } catch (err) {
      const message = (err as Error).message || '';
      if (message.includes('维度不匹配')) {
        await this.failDocument(
          payload.documentId,
          DocumentErrorCodes.EMBEDDING_DIMENSION_MISMATCH,
        );
      } else if (message.includes('缺失')) {
        await this.failDocument(
          payload.documentId,
          DocumentErrorCodes.EMBEDDING_SCHEMA_MISMATCH,
        );
      } else {
        console.error(`Chunk 写入失败: ${message}`);
        await this.failDocument(
          payload.documentId,
          DocumentErrorCodes.INGESTION_CHUNK_WRITE_FAILED,
        );
      }
    }
  }

  private mapEmbeddingError(err: unknown): string {
    if (err instanceof EmbeddingProviderError) {
      const mapping: Record<string, string> = {
        'embedding.auth_failed': DocumentErrorCodes.EMBEDDING_AUTH_FAILED,
        'embedding.rate_limited': DocumentErrorCodes.EMBEDDING_RATE_LIMITED,
        'embedding.timeout': DocumentErrorCodes.EMBEDDING_TIMEOUT,
        'embedding.network_error': DocumentErrorCodes.EMBEDDING_NETWORK_ERROR,
        'embedding.schema_mismatch': DocumentErrorCodes.EMBEDDING_SCHEMA_MISMATCH,
        'embedding.dimension_mismatch': DocumentErrorCodes.EMBEDDING_DIMENSION_MISMATCH,
        'embedding.failed': DocumentErrorCodes.EMBEDDING_FAILED,
      };
      return mapping[err.errorCode] || DocumentErrorCodes.EMBEDDING_FAILED;
    }
    return DocumentErrorCodes.EMBEDDING_FAILED;
  }

  async failDocument(
    documentId: string,
    errorCode: string,
  ): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        errorCode,
        errorMessage: ErrorMessages[errorCode as keyof typeof ErrorMessages] ?? errorCode,
      },
    });
  }
}