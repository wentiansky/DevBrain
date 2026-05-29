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
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import type { User } from '@devbrain/db';
import type { Express } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DbTypeSmoke = User;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use(
    '/storage/local',
    express.raw({
      type: '*/*',
      limit: '21mb',
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevBrain API')
    .setDescription('DevBrain 知识库 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('devbrain_refresh', { type: 'apiKey', in: 'cookie' })
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, documentFactory);

  expressApp.set('trust proxy', 1);
  app.use(cookieParser());

  const isProduction = process.env.NODE_ENV === 'production';
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

  if (isProduction && corsOrigin === '*') {
    throw new Error('生产环境不允许 CORS_ORIGIN=* 搭配 credentials');
  }

  app.enableCors({
    origin: corsOrigin === '*' ? corsOrigin : corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-skip-refresh'],
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
