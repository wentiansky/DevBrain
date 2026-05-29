import { Module, Global } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DOCUMENT_PROCESSING_QUEUE,
} from '@devbrain/db';

function createQueue(): Queue | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL 未配置，Queue 将以 null 注入，文档处理相关功能不可用');
    return null;
  }
  return new Queue(DOCUMENT_PROCESSING_QUEUE, {
    connection: { url: redisUrl },
  });
}

export const QUEUE_TOKEN = 'DOCUMENT_QUEUE';

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_TOKEN,
      useFactory: () => createQueue(),
    },
  ],
  exports: [QUEUE_TOKEN],
})
export class QueueModule {}