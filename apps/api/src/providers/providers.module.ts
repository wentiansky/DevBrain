import { Module, Global } from '@nestjs/common';
import type { EmbeddingProvider } from './embedding/embedding-provider.interface';
import type { RerankProvider } from './rerank/rerank-provider.interface';
import type { LlmProvider } from './llm/llm-provider.interface';
import { MockEmbeddingProvider } from './embedding/mock-embedding.provider';
import { createDashScopeEmbeddingProvider } from './embedding/dashscope-embedding.provider';
import { MockRerankProvider } from './rerank/mock-rerank.provider';
import { createDashScopeRerankProvider } from './rerank/dashscope-rerank.provider';
import { MockLlmProvider } from './llm/mock-llm.provider';
import { createQwenLlmProvider } from './llm/qwen-llm.provider';

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';
export const RERANK_PROVIDER = 'RERANK_PROVIDER';
export const LLM_PROVIDER = 'LLM_PROVIDER';
export const RETRIEVAL_LOW_RELEVANCE_THRESHOLD = 'RETRIEVAL_LOW_RELEVANCE_THRESHOLD';

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): EmbeddingProvider => {
        const providerType = process.env.EMBEDDING_PROVIDER || 'mock';
        if (providerType === 'dashscope') {
          const apiKey = process.env.DASHSCOPE_API_KEY;
          if (!apiKey) {
            throw new Error(
              'EMBEDDING_PROVIDER=dashscope 但 DASHSCOPE_API_KEY 未设置，启动失败。请设置环境变量或改用 EMBEDDING_PROVIDER=mock',
            );
          }
          return createDashScopeEmbeddingProvider({
            apiKey,
            baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
            model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
            timeoutMs: parseInt(process.env.EMBEDDING_TIMEOUT_MS || '30000', 10),
            batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10', 10),
          });
        }
        return new MockEmbeddingProvider();
      },
    },
    {
      provide: RERANK_PROVIDER,
      useFactory: (): RerankProvider => {
        const providerType = process.env.RERANK_PROVIDER || 'mock';
        if (providerType === 'dashscope') {
          const apiKey = process.env.DASHSCOPE_API_KEY;
          if (!apiKey) {
            throw new Error(
              'RERANK_PROVIDER=dashscope 但 DASHSCOPE_API_KEY 未设置，启动失败。请设置环境变量或改用 RERANK_PROVIDER=mock',
            );
          }
          return createDashScopeRerankProvider({
            apiKey,
            baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
            model: process.env.RERANK_MODEL || 'gte-rerank',
            timeoutMs: parseInt(process.env.RERANK_TIMEOUT_MS || '30000', 10),
          });
        }
        return new MockRerankProvider();
      },
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (): LlmProvider => {
        const providerType = process.env.LLM_PROVIDER || 'mock';
        if (providerType === 'qwen') {
          const apiKey = process.env.DASHSCOPE_API_KEY;
          if (!apiKey) {
            throw new Error(
              'LLM_PROVIDER=qwen 但 DASHSCOPE_API_KEY 未设置，启动失败。请设置环境变量或改用 LLM_PROVIDER=mock',
            );
          }
          return createQwenLlmProvider({
            apiKey,
            baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
            model: process.env.LLM_MODEL || 'qwen-plus',
            timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
          });
        }
        return new MockLlmProvider();
      },
    },
    {
      provide: RETRIEVAL_LOW_RELEVANCE_THRESHOLD,
      useValue: parseFloat(process.env.RETRIEVAL_LOW_RELEVANCE_THRESHOLD || '0.2'),
    },
  ],
  exports: [EMBEDDING_PROVIDER, RERANK_PROVIDER, LLM_PROVIDER, RETRIEVAL_LOW_RELEVANCE_THRESHOLD],
})
export class ProvidersModule {}