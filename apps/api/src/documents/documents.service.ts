import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { getPrismaClient, DOCUMENT_PROCESSING_JOB } from '@devbrain/db';
import type { Document, User, DocumentJobPayload, ObjectStorage } from '@devbrain/db';
import { CreateDocumentDto, DocumentResponse } from './dto/document.dto';
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

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(QUEUE_TOKEN) private readonly queue: Queue,
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
}