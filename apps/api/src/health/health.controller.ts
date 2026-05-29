import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Inject,
} from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import { QUEUE_TOKEN } from '../queue/queue.module';
import type { Queue } from 'bullmq';

const prisma = getPrismaClient();

@Controller('healthz')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Controller('readyz')
export class ReadyzController {
  constructor(
    @Inject(QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  @Get()
  async check() {
    const checks: { name: string; status: string; message?: string }[] = [];

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({ name: 'database', status: 'ok' });
    } catch {
      checks.push({
        name: 'database',
        status: 'error',
        message: '数据库不可达',
      });
    }

    if (this.queue) {
      try {
        await this.queue.getJobCounts('waiting');
        checks.push({ name: 'redis_bullmq', status: 'ok' });
      } catch {
        checks.push({
          name: 'redis_bullmq',
          status: 'error',
          message: 'Redis/BullMQ 不可达',
        });
      }
    } else {
      checks.push({
        name: 'redis_bullmq',
        status: 'error',
        message: 'Redis/BullMQ 队列未初始化',
      });
    }

    const allOk = checks.every((c) => c.status === 'ok');

    if (!allOk) {
      throw new HttpException(
        { status: 'error', checks, message: '部分依赖不可用' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', checks, timestamp: new Date().toISOString() };
  }
}