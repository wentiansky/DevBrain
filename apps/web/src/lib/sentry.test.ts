import { describe, it, expect } from 'vitest';
import {
  sanitizeEvent,
  extractFileNameInfo,
  shouldReportHttpError,
  isExpectedError,
} from './sentry';

describe('extractFileNameInfo', () => {
  it('应提取扩展名', () => {
    expect(extractFileNameInfo('readme.md')).toEqual({
      extension: '.md',
      hasName: true,
    });
  });

  it('应处理无扩展名的文件名', () => {
    expect(extractFileNameInfo('Makefile')).toEqual({
      hasName: true,
    });
  });

  it('应处理空文件名', () => {
    expect(extractFileNameInfo(undefined)).toEqual({
      hasName: false,
    });
  });

  it('应处理多段扩展名', () => {
    expect(extractFileNameInfo('archive.tar.gz')).toEqual({
      extension: '.gz',
      hasName: true,
    });
  });
});

describe('sanitizeEvent', () => {
  it('应脱敏 Authorization header', () => {
    const event = {
      request: {
        headers: {
          Authorization: 'Bearer token-abc-123',
          'Content-Type': 'application/json',
        },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.headers).toEqual({
      Authorization: '[已脱敏]',
      'Content-Type': 'application/json',
    });
  });

  it('应脱敏 Cookie header', () => {
    const event = {
      request: {
        headers: {
          Cookie: 'session=abc; token=xyz',
          'Content-Type': 'application/json',
        },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.headers).toEqual({
      Cookie: '[已脱敏]',
      'Content-Type': 'application/json',
    });
  });

  it('应脱敏 Set-Cookie header', () => {
    const event = {
      request: {
        headers: {
          'Set-Cookie': 'refresh=abc; HttpOnly',
          'Content-Type': 'application/json',
        },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.headers).toEqual({
      'Set-Cookie': '[已脱敏]',
      'Content-Type': 'application/json',
    });
  });

  it('应脱敏 request body 中的 password', () => {
    const event = {
      request: {
        data: JSON.stringify({ email: 'test@test.com', password: 'secret123' }),
      },
    };
    const result = sanitizeEvent(event);
    const data = JSON.parse(result.request?.data as string);
    expect(data.email).toBe('test@test.com');
    expect(data.password).toBe('[已脱敏]');
  });

  it('应脱敏 request body 中的 accessToken', () => {
    const event = {
      request: {
        data: { accessToken: 'token-abc', userId: 'user-1' },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toEqual({
      accessToken: '[已脱敏]',
      userId: 'user-1',
    });
  });

  it('应脱敏 request body 中的 refreshToken', () => {
    const event = {
      request: {
        data: { refreshToken: 'refresh-abc', userId: 'user-1' },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toEqual({
      refreshToken: '[已脱敏]',
      userId: 'user-1',
    });
  });

  it('应脱敏 message 字段', () => {
    const event = {
      request: {
        data: { message: '这是一段很长的用户消息内容', id: 'msg-1' },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toEqual({
      message: '[已脱敏]',
      id: 'msg-1',
    });
  });

  it('应脱敏 prompt 字段', () => {
    const event = {
      request: {
        data: { prompt: '完整的 prompt 内容', model: 'qwen-plus' },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toEqual({
      prompt: '[已脱敏]',
      model: 'qwen-plus',
    });
  });

  it('应脱敏 content 字段', () => {
    const event = {
      request: {
        data: { content: '文档完整内容', id: 'doc-1' },
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toEqual({
      content: '[已脱敏]',
      id: 'doc-1',
    });
  });

  it('应截断过长字符串', () => {
    const longStr = 'a'.repeat(300);
    const event = {
      request: {
        data: { description: longStr, id: 'item-1' },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    expect(data.description).toBe('[已脱敏] (300 chars)');
    expect(data.id).toBe('item-1');
  });

  it('应处理原始字符串 body', () => {
    const event = {
      request: {
        data: 'a'.repeat(300),
      },
    };
    const result = sanitizeEvent(event);
    expect(result.request?.data).toBe('[已脱敏] (300 chars)');
  });

  it('应保留安全元数据', () => {
    const event = {
      request: {
        data: {
          kbId: 'kb-123',
          documentId: 'doc-456',
          conversationId: 'conv-789',
          messageId: 'msg-abc',
          sourceType: 'markdown',
          errorCode: 'PROCESSING_FAILED',
          sizeBytes: 1024,
          fileExtension: '.md',
          mimeType: 'text/markdown',
        },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    expect(data.kbId).toBe('kb-123');
    expect(data.documentId).toBe('doc-456');
    expect(data.conversationId).toBe('conv-789');
    expect(data.messageId).toBe('msg-abc');
    expect(data.sourceType).toBe('markdown');
    expect(data.errorCode).toBe('PROCESSING_FAILED');
    expect(data.sizeBytes).toBe(1024);
    expect(data.fileExtension).toBe('.md');
    expect(data.mimeType).toBe('text/markdown');
  });

  it('应脱敏 breadcrumbs 中的敏感数据', () => {
    const event = {
      breadcrumbs: [
        {
          data: { accessToken: 'token-abc', userId: 'user-1' },
        },
      ],
    };
    const result = sanitizeEvent(event);
    expect(result.breadcrumbs?.[0].data).toEqual({
      accessToken: '[已脱敏]',
      userId: 'user-1',
    });
  });

  it('应脱敏 tags 中的敏感数据', () => {
    const event = {
      tags: {
        password: 'secret',
        userId: 'user-1',
        longTag: 'a'.repeat(300),
      },
    };
    const result = sanitizeEvent(event);
    expect(result.tags).toEqual({
      password: '[已脱敏]',
      userId: 'user-1',
      longTag: '[已脱敏] (300 chars)',
    });
  });

  it('应脱敏 extra 中的敏感数据', () => {
    const event = {
      extra: {
        message: '用户消息内容',
        prompt: '完整 prompt',
        kbId: 'kb-123',
        longField: 'a'.repeat(300),
      },
    };
    const result = sanitizeEvent(event);
    expect(result.extra).toEqual({
      message: '[已脱敏]',
      prompt: '[已脱敏]',
      kbId: 'kb-123',
      longField: '[已脱敏] (300 chars)',
    });
  });

  it('应处理空事件', () => {
    const event = {};
    const result = sanitizeEvent(event);
    expect(result).toEqual({});
  });

  it('应处理嵌套对象', () => {
    const event = {
      request: {
        data: {
          user: { password: 'secret', name: 'Alice' },
          metadata: { kbId: 'kb-1' },
        },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    const user = data.user as Record<string, unknown>;
    expect(user.password).toBe('[已脱敏]');
    expect(user.name).toBe('Alice');
  });

  it('应递归脱敏数组中的敏感数据', () => {
    const event = {
      request: {
        data: {
          messages: [
            { role: 'user', content: '用户消息内容' },
            { role: 'assistant', content: '助手回答内容' },
          ],
        },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    const messages = data.messages as Array<Record<string, unknown>>;
    expect(messages[0].content).toBe('[已脱敏]');
    expect(messages[0].role).toBe('user');
    expect(messages[1].content).toBe('[已脱敏]');
    expect(messages[1].role).toBe('assistant');
  });

  it('应递归脱敏 extra 中的嵌套数组', () => {
    const event = {
      extra: {
        citations: [
          { chunkText: '私密文档片段', documentId: 'doc-1', score: 0.9 },
          { chunkText: '另一段私密内容', documentId: 'doc-2', score: 0.8 },
        ],
      },
    };
    const result = sanitizeEvent(event);
    const citations = result.extra?.citations as Array<Record<string, unknown>>;
    expect(citations[0].chunkText).toBe('[已脱敏]');
    expect(citations[0].documentId).toBe('doc-1');
    expect(citations[0].score).toBe(0.9);
    expect(citations[1].chunkText).toBe('[已脱敏]');
  });

  it('应递归脱敏 extra 中的嵌套对象', () => {
    const event = {
      extra: {
        metadata: {
          message: '用户消息',
          kbId: 'kb-1',
          nested: { prompt: '完整 prompt', model: 'qwen' },
        },
      },
    };
    const result = sanitizeEvent(event);
    const extra = result.extra as Record<string, unknown>;
    const metadata = extra.metadata as Record<string, unknown>;
    expect(metadata.message).toBe('[已脱敏]');
    expect(metadata.kbId).toBe('kb-1');
    const nested = metadata.nested as Record<string, unknown>;
    expect(nested.prompt).toBe('[已脱敏]');
    expect(nested.model).toBe('qwen');
  });

  it('应处理 null 和 undefined 值', () => {
    const event = {
      request: {
        data: {
          kbId: null,
          message: null,
          optional: undefined,
          safe: 'ok',
        },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    expect(data.kbId).toBeNull();
    expect(data.message).toBeNull();
    expect(data.optional).toBeUndefined();
    expect(data.safe).toBe('ok');
  });

  it('应脱敏 extra 中嵌套的 headers 对象', () => {
    const event = {
      extra: {
        headers: {
          Authorization: 'Bearer token-abc',
          Cookie: 'refresh=xxx',
          'Content-Type': 'application/json',
        },
      },
    };
    const result = sanitizeEvent(event);
    const headers = result.extra?.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('[已脱敏]');
    expect(headers.Cookie).toBe('[已脱敏]');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('应脱敏 breadcrumbs 中嵌套的 headers 对象', () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            headers: {
              Authorization: 'Bearer secret',
              'Set-Cookie': 'session=abc',
            },
          },
        },
      ],
    };
    const result = sanitizeEvent(event);
    const headers = result.breadcrumbs?.[0].data?.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('[已脱敏]');
    expect(headers['Set-Cookie']).toBe('[已脱敏]');
  });

  it('应脱敏 request data 中嵌套的 headers 对象', () => {
    const event = {
      request: {
        data: {
          forwarded: {
            headers: {
              Authorization: 'Bearer inner-token',
              Cookie: 'session=inner',
            },
          },
        },
      },
    };
    const result = sanitizeEvent(event);
    const data = result.request?.data as Record<string, unknown>;
    const forwarded = data.forwarded as Record<string, unknown>;
    const headers = forwarded.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('[已脱敏]');
    expect(headers.Cookie).toBe('[已脱敏]');
  });
});

describe('shouldReportHttpError', () => {
  it('500 应上报', () => {
    expect(shouldReportHttpError(500)).toBe(true);
  });

  it('502 应上报', () => {
    expect(shouldReportHttpError(502)).toBe(true);
  });

  it('503 应上报', () => {
    expect(shouldReportHttpError(503)).toBe(true);
  });

  it('400 应不上报', () => {
    expect(shouldReportHttpError(400)).toBe(false);
  });

  it('401 应不上报', () => {
    expect(shouldReportHttpError(401)).toBe(false);
  });

  it('403 应不上报', () => {
    expect(shouldReportHttpError(403)).toBe(false);
  });

  it('404 应不上报', () => {
    expect(shouldReportHttpError(404)).toBe(false);
  });

  it('422 应不上报', () => {
    expect(shouldReportHttpError(422)).toBe(false);
  });
});

describe('isExpectedError', () => {
  it('AbortError 应视为预期错误', () => {
    const error = new Error('取消');
    error.name = 'AbortError';
    expect(isExpectedError(error)).toBe(true);
  });

  it('401 状态错误应视为预期错误', () => {
    const error = new Error('未授权') as Error & { status: number };
    error.status = 401;
    expect(isExpectedError(error)).toBe(true);
  });

  it('403 状态错误应视为预期错误', () => {
    const error = new Error('禁止访问') as Error & { status: number };
    error.status = 403;
    expect(isExpectedError(error)).toBe(true);
  });

  it('404 状态错误应视为预期错误', () => {
    const error = new Error('未找到') as Error & { status: number };
    error.status = 404;
    expect(isExpectedError(error)).toBe(true);
  });

  it('422 状态错误应视为预期错误', () => {
    const error = new Error('校验失败') as Error & { status: number };
    error.status = 422;
    expect(isExpectedError(error)).toBe(true);
  });

  it('500 状态错误不应视为预期错误', () => {
    const error = new Error('服务器错误') as Error & { status: number };
    error.status = 500;
    expect(isExpectedError(error)).toBe(false);
  });

  it('无 status 的普通错误不应视为预期错误', () => {
    const error = new Error('未知错误');
    expect(isExpectedError(error)).toBe(false);
  });
});
