import { config } from 'dotenv';
import * as path from 'node:path';
config({ path: path.resolve(__dirname, '../../../.env') });

// 将 DEV_STORAGE_ROOT 解析为项目根目录下的绝对路径，
// 确保 API 和 Worker 进程在不同 CWD 下仍读写同一存储目录。
// 未设置时也写回默认绝对路径，避免 adapter 回退到相对路径。
{
  const projectRoot = path.resolve(__dirname, '../../..');
  const storageRoot = process.env.DEV_STORAGE_ROOT;
  if (!storageRoot || !path.isAbsolute(storageRoot)) {
    process.env.DEV_STORAGE_ROOT = path.resolve(projectRoot, storageRoot ?? '.devbrain/storage');
  }
}

import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker 已启动，等待文档处理任务...');
}

void bootstrap();