import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import type { Document } from '@devbrain/db';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DbTypeSmoke = Document;

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker started (placeholder — BullMQ consumer will be added in Change 5)');
}

void bootstrap();
