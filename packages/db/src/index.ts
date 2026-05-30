import { PrismaClient } from '@prisma/client';

export type { $Enums } from '@prisma/client';
export type {
  User,
  Document,
  Chunk,
  KnowledgeBase,
  Space,
  Membership,
  Conversation,
  Message,
  MessageCitation,
  RefreshTokenFamily,
  RefreshToken,
} from '@prisma/client';
export type { Prisma } from '@prisma/client';
export { PrismaClient };

export type { ObjectStorage } from './storage';
export {
  DocumentErrorCodes,
  ErrorMessages,
} from './error-codes';
export type { DocumentErrorCode } from './error-codes';
export {
  DOCUMENT_PROCESSING_QUEUE,
  DOCUMENT_PROCESSING_JOB,
  isDocumentJobPayload,
} from './queue-constants';
export type { DocumentJobPayload } from './queue-constants';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return prisma;
}

export default getPrismaClient;
