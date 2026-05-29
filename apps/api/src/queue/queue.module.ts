import { Module, Global } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DOCUMENT_PROCESSING_QUEUE,
} from '@devbrain/db';

function createQueue(): Queue {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL 未配置，BullMQ 队列为必需依赖，应用无法启动');
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