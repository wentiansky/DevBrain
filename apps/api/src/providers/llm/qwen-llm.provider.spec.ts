import { createQwenLlmProvider } from './qwen-llm.provider';
import { ProviderErrorCodes } from '../embedding/embedding-provider.interface';
import type { LlmGenerateParams } from './llm-provider.interface';

function buildConfig(overrides?: Partial<{ apiKey: string; baseUrl: string; timeoutMs: number }>) {
  return {
    apiKey: overrides?.apiKey ?? 'test-api-key',
    baseUrl: overrides?.baseUrl ?? 'https://dashscope.aliyuncs.com',
    timeoutMs: overrides?.timeoutMs ?? 5000,
  };
}

function createSSEResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers(),
    statusText: 'OK',
    url: '',
    type: 'default',
    redirected: false,
    clone: () => createSSEResponse(lines),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.reject(new Error('not implemented')),
    json: () => Promise.reject(new Error('not implemented')),
    text: () => Promise.resolve(lines.join('\n')),
  } as Response;
}

async function collectStream(
  provider: ReturnType<typeof createQwenLlmProvider>,
  params: LlmGenerateParams,
) {
  const chunks: Array<Record<string, unknown>> = [];
  for await (const chunk of provider.stream(params)) {
    chunks.push(chunk as unknown as Record<string, unknown>);
  }
  return chunks;
}

const testParams: LlmGenerateParams = {
  messages: [{ role: 'user', content: '你好' }],
  maxTokens: 1024,
  temperature: 0.3,
};

describe('QwenLlmProvider', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('应有正确的 providerName 和 model', () => {
    const provider = createQwenLlmProvider(buildConfig());
    expect(provider.providerName).toBe('qwen');
    expect(provider.model).toBe('qwen-plus');
  });

  it('成功流式响应应返回 delta 和 finish 事件', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createSSEResponse([
        'data: {"choices":[{"delta":{"content":"你好"},"index":0}]}',
        'data: {"choices":[{"delta":{"content":"！"},"index":0}]}',
        'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"total_tokens":10}}',
        'data: [DONE]',
      ]),
    );

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks).toEqual([
      { type: 'delta', delta: '你好' },
      { type: 'delta', delta: '！' },
      { type: 'finish', finishReason: 'stop', usage: { total_tokens: 10 } },
    ]);
  });

  it('多行 delta 内容应在同一块中', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createSSEResponse([
        'data: {"choices":[{"delta":{"content":"你好\\n世界"},"index":0}]}',
        'data: [DONE]',
      ]),
    );

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({ type: 'delta', delta: '你好\n世界' });
  });

  it('401 应返回 AUTH_FAILED error 流', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(''),
    });

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks).toEqual([
      {
        type: 'error',
        errorCode: ProviderErrorCodes.AUTH_FAILED,
        message: 'LLM 服务认证失败，请检查 API Key',
      },
    ]);
  });

  it('429 应返回 RATE_LIMITED error 流', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    });

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({
      type: 'error',
      errorCode: ProviderErrorCodes.RATE_LIMITED,
    });
  });

  it('500 应返回 FAILED error 流', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({
      type: 'error',
      errorCode: ProviderErrorCodes.FAILED,
    });
  });

  it('无响应 body 应返回 STREAM_INTERRUPTED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks).toEqual([
      {
        type: 'error',
        errorCode: ProviderErrorCodes.STREAM_INTERRUPTED,
        message: 'LLM 服务未返回流式响应体',
      },
    ]);
  });

  it('timeout 应返回 TIMEOUT error 流', async () => {
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

    const provider = createQwenLlmProvider(buildConfig({ timeoutMs: 50 }));
    const chunks = await collectStream(provider, testParams);

    expect(chunks).toMatchObject([
      {
        type: 'error',
        errorCode: ProviderErrorCodes.TIMEOUT,
      },
    ]);
  }, 10000);

  it('fetch reject (网络错误) 应返回 NETWORK_ERROR', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks).toEqual([
      {
        type: 'error',
        errorCode: ProviderErrorCodes.NETWORK_ERROR,
        message: 'LLM 服务网络连接失败',
      },
    ]);
  });

  it('ENOTFOUND 应返回 NETWORK_ERROR', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('getaddrinfo ENOTFOUND'), {
          message: 'request to https://dashscope.aliyuncs.com/... failed, reason: getaddrinfo ENOTFOUND dashscope.aliyuncs.com',
        }),
      );

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({
      type: 'error',
      errorCode: ProviderErrorCodes.NETWORK_ERROR,
    });
  });

  it('ECONNREFUSED 应返回 NETWORK_ERROR', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED'), {
          message: 'connect ECONNREFUSED 127.0.0.1:443',
        }),
      );

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({
      type: 'error',
      errorCode: ProviderErrorCodes.NETWORK_ERROR,
    });
  });

  it('unknown HTTP 状态应返回 FAILED error 流', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 418,
      text: () => Promise.resolve(''),
    });

    const provider = createQwenLlmProvider(buildConfig());
    const chunks = await collectStream(provider, testParams);

    expect(chunks[0]).toMatchObject({
      type: 'error',
      errorCode: ProviderErrorCodes.FAILED,
    });
  });
});