import { Injectable, Inject } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import {
  DocumentErrorCodes,
  ErrorMessages,
} from '@devbrain/db';
import type { DocumentJobPayload, ObjectStorage } from '@devbrain/db';
import { OBJECT_STORAGE } from './worker.module';

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
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async process(payload: DocumentJobPayload): Promise<void> {
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

    await prisma.document.update({
      where: { id: payload.documentId },
      data: {
        status: 'ready',
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  private async failDocument(
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