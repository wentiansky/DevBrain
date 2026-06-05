import { describe, it, expect } from 'vitest';
import { shouldReportHttpError, isExpectedError } from '../sentry';

describe('api-fetch 上报过滤策略', () => {
  describe('5xx 服务器错误：上报', () => {
    it.each([500, 502, 503, 504])('状态码 %i 应上报', (status) => {
      expect(shouldReportHttpError(status)).toBe(true);
    });
  });

  describe('4xx 客户端错误：不上报', () => {
    it.each([400, 401, 403, 404, 409, 422, 429])('状态码 %i 应不上报', (status) => {
      expect(shouldReportHttpError(status)).toBe(false);
    });
  });

  describe('401/403 认证错误：不上报', () => {
    it('401 不应上报', () => {
      expect(shouldReportHttpError(401)).toBe(false);
    });

    it('403 不应上报', () => {
      expect(shouldReportHttpError(403)).toBe(false);
    });
  });

  describe('refresh 失败导致的登录跳转：不上报', () => {
    it('refresh 401 导致的登录过期错误应视为预期错误', () => {
      const error = new Error('登录已过期，请重新登录') as Error & {
        status: number;
      };
      error.status = 401;
      expect(isExpectedError(error)).toBe(true);
    });
  });

  describe('表单校验 4xx：不上报', () => {
    it('422 校验失败应视为预期错误', () => {
      const error = new Error('邮箱格式无效') as Error & { status: number };
      error.status = 422;
      expect(isExpectedError(error)).toBe(true);
    });
  });

  describe('用户取消 AbortError：不上报', () => {
    it('AbortError 应视为预期错误', () => {
      const error = new Error('The user aborted a request');
      error.name = 'AbortError';
      expect(isExpectedError(error)).toBe(true);
    });
  });

  describe('网络异常：应上报', () => {
    it('TypeError 应上报', () => {
      const error = new TypeError('Failed to fetch');
      expect(isExpectedError(error)).toBe(false);
    });
  });

  describe('500 服务器错误：应上报', () => {
    it('500 内部错误不应视为预期错误', () => {
      const error = new Error('Internal Server Error') as Error & {
        status: number;
      };
      error.status = 500;
      expect(isExpectedError(error)).toBe(false);
    });
  });
});
