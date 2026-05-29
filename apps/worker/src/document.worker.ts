import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { getPrismaClient } from '@devbrain/db';
import {
  DOCUMENT_PROCESSING_QUEUE,
  isDocumentJobPayload,
  DocumentErrorCodes,
} from '@devbrain/db';
import type { DocumentJobPayload } from '@devbrain/db';
import { DocumentProcessorService } from './processor.service';

const prisma = getPrismaClient();

const TERMINAL_STATUSES = ['ready', 'failed', 'deleted'] as const;

@Injectable()
export class DocumentWorker implements OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly processor: DocumentProcessorService,
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL 未配置，Worker 无法启动');
    }

    this.worker = new Worker(
      DOCUMENT_PROCESSING_QUEUE,
      async (job: Job) => {
        if (!isDocumentJobPayload(job.data)) {
          console.warn(`无效的 job payload: ${JSON.stringify(job.data)}`);
          return;
        }

        const payload: DocumentJobPayload = job.data;

        const doc = await prisma.document.findUnique({
          where: { id: payload.documentId },
        });

        if (!doc || doc.deletedAt) {
          console.warn(`Document ${payload.documentId} 不存在或已删除`);
          return;
        }

        if ((TERMINAL_STATUSES as readonly string[]).includes(doc.status)) {
          console.warn(`Document ${payload.documentId} 已处于终态 ${doc.status}，跳过处理`);
          return;
        }

        if (doc.sourceType !== 'markdown') {
          console.warn(`Document ${payload.documentId} sourceType=${doc.sourceType}，跳过 Markdown ingestion`);
          return;
        }

        await prisma.document.update({
          where: { id: payload.documentId },
          data: { status: 'processing' },
        });

        try {
          await this.processor.process(payload);
        } catch (err) {
          console.error(
            `Worker 未预期异常: ${(err as Error).message}`,
            (err as Error).stack,
          );
          try {
            await this.processor.failDocument(
              payload.documentId,
              DocumentErrorCodes.WORKER_UNEXPECTED_ERROR,
            );
          } catch (dbErr) {
            console.error(`更新失败状态异常: ${(dbErr as Error).message}`);
          }
        }
      },
      {
        connection: { url: redisUrl },
        concurrency: 1,
      },
    );

    console.log(`Worker 已注册队列: ${DOCUMENT_PROCESSING_QUEUE}`);
  }

  onModuleDestroy() {
    this.worker?.close();
  }
}