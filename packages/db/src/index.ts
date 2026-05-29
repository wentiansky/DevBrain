import { PrismaClient } from '@prisma/client';

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
