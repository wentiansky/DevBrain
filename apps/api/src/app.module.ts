import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { ReadyzController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { SpacesModule } from './spaces/spaces.module';
import { KnowledgeBaseModule } from './kbs/knowledge-base.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { UploadsModule } from './uploads/uploads.module';
import { DocumentsModule } from './documents/documents.module';
import { ProvidersModule } from './providers/providers.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { GenerationModule } from './generation/generation.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    AuthModule,
    SpacesModule,
    KnowledgeBaseModule,
    StorageModule,
    QueueModule,
    UploadsModule,
    DocumentsModule,
    ProvidersModule,
    RetrievalModule,
    GenerationModule,
    ChatModule,
  ],
  controllers: [HealthController, ReadyzController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
