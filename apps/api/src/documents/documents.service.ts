import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { getPrismaClient, DOCUMENT_PROCESSING_JOB } from '@devbrain/db';
import type { Document, User, DocumentJobPayload, ObjectStorage } from '@devbrain/db';
import { CreateDocumentDto, DocumentResponse, ChunkListResponse } from './dto/document.dto';
import { OBJECT_STORAGE } from '../storage/storage.module';
import { verifySignatureToken } from '../storage/signature';
import { KnowledgeBaseService } from '../kbs/knowledge-base.service';
import { QUEUE_TOKEN } from '../queue/queue.module';
import type { Queue } from 'bullmq';

const prisma = getPrismaClient();

function toResponse(doc: Document): DocumentResponse {
  return {
    id: doc.id,
    kbId: doc.kbId,
    sourceType: doc.sourceType,
    originalName: doc.originalName,
    status: doc.status,
    errorCode: doc.errorCode ?? null,
    errorMessage: doc.errorMessage ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

interface CursorPayload {
  o: number;
  t: string;
  i: string;
}

function encodeCursor(ordinal: number, createdAt: Date, id: string): string {
  const payload: CursorPayload = { o: ordinal, t: createdAt.toISOString(), i: id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed?.o === 'number' &&
      typeof parsed?.t === 'string' &&
      typeof parsed?.i === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(QUEUE_TOKEN) private readonly queue: Queue | null,
  ) {}

  async create(
    user: User,
    dto: CreateDocumentDto,
  ): Promise<DocumentResponse> {
    const kb = await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
      user.id,
      dto.kbId,
    );

    if (dto.sizeBytes && dto.sizeBytes > 20 * 1024 * 1024) {
      throw new BadRequestException('文件超过 20MB 上限');
    }

    const tokenPayload = verifySignatureToken(dto.uploadToken);
    if (!tokenPayload) {
      throw new BadRequestException('上传 token 无效或已过期，请重新上传');
    }

    if (tokenPayload.objectKey !== dto.objectKey) {
      throw new BadRequestException('上传 token 与 objectKey 不匹配');
    }

    const expectedPrefix = `${kb.id}/${user.id}/`;
    if (!dto.objectKey.startsWith(expectedPrefix)) {
      throw new BadRequestException('上传对象不属于当前用户或 KB');
    }

    const headResult = await this.storage.headObject(dto.objectKey);
    if (!headResult.exists) {
      throw new BadRequestException('对象不存在，请先完成文件上传');
    }

    if (!this.queue) {
      throw new BadRequestException('文档处理队列未就绪，请确认 Redis 已启动并配置 REDIS_URL');
    }

    const document = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: dto.originalName,
        objectKey: dto.objectKey,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes ?? headResult.sizeBytes ?? null,
        status: 'queued',
      },
    });

    const jobPayload: DocumentJobPayload = {
      documentId: document.id,
      kbId: kb.id,
      objectKey: document.objectKey,
    };

    await this.queue.add(DOCUMENT_PROCESSING_JOB, jobPayload);

    return toResponse(document);
  }

  async listByKb(user: User, kbId: string): Promise<DocumentResponse[]> {
    await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
      user.id,
      kbId,
    );

    const docs = await prisma.document.findMany({
      where: {
        kbId,
        deletedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return docs.map(toResponse);
  }

  async getById(user: User, documentId: string): Promise<DocumentResponse> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document 不存在或无权访问');
    }

    await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
      user.id,
      doc.kbId,
    );

    return toResponse(doc);
  }

  async getChunks(
    user: User,
    documentId: string,
    limit: number = 100,
    cursor?: string,
  ): Promise<ChunkListResponse> {
    const safeLimit = Number.isFinite(limit) ? limit : 100;
    const effectiveLimit = Math.min(Math.max(1, safeLimit), 500);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document 不存在或无权访问');
    }

    await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
      user.id,
      doc.kbId,
    );

    let cursorOrdinal: number | null = null;
    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        cursorOrdinal = decoded.o;
        cursorCreatedAt = new Date(decoded.t);
        cursorId = decoded.i;
      }
    }

    const hasCursor = cursorOrdinal !== null && cursorCreatedAt !== null && cursorId !== null;
    const cursorFilter = hasCursor
      ? `AND (COALESCE((c."metadata"->>'ordinal')::int, 2147483647), c."createdAt", c.id) > ($3::int, $4::timestamptz, $5::text)`
      : '';

    const params: unknown[] = [documentId, effectiveLimit + 1];
    if (hasCursor) {
      params.push(cursorOrdinal, cursorCreatedAt, cursorId);
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        documentId: string;
        kbId: string;
        sourceType: string;
        content: string;
        headingPath: string[];
        anchor: string;
        tokenCount: number;
        metadata: Record<string, unknown>;
        createdAt: Date;
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
        c."tokenCount",
        c."metadata",
        c."createdAt",
        COALESCE((c."metadata"->>'ordinal')::int, 2147483647) AS "_ordinal"
      FROM "Chunk" c
      WHERE c."documentId" = $1 ${cursorFilter}
      ORDER BY
        "_ordinal" ASC,
        c."createdAt" ASC,
        c.id ASC
      LIMIT $2`,
      ...params,
    );

    const hasMore = rows.length > effectiveLimit;
    const items = rows.slice(0, effectiveLimit);
    const nextCursor = hasMore && items.length > 0
      ? encodeCursor(
          Number((items[items.length - 1] as Record<string, unknown>)._ordinal) || 0,
          (items[items.length - 1].createdAt as Date),
          items[items.length - 1].id,
        )
      : null;

    return {
      items: items.map((r) => ({
        id: r.id,
        documentId: r.documentId,
        kbId: r.kbId,
        sourceType: r.sourceType,
        content: r.content,
        headingPath: r.headingPath ?? [],
        anchor: r.anchor ?? '',
        tokenCount: r.tokenCount,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt,
      })),
      nextCursor,
    };
  }
}