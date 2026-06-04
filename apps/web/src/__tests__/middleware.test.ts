import { describe, it, expect, vi } from 'vitest';
import { middleware } from '@/middleware';

function mockRequest(opts: {
  pathname: string;
  search?: string;
  hasRefreshCookie?: boolean;
  url?: string;
}) {
  const search = opts.search ?? '';
  const searchParams = new URLSearchParams(search);
  const url = opts.url ?? `http://localhost:3000${opts.pathname}${search}`;

  return {
    cookies: {
      has: vi.fn().mockReturnValue(opts.hasRefreshCookie ?? false),
    },
    nextUrl: {
      pathname: opts.pathname,
      search,
      searchParams,
    },
    url,
  } as unknown as Parameters<typeof middleware>[0];
}

function isRedirect(res: Response, expectedLocation: string): boolean {
  return (
    res.status === 307 &&
    res.headers.get('Location') === expectedLocation
  );
}

function isPassThrough(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

describe('middleware - 路由认证保护', () => {
  describe('未登录用户访问受保护页面', () => {
    it('访问 / 时跳转到 /login?next=/', () => {
      const req = mockRequest({ pathname: '/', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/login?next=/')).toBe(true);
    });

    it('访问 /kb/123 时跳转到 /login?next=/kb/123', () => {
      const req = mockRequest({ pathname: '/kb/123', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/login?next=/kb/123')).toBe(true);
    });

    it('访问 /kb/123/chat 时跳转到 /login?next=/kb/123/chat', () => {
      const req = mockRequest({ pathname: '/kb/123/chat', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/login?next=/kb/123/chat')).toBe(true);
    });

    it('访问 /kb/123?tab=docs 时 next 参数保留查询字符串', () => {
      const req = mockRequest({
        pathname: '/kb/123',
        search: '?tab=docs',
        hasRefreshCookie: false,
      });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/login?next=/kb/123%3Ftab%3Ddocs')).toBe(true);
    });
  });

  describe('已登录用户访问认证页面', () => {
    it('访问 /login 时跳转到 /', () => {
      const req = mockRequest({ pathname: '/login', hasRefreshCookie: true });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/')).toBe(true);
    });

    it('访问 /register 时跳转到 /', () => {
      const req = mockRequest({ pathname: '/register', hasRefreshCookie: true });
      const res = middleware(req);
      expect(isRedirect(res, 'http://localhost:3000/')).toBe(true);
    });
  });

  describe('已登录用户访问受保护页面', () => {
    it('访问 / 时放行并设置私有缓存头', () => {
      const req = mockRequest({ pathname: '/', hasRefreshCookie: true });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
      expect(res.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, must-revalidate',
      );
    });

    it('访问 /kb/123 时放行并设置私有缓存头', () => {
      const req = mockRequest({ pathname: '/kb/123', hasRefreshCookie: true });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
      expect(res.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, must-revalidate',
      );
    });
  });

  describe('未登录用户访问认证页面', () => {
    it('访问 /login 时放行并设置私有缓存头（cookie-sensitive）', () => {
      const req = mockRequest({ pathname: '/login', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
      expect(res.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, must-revalidate',
      );
    });

    it('访问 /register 时放行并设置私有缓存头（cookie-sensitive）', () => {
      const req = mockRequest({ pathname: '/register', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
      expect(res.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, must-revalidate',
      );
    });
  });

  describe('会话过期防循环', () => {
    it('已登录用户访问 /login?error=session_expired 时放行不跳转', () => {
      const req = mockRequest({
        pathname: '/login',
        search: '?error=session_expired',
        hasRefreshCookie: true,
      });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
    });
  });

  describe('非受保护路径', () => {
    it('访问 /api/health 时直接放行', () => {
      const req = mockRequest({ pathname: '/api/health', hasRefreshCookie: false });
      const res = middleware(req);
      expect(isPassThrough(res)).toBe(true);
    });
  });
});