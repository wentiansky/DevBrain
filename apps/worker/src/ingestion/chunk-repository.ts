import { Injectable } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type { Chunk, Prisma } from '@devbrain/db';

const prisma = getPrismaClient();

export interface ChunkInput {
  documentId: string;
  kbId: string;
  sourceType: string;
  content: string;
  contentHash: string;
  headingPath: string[];
  anchor: string;
  tokenCount: number;
  embedding: number[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class ChunkRepository {
async replaceDocumentChunks(
    documentId: string,
    chunks: ChunkInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<Chunk[]> {
    const client = tx ?? prisma;

    const runReplace = async (
      executor: Prisma.TransactionClient | typeof prisma,
    ) => {
      await executor.$executeRawUnsafe(
        `DELETE FROM "Chunk" WHERE "documentId" = $1`,
        documentId,
      );

      if (chunks.length === 0) return [];

      const vectorCast = `::vector(1024)`;

      const rows = await executor.$queryRawUnsafe<
        Array<Record<string, unknown>>
      >(
        `INSERT INTO "Chunk" (
          id, "documentId", "kbId", "sourceType", content,
          "contentHash", "headingPath", anchor, "tokenCount",
          embedding, metadata, "createdAt"
        )
        VALUES ${chunks
          .map(
            (_, i) =>
              `(gen_random_uuid()::text,
                $${i * 11 + 1}::text,
                $${i * 11 + 2}::text,
                $${i * 11 + 3}::"SourceType",
                $${i * 11 + 4}::text,
                $${i * 11 + 5}::text,
                $${i * 11 + 6}::text[],
                $${i * 11 + 7}::text,
                $${i * 11 + 8}::int,
                $${i * 11 + 9}${vectorCast},
                $${i * 11 + 10}::jsonb,
                $${i * 11 + 11}::timestamptz)`,
          )
          .join(', ')}
        RETURNING id`,
        ...chunks.flatMap((c) => [
          documentId,
          c.kbId,
          c.sourceType,
          c.content,
          c.contentHash,
          c.headingPath,
          c.anchor,
          c.tokenCount,
          `[${c.embedding.join(',')}]`,
          JSON.stringify(c.metadata),
          new Date(),
        ]),
      );

      setTimeout(() => {
        const ids = rows.map((r) => r.id as string);
        console.log(`已写入 ${ids.length} chunks: ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}`);
      }, 0);

      return rows as unknown as Chunk[];
    };

    if (tx) {
      return runReplace(client as Prisma.TransactionClient);
    }
    return prisma.$transaction(runReplace);
  }
}