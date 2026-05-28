import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanDatabase(client?: PrismaClient): Promise<void> {
  const p = client || prisma;
  await p.$transaction([
    p.$executeRawUnsafe(`DELETE FROM "MessageCitation"`),
    p.$executeRawUnsafe(`DELETE FROM "Message"`),
    p.$executeRawUnsafe(`DELETE FROM "Conversation"`),
    p.$executeRawUnsafe(`DELETE FROM "Chunk"`),
    p.$executeRawUnsafe(`DELETE FROM "Document"`),
    p.$executeRawUnsafe(`DELETE FROM "KnowledgeBase"`),
    p.$executeRawUnsafe(`DELETE FROM "Membership"`),
    p.$executeRawUnsafe(`DELETE FROM "ComparisonVote"`),
    p.$executeRawUnsafe(`DELETE FROM "ComparisonResult"`),
    p.$executeRawUnsafe(`DELETE FROM "ComparisonRun"`),
    p.$executeRawUnsafe(`DELETE FROM "RefreshToken"`),
    p.$executeRawUnsafe(`DELETE FROM "RefreshTokenFamily"`),
    p.$executeRawUnsafe(`DELETE FROM "Space"`),
    p.$executeRawUnsafe(`DELETE FROM "User"`),
  ]);
}
