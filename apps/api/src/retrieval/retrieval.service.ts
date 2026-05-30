import { Injectable, Inject, Logger } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type { KnowledgeBase } from '@devbrain/db';
import type { EmbeddingProvider } from '../providers/embedding/embedding-provider.interface';
import type { RerankProvider } from '../providers/rerank/rerank-provider.interface';
import { ProviderError, ProviderErrorCodes } from '../providers/embedding/embedding-provider.interface';
import { EMBEDDING_PROVIDER, RERANK_PROVIDER, RETRIEVAL_LOW_RELEVANCE_THRESHOLD } from '../providers/providers.module';
import { PostgresVectorStore } from './postgres-vector-store';
import { computeRRF } from './rrf';
import type { FtsCandidate, VectorCandidate } from './vector-store.interface';
import type { RetrievalChunk, RetrievalResult } from './retrieval.types';

const prisma = getPrismaClient();

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(RERANK_PROVIDER) private readonly rerankProvider: RerankProvider,
    @Inject(RETRIEVAL_LOW_RELEVANCE_THRESHOLD) private readonly lowRelevanceThreshold: number,
    private readonly vectorStore: PostgresVectorStore,
  ) {}

  async retrieve(userId: string, kbId: string, query: string): Promise<RetrievalResult> {
    await this.getAccessibleKbOrThrow(userId, kbId);

    const hasReadyChunks = await this.kbHasReadyChunks(kbId);
    if (!hasReadyChunks) {
      this.logger.log(`KB ${kbId} 没有 ready chunks，返回拒答信号`);
      return { status: 'rejected', reason: 'no_ready_chunks' };
    }

    let queryEmbedding: number[];
    let embeddingFailed = false;

    try {
      const results = await this.embeddingProvider.embedDocuments([query]);
      queryEmbedding = results[0].vector;
    } catch (err) {
      if (err instanceof ProviderError && err.errorCode === ProviderErrorCodes.DIMENSION_MISMATCH) {
        this.logger.warn(
          `query embedding 维度不匹配，跳过 vector recall | provider: ${this.embeddingProvider.providerName}`,
        );
        embeddingFailed = true;
      } else {
        throw err;
      }
    }

    const [ftsCandidates, vectorCandidates] = await Promise.all([
      this.vectorStore.ftsRecall(kbId, query, 20),
      embeddingFailed
        ? Promise.resolve([] as VectorCandidate[])
        : this.vectorStore.vectorRecall(kbId, queryEmbedding!, 20).catch((err) => {
            if (
              err instanceof ProviderError &&
              err.errorCode === ProviderErrorCodes.DIMENSION_MISMATCH
            ) {
              this.logger.warn(
                `vector recall 维度不匹配，仅使用 FTS 结果 | provider: ${this.embeddingProvider.providerName}`,
              );
              return [] as VectorCandidate[];
            }
            throw err;
          }),
    ]);

    this.logger.log(
      `recall 完成 | FTS: ${ftsCandidates.length} 候选 | vector: ${vectorCandidates.length} 候选`,
    );

    if (ftsCandidates.length === 0 && vectorCandidates.length === 0) {
      return { status: 'rejected', reason: 'no_recall_hits' };
    }

    const rrfResults = computeRRF(
      ftsCandidates.map((c) => ({ chunkId: c.chunkId, rank: c.ftsRank })),
      vectorCandidates.map((c) => ({ chunkId: c.chunkId, rank: c.vectorRank })),
    );

    const chunkMap = new Map<string, FtsCandidate | VectorCandidate>();
    for (const c of ftsCandidates) chunkMap.set(c.chunkId, c);
    for (const c of vectorCandidates) {
      if (!chunkMap.has(c.chunkId)) chunkMap.set(c.chunkId, c);
    }

    const rrfChunks = rrfResults
      .map((rrf) => {
        const raw = chunkMap.get(rrf.chunkId);
        if (!raw) return null;
        return {
          chunkId: rrf.chunkId,
          documentId: raw.documentId,
          kbId: raw.kbId,
          sourceType: raw.sourceType,
          content: raw.content,
          headingPath: raw.headingPath,
          anchor: raw.anchor ?? null,
          page: raw.page ?? null,
          bbox: (raw.bbox as Record<string, unknown>) ?? null,
          ftsRank: rrf.ftsRank,
          ftsScore: ('ftsRank' in raw ? (raw as FtsCandidate).ftsScore : undefined),
          vectorRank: rrf.vectorRank,
          vectorDistance: ('vectorRank' in raw ? (raw as VectorCandidate).vectorDistance : undefined),
          rrfScore: rrf.rrfScore,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (rrfChunks.length === 0) {
      return { status: 'rejected', reason: 'no_recall_hits' };
    }

    const rerankDocs = rrfChunks.slice(0, 30).map((c) => ({
      chunkId: c.chunkId,
      content: c.content,
    }));

    let rerankedChunks: RetrievalChunk[];
    try {
      const rerankResults = await this.rerankProvider.rerank(query, rerankDocs, 5);

      const candidateMap = new Map(rrfChunks.map((c) => [c.chunkId, c]));

      rerankedChunks = rerankResults
        .map((r) => {
          const chunk = candidateMap.get(r.chunkId);
          if (!chunk) return null;
          return { ...chunk, rerankScore: r.score };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      const hasComparableScores = rerankResults.some(
        (r) => r.score >= 0 && r.score <= 1,
      );

      if (
        hasComparableScores &&
        rerankedChunks.length > 0 &&
        rerankedChunks.every(
          (c) => (c.rerankScore ?? 0) < this.lowRelevanceThreshold,
        )
      ) {
        return { status: 'rejected', reason: 'low_relevance' };
      }
    } catch (err) {
      if (err instanceof ProviderError) {
        this.logger.error(
          `rerank provider error | provider: ${this.rerankProvider.providerName} | errorCode: ${err.errorCode} | message: ${err.message}`,
        );
        throw err;
      }
      this.logger.error(
        `rerank 失败 | provider: ${this.rerankProvider.providerName} | error: ${(err as Error).message}`,
      );
      throw new ProviderError(
        ProviderErrorCodes.FAILED,
        `Rerank 服务调用失败: ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `retrieval 完成 | finalChunks: ${rerankedChunks.length} | chunks: ${rerankedChunks.map((c) => c.chunkId).join(',')}`,
    );

    return { status: 'success', chunks: rerankedChunks };
  }

  private async getAccessibleKbOrThrow(userId: string, kbId: string): Promise<KnowledgeBase> {
    const kb = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        space: {
          type: 'personal',
          createdById: userId,
        },
        archivedAt: null,
      },
    });

    if (!kb) {
      throw new Error('not_found');
    }

    return kb;
  }

  private async kbHasReadyChunks(kbId: string): Promise<boolean> {
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE c."kbId" = $1
          AND d.status = 'ready'
          AND d."deletedAt" IS NULL
        LIMIT 1
      ) AS "exists"`,
      kbId,
    );
    return result[0]?.exists ?? false;
  }
}