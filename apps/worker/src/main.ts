import { config } from 'dotenv';
import * as path from 'node:path';
config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker 已启动，等待文档处理任务...');
}

void bootstrap();