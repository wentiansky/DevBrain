import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import type { User } from '@devbrain/db';
import type { Express } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DbTypeSmoke = User;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevBrain API')
    .setDescription('DevBrain 知识库 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('devbrain_refresh', { type: 'apiKey', in: 'cookie' })
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, documentFactory);

  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
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
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
