import { Injectable } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type {
  VectorStore,
  FtsCandidate,
  VectorCandidate,
  ChunkCitationFields,
} from './vector-store.interface';
import { ProviderError, ProviderErrorCodes } from '../providers/embedding/embedding-provider.interface';

const prisma = getPrismaClient();

@Injectable()
export class PostgresVectorStore implements VectorStore {
  async ftsRecall(kbId: string, query: string, topK: number): Promise<FtsCandidate[]> {
    const safeTop = Math.min(topK, 20);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        documentId: string;
        kbId: string;
        sourceType: string;
        content: string;
        headingPath: string[];
        anchor: string | null;
        page: number | null;
        bbox: Record<string, unknown> | null;
        rank: number;
      }>
    >(
      `SELECT
        c.id,
        c."documentId",
        c."kbId",
        c."sourceType",
        c."content",
        c."headingPath",
        c."anchor",
        c."page",
        c."bbox",
        ts_rank_cd(c."ftsVector", plainto_tsquery('zhcfg', $2)) AS rank
       FROM "Chunk" c
       JOIN "Document" d ON d.id = c."documentId"
       WHERE c."kbId" = $1
         AND d.status = 'ready'
         AND d."deletedAt" IS NULL
         AND c."ftsVector" @@ plainto_tsquery('zhcfg', $2)
       ORDER BY rank DESC
       LIMIT $3`,
      kbId,
      query,
      safeTop,
    );

    return rows.map((row, index) => ({
      chunkId: row.id,
      documentId: row.documentId,
      kbId: row.kbId,
      sourceType: row.sourceType,
      content: row.content,
      headingPath: row.headingPath ?? [],
      anchor: row.anchor,
      page: row.page,
      bbox: row.bbox,
      ftsRank: index + 1,
      ftsScore: Number(row.rank) || 0,
    }));
  }

  async vectorRecall(
    kbId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<VectorCandidate[]> {
    const safeTop = Math.min(topK, 20);

    if (queryEmbedding.length !== 1024) {
      throw new ProviderError(
        ProviderErrorCodes.DIMENSION_MISMATCH,
        `查询向量维度 ${queryEmbedding.length} 与数据库 vector(1024) 不匹配`,
      );
    }

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        documentId: string;
        kbId: string;
        sourceType: string;
        content: string;
        headingPath: string[];
        anchor: string | null;
        page: number | null;
        bbox: Record<string, unknown> | null;
        distance: number;
      }>
    >(
      `SELECT
        c.id,
        c."documentId",
        c."kbId",
        c."sourceType",
        c."content",
        c."headingPath",
        c."anchor",
        c."page",
        c."bbox",
        c.embedding <=> $2::vector AS distance
       FROM "Chunk" c
       JOIN "Document" d ON d.id = c."documentId"
       WHERE c."kbId" = $1
         AND d.status = 'ready'
         AND d."deletedAt" IS NULL
       ORDER BY distance ASC
       LIMIT $3`,
      kbId,
      vectorStr,
      safeTop,
    );

    return rows.map((row, index) => ({
      chunkId: row.id,
      documentId: row.documentId,
      kbId: row.kbId,
      sourceType: row.sourceType,
      content: row.content,
      headingPath: row.headingPath ?? [],
      anchor: row.anchor,
      page: row.page,
      bbox: row.bbox,
      vectorRank: index + 1,
      vectorDistance: Number(row.distance) || 0,
    }));
  }

  async loadCitationFields(userId: string, kbId: string, chunkIds: string[]): Promise<ChunkCitationFields[]> {
    if (chunkIds.length === 0) return [];

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        documentId: string;
        kbId: string;
        sourceType: string;
        content: string;
        headingPath: string[];
        anchor: string | null;
        page: number | null;
        bbox: Record<string, unknown> | null;
      }>
    >(
      `SELECT
        c.id,
        c."documentId",
        c."kbId",
        c."sourceType",
        c."content",
        c."headingPath",
        c."anchor",
        c."page",
        c."bbox"
       FROM "Chunk" c
       JOIN "Document" d ON d.id = c."documentId"
       JOIN "KnowledgeBase" k ON k.id = c."kbId"
       JOIN "Space" s ON s.id = k."spaceId"
       WHERE c.id = ANY($3::text[])
         AND c."kbId" = $2
         AND s."createdById" = $1
         AND d.status = 'ready'
         AND d."deletedAt" IS NULL
         AND k."archivedAt" IS NULL
         AND s.type = 'personal'`,
      userId,
      kbId,
      chunkIds,
    );

    return rows.map((row) => ({
      chunkId: row.id,
      documentId: row.documentId,
      kbId: row.kbId,
      sourceType: row.sourceType,
      content: row.content,
      headingPath: row.headingPath ?? [],
      anchor: row.anchor ?? null,
      page: row.page ?? null,
      bbox: (row.bbox as Record<string, unknown>) ?? null,
    }));
  }
}