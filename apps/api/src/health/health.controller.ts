import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';

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
  @Get()
  async check() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      throw new HttpException(
        { status: 'error', message: '数据库不可达' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
