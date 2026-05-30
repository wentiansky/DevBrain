import { createDashScopeRerankProvider } from './dashscope-rerank.provider';
import { ProviderError, ProviderErrorCodes } from '../embedding/embedding-provider.interface';
import type { RerankDocument } from './rerank-provider.interface';

function buildConfig(overrides?: Partial<{ apiKey: string; baseUrl: string; timeoutMs: number }>) {
  return {
    apiKey: overrides?.apiKey ?? 'test-api-key',
    baseUrl: overrides?.baseUrl ?? 'https://dashscope.aliyuncs.com',
    timeoutMs: overrides?.timeoutMs ?? 5000,
  };
}

const testDocs: RerankDocument[] = [
  { chunkId: 'chunk-a', content: '文档 A 内容' },
  { chunkId: 'chunk-b', content: '文档 B 内容' },
  { chunkId: 'chunk-c', content: '文档 C 内容' },
];

describe('DashScopeRerankProvider', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('应有正确的 providerName 和 model', () => {
    const provider = createDashScopeRerankProvider(buildConfig());
    expect(provider.providerName).toBe('dashscope');
    expect(provider.model).toBe('gte-rerank');
  });

  it('成功响应应返回正确映射的 RerankResult', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            { index: 0, relevance_score: 0.95 },
            { index: 2, relevance_score: 0.72 },
            { index: 1, relevance_score: 0.60 },
          ],
        }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    const results = await provider.rerank('测试查询', testDocs, 3);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ chunkId: 'chunk-a', score: 0.95, index: 0 });
    expect(results[1]).toEqual({ chunkId: 'chunk-c', score: 0.72, index: 2 });
    expect(results[2]).toEqual({ chunkId: 'chunk-b', score: 0.60, index: 1 });
  });

  it('非数组 results 应抛 SCHEMA_MISMATCH', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: 'not-an-array' }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });

  it('results 字段缺失应抛 SCHEMA_MISMATCH', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });

  it('index 为非数字应抛 SCHEMA_MISMATCH', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [{ index: 'zero', relevance_score: 0.9 }],
        }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });

  it('index 越界应抛 SCHEMA_MISMATCH', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [{ index: 5, relevance_score: 0.9 }],
        }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.SCHEMA_MISMATCH,
        'Rerank 返回结果 index 越界: 5，候选文档数量: 3',
      ),
    );
  });

  it('缺少 relevance_score 应抛 SCHEMA_MISMATCH', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [{ index: 0 }],
        }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });

  it('relevance_score 为 0（真实低分）不应误判为缺失', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [{ index: 0, relevance_score: 0 }],
        }),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    const results = await provider.rerank('查询', testDocs, 1);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
    expect(results[0].chunkId).toBe('chunk-a');
  });

  it('401 应抛 AUTH_FAILED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Map([['x-request-id', 'req-401']]),
      text: () => Promise.resolve(''),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.AUTH_FAILED,
        'Rerank 服务认证失败，请检查 API Key',
        401,
        'req-401',
      ),
    );
  });

  it('429 应抛 RATE_LIMITED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map(),
      text: () => Promise.resolve(''),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.RATE_LIMITED,
        'Rerank 服务请求过于频繁，请稍后重试',
        429,
        undefined,
      ),
    );
  });

  it('500 应抛 FAILED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Map(),
      text: () => Promise.resolve(''),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });

  it('网络错误 (fetch reject) 应抛 NETWORK_ERROR', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.NETWORK_ERROR,
        'Rerank 服务网络连接失败',
      ),
    );
  });

  it('ENOTFOUND 应抛 NETWORK_ERROR', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('ENOTFOUND'), {
          name: 'FetchError',
          message: 'request to https://dashscope.aliyuncs.com/... failed, reason: getaddrinfo ENOTFOUND dashscope.aliyuncs.com',
        }),
      );

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 1)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.NETWORK_ERROR,
        'Rerank 服务网络连接失败',
      ),
    );
  });

  it('ECONNREFUSED 应抛 NETWORK_ERROR', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('ECONNREFUSED'), {
          message: 'connect ECONNREFUSED 127.0.0.1:443',
        }),
      );

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 1)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.NETWORK_ERROR,
        'Rerank 服务网络连接失败',
      ),
    );
  });

it('timeout 应抛 TIMEOUT', async () => {
    global.fetch = jest.fn((_url, options) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }
      });
    });

    const provider = createDashScopeRerankProvider(
      buildConfig({ timeoutMs: 50 }),
    );

    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      new ProviderError(
        ProviderErrorCodes.TIMEOUT,
        'Rerank 服务响应超时',
      ),
    );
  }, 10000);

  it('未分类 HTTP 状态码应抛 FAILED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 418,
      headers: new Map(),
      text: () => Promise.resolve(''),
    });

    const provider = createDashScopeRerankProvider(buildConfig());
    await expect(provider.rerank('查询', testDocs, 3)).rejects.toThrow(
      ProviderError,
    );
  });
});