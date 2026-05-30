import type { EmbeddingProvider, EmbeddingResult } from './embedding-provider.interface';
import { ProviderError, ProviderErrorCodes } from './embedding-provider.interface';

export interface DashScopeEmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  batchSize?: number;
}

export function createDashScopeEmbeddingProvider(
  config: DashScopeEmbeddingConfig,
): EmbeddingProvider {
  const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com';
  const model = config.model || 'text-embedding-v3';
  const timeoutMs = config.timeoutMs ?? 30000;
  const batchSize = config.batchSize ?? 10;

  async function callEmbedding(texts: string[]): Promise<EmbeddingResult[]> {
    const url = `${baseUrl}/compatible-mode/v1/embeddings`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const status = response.status;
        const requestId = response.headers.get('x-request-id') || undefined;
        void (await response.text().catch(() => ''));

        if (status === 401 || status === 403) {
          throw new ProviderError(
            ProviderErrorCodes.AUTH_FAILED,
            'Embedding 服务认证失败，请检查 API Key',
            status,
            requestId,
          );
        }
        if (status === 429) {
          throw new ProviderError(
            ProviderErrorCodes.RATE_LIMITED,
            'Embedding 服务请求过于频繁，请稍后重试',
            status,
            requestId,
          );
        }
        if (status >= 500) {
          throw new ProviderError(
            ProviderErrorCodes.FAILED,
            `Embedding 服务返回错误 (${status})`,
            status,
            requestId,
          );
        }
        throw new ProviderError(
          ProviderErrorCodes.FAILED,
          `Embedding 服务返回异常状态 ${status}`,
          status,
          requestId,
        );
      }

      const data: Record<string, unknown> = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new ProviderError(
          ProviderErrorCodes.SCHEMA_MISMATCH,
          'Embedding 服务返回格式异常',
        );
      }

      const items = data.data as Array<Record<string, unknown>>;
      return items.map((item, index) => {
        const embedding = item.embedding as number[];
        if (!embedding || embedding.length !== 1024) {
          throw new ProviderError(
            ProviderErrorCodes.DIMENSION_MISMATCH,
            `嵌入维度不匹配: ${embedding?.length || 0}, 预期 1024`,
          );
        }
        return { vector: embedding, index: (item.index as number) ?? index };
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderError(
          ProviderErrorCodes.TIMEOUT,
          'Embedding 服务响应超时',
        );
      }
      const message = (err as Error).message || '';
      if (
        message.includes('fetch') ||
        message.includes('ENOTFOUND') ||
        message.includes('ECONNREFUSED') ||
        message.includes('network')
      ) {
        throw new ProviderError(
          ProviderErrorCodes.NETWORK_ERROR,
          'Embedding 服务网络连接失败',
        );
      }
      throw new ProviderError(ProviderErrorCodes.FAILED, 'Embedding 服务调用失败');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    providerName: 'dashscope',
    model,
    dimension: 1024,

    async embedDocuments(texts: string[]): Promise<EmbeddingResult[]> {
      const results: EmbeddingResult[] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await callEmbedding(batch);
        for (const r of batchResults) {
          results.push({ ...r, index: r.index + i });
        }
      }
      return results;
    },
  };
}