import type { RerankProvider, RerankDocument, RerankResult } from './rerank-provider.interface';
import { ProviderError, ProviderErrorCodes } from '../embedding/embedding-provider.interface';

export interface DashScopeRerankConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export function createDashScopeRerankProvider(
  config: DashScopeRerankConfig,
): RerankProvider {
  const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com';
  const model = config.model || 'gte-rerank';
  const timeoutMs = config.timeoutMs ?? 30000;

  return {
    providerName: 'dashscope',
    model,

    async rerank(
      query: string,
      documents: RerankDocument[],
      topN: number,
    ): Promise<RerankResult[]> {
      const url = `${baseUrl}/compatible-mode/v1/rerank`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: {
              query,
              documents: documents.map((d) => d.content),
            },
            parameters: {
              top_n: Math.min(topN, documents.length),
              return_documents: false,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const status = response.status;
          const requestId = response.headers.get('x-request-id') || undefined;
          void (await response.text().catch(() => ''));

          if (status === 401 || status === 403) {
            throw new ProviderError(
              ProviderErrorCodes.AUTH_FAILED,
              'Rerank 服务认证失败，请检查 API Key',
              status,
              requestId,
            );
          }
          if (status === 429) {
            throw new ProviderError(
              ProviderErrorCodes.RATE_LIMITED,
              'Rerank 服务请求过于频繁，请稍后重试',
              status,
              requestId,
            );
          }
          if (status >= 500) {
            throw new ProviderError(
              ProviderErrorCodes.FAILED,
              `Rerank 服务返回错误 (${status})`,
              status,
              requestId,
            );
          }
          throw new ProviderError(
            ProviderErrorCodes.FAILED,
            `Rerank 服务返回异常状态 ${status}`,
            status,
            requestId,
          );
        }

        const data: Record<string, unknown> = await response.json();

        if (!data.results || !Array.isArray(data.results)) {
          throw new ProviderError(
            ProviderErrorCodes.SCHEMA_MISMATCH,
            'Rerank 服务返回格式异常',
          );
        }

        const items = data.results as Array<Record<string, unknown>>;
        return items.map((item) => {
          const docIndex = item.index as number;
          const score = item.relevance_score;

          if (typeof docIndex !== 'number' || !Number.isInteger(docIndex)) {
            throw new ProviderError(
              ProviderErrorCodes.SCHEMA_MISMATCH,
              `Rerank 返回结果 index 无效: ${JSON.stringify(item.index)}`,
            );
          }
          if (docIndex < 0 || docIndex >= documents.length) {
            throw new ProviderError(
              ProviderErrorCodes.SCHEMA_MISMATCH,
              `Rerank 返回结果 index 越界: ${docIndex}，候选文档数量: ${documents.length}`,
            );
          }
          if (typeof score !== 'number') {
            throw new ProviderError(
              ProviderErrorCodes.SCHEMA_MISMATCH,
              `Rerank 返回结果缺少 relevance_score: ${JSON.stringify(item)}`,
            );
          }

          return {
            chunkId: documents[docIndex].chunkId,
            score,
            index: docIndex,
          };
        });
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new ProviderError(
            ProviderErrorCodes.TIMEOUT,
            'Rerank 服务响应超时',
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
            'Rerank 服务网络连接失败',
          );
        }
        throw new ProviderError(ProviderErrorCodes.FAILED, 'Rerank 服务调用失败');
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}