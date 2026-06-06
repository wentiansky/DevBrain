import {
  captureBusinessException,
  captureBusinessMessage,
  isManuallyCapturedError,
  markErrorManuallyCaptured,
  sanitizeSentryContext,
  sanitizeSentryEvent,
  shouldDropSentryEvent,
  shouldReportHttpStatus,
} from './sentry';

const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetContext = jest.fn();
const mockSetTag = jest.fn();

jest.mock('@sentry/nestjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  withScope: (callback: (scope: { setContext: jest.Mock; setTag: jest.Mock }) => void) =>
    callback({
      setContext: mockSetContext,
      setTag: mockSetTag,
    }),
}));

describe('API Sentry 脱敏', () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
    mockCaptureMessage.mockClear();
    mockSetContext.mockClear();
    mockSetTag.mockClear();
  });

  it('移除请求头、cookie、token、prompt、content 等敏感信息', () => {
    const event = sanitizeSentryEvent({
      request: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'devbrain_refresh=secret',
          'x-request-id': 'req_1',
        },
        cookies: { devbrain_refresh: 'secret' },
        data: {
          password: 'secret',
          prompt: '完整 prompt',
          content: '私有文档内容',
          kbId: 'kb_1',
        },
        query_string: 'token=secret&next=/',
      },
      extra: {
        answer: '模型完整回答',
        nested: { apiKey: 'secret', route: '/chat' },
      },
      tags: {
        token: 'secret',
        route: '/chat',
      },
    });

    expect(event.request?.headers?.authorization).toBe('[已脱敏]');
    expect(event.request?.headers?.cookie).toBe('[已脱敏]');
    expect(event.request?.headers?.['x-request-id']).toBe('req_1');
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBe('[已脱敏]');
    expect((event.request?.data as Record<string, unknown>).password).toBe('[已脱敏]');
    expect((event.request?.data as Record<string, unknown>).prompt).toBe('[已脱敏]');
    expect((event.request?.data as Record<string, unknown>).content).toBe('[已脱敏]');
    expect((event.request?.data as Record<string, unknown>).kbId).toBe('kb_1');
    expect((event.extra as Record<string, unknown>).answer).toBe('[已脱敏]');
    expect(((event.extra as Record<string, unknown>).nested as Record<string, unknown>).apiKey).toBe(
      '[已脱敏]',
    );
    expect(event.tags?.token).toBe('[已脱敏]');
    expect(event.tags?.route).toBe('/chat');
  });

  it('非 JSON 字符串请求体整体脱敏', () => {
    const event = sanitizeSentryEvent({
      request: {
        data: '用户直接提交的私有内容',
      },
    });

    expect(event.request?.data).toBe('[已脱敏]');
  });

  it('exception value 中的 token 和 cookie 会被脱敏，长消息整体脱敏', () => {
    const event = sanitizeSentryEvent({
      exception: {
        values: [
          {
            type: 'Error',
            value: '上游失败 Bearer secret-token devbrain_refresh=secret-cookie',
          },
          {
            type: 'Error',
            value: 'x'.repeat(250),
          },
        ],
      },
    });

    expect(event.exception?.values?.[0]?.value).toBe(
      '上游失败 Bearer [已脱敏] devbrain_refresh=[已脱敏]',
    );
    expect(event.exception?.values?.[1]?.value).toBe('[已脱敏] (250 chars)');
  });

  it('只上报 500 级 HTTP 错误', () => {
    expect(shouldReportHttpStatus(400)).toBe(false);
    expect(shouldReportHttpStatus(401)).toBe(false);
    expect(shouldReportHttpStatus(404)).toBe(false);
    expect(shouldReportHttpStatus(500)).toBe(true);
    expect(shouldReportHttpStatus(503)).toBe(true);
  });

  it('业务上下文只保留白名单字段', () => {
    expect(
      sanitizeSentryContext({
        route: '/chat',
        kbId: 'kb_1',
        prompt: '完整 prompt',
        content: '文档内容',
        provider: 'qwen',
        sizeBytes: 100,
      }),
    ).toEqual({
      route: '/chat',
      kbId: 'kb_1',
      provider: 'qwen',
      sizeBytes: 100,
    });
  });

  it('业务异常上报只传脱敏后的上下文', () => {
    const error = new Error('provider failed');

    captureBusinessException(error, {
      route: '/chat',
      stage: 'chat_stream',
      kbId: 'kb_1',
      prompt: '完整 prompt',
      provider: 'qwen',
    });

    expect(mockCaptureException).toHaveBeenCalledWith(error);
    expect(isManuallyCapturedError(error)).toBe(true);
    expect(mockSetContext).toHaveBeenCalledWith('devbrain', {
      route: '/chat',
      stage: 'chat_stream',
      kbId: 'kb_1',
      provider: 'qwen',
    });
    expect(mockSetTag).toHaveBeenCalledWith('route', '/chat');
    expect(mockSetTag).not.toHaveBeenCalledWith('prompt', '完整 prompt');
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('手动上报后的同一个异常会丢弃自动 filter 重复事件', () => {
    const error = new Error('provider failed');

    captureBusinessException(error, {
      route: '/documents',
      stage: 'document_enqueue',
      errorCode: 'queue_add_failed',
    });

    expect(
      shouldDropSentryEvent(
        {
          exception: {
            values: [
              {
                type: 'Error',
                value: 'provider failed',
                mechanism: { type: 'auto.http.nestjs.global_filter' },
              },
            ],
          },
        },
        { originalException: error },
      ),
    ).toBe(true);

    expect(
      shouldDropSentryEvent(
        {
          exception: {
            values: [{ type: 'Error', value: 'provider failed' }],
          },
        },
        { originalException: error },
      ),
    ).toBe(false);
  });

  it('可显式标记包装后的异常，供自动 filter 去重', () => {
    const wrapped = new Error('wrapped provider failed');

    markErrorManuallyCaptured(wrapped);

    expect(isManuallyCapturedError(wrapped)).toBe(true);
    expect(
      shouldDropSentryEvent(
        {
          exception: {
            values: [
              {
                type: 'Error',
                value: 'wrapped provider failed',
                mechanism: { type: 'auto.http.nestjs.global_filter' },
              },
            ],
          },
        },
        { originalException: wrapped },
      ),
    ).toBe(true);
  });

  it('业务消息上报不包含敏感上下文', () => {
    captureBusinessMessage('refresh token replay detected', {
      route: '/auth/refresh',
      stage: 'auth_refresh_replay',
      errorCode: 'refresh_token_replay',
      token: 'secret',
    });

    expect(mockCaptureMessage).toHaveBeenCalledWith('refresh token replay detected', 'warning');
    expect(mockSetContext).toHaveBeenCalledWith('devbrain', {
      route: '/auth/refresh',
      stage: 'auth_refresh_replay',
      errorCode: 'refresh_token_replay',
    });
    expect(mockSetTag).not.toHaveBeenCalledWith('token', 'secret');
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
