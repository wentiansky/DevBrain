import { Module } from '@nestjs/common';
import { DocumentWorker } from './document.worker';
import { DocumentProcessorService } from './processor.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { OBJECT_STORAGE, EMBEDDING_PROVIDER } from './constants';
import {
  MockEmbeddingProvider,
  ChunkRepository,
  createDashScopeEmbeddingProvider,
} from './ingestion';
import type { EmbeddingProvider } from './ingestion';

@Module({
  providers: [
    DocumentWorker,
    DocumentProcessorService,
    ChunkRepository,
    {
      provide: OBJECT_STORAGE,
      useClass: LocalStorageAdapter,
    },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): EmbeddingProvider => {
        const providerType = process.env.EMBEDDING_PROVIDER || 'mock';
        if (providerType === 'dashscope') {
          const apiKey = process.env.DASHSCOPE_API_KEY;
          if (!apiKey) {
            throw new Error(
              'EMBEDDING_PROVIDER=dashscope 需要设置 DASHSCOPE_API_KEY 环境变量',
            );
          }
          const provider = createDashScopeEmbeddingProvider({
            apiKey,
            baseUrl:
              process.env.DASHSCOPE_BASE_URL ||
              'https://dashscope.aliyuncs.com',
            model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
            timeoutMs: parseInt(
              process.env.EMBEDDING_TIMEOUT_MS || '30000',
              10,
            ),
            batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10', 10),
          });
          console.log(
            `[EmbeddingProvider] 使用 DashScope: model=${provider.model} dimension=${provider.dimension}`,
          );
          return provider;
        }
        console.log(
          '[EmbeddingProvider] 使用 MockEmbeddingProvider（开发模式）',
        );
        return new MockEmbeddingProvider();
      },
    },
  ],
})
export class WorkerModule {}