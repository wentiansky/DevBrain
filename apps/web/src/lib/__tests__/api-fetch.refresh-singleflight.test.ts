import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, getOrStartRefresh, initializeAuth } from '@/lib/api-fetch';
import { useAuthStore } from '@/stores/auth-store';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isInitialized: false,
  });
  vi.stubGlobal('fetch', vi.fn());
  Object.defineProperty(window, 'location', {
    value: {
      pathname: '/',
      search: '',
      href: '',
      assign: vi.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getOrStartRefresh single-flight', () => {
  it('并发 initializeAuth 与 apiFetch 401 时只发起一次 /auth/refresh', async () => {
    let refreshCallCount = 0;
    let resolveRefresh!: (v: Response) => void;
    const refreshDeferred = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    const firstAttemptUrls = new Set<string>();

    vi.mocked(fetch).mockImplementation((reqUrl) => {
      const urlStr = typeof reqUrl === 'string' ? reqUrl : String(reqUrl);
      if (urlStr === '/auth/refresh') {
        refreshCallCount++;
        return refreshDeferred;
      }
      if (!firstAttemptUrls.has(urlStr)) {
        firstAttemptUrls.add(urlStr);
        return Promise.resolve(new Response(JSON.stringify({}), { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));
    });

    const initPromise = initializeAuth();
    const apiPromise = apiFetch('/api/test');

    resolveRefresh(
      new Response(
        JSON.stringify({ accessToken: 'shared-token', user: mockUser }),
        { status: 200 },
      ),
    );

    await Promise.all([initPromise, apiPromise]);

    expect(refreshCallCount).toBe(1);
  });

  it('两个 apiFetch 并发 401 共享同一个 refresh', async () => {
    let refreshCallCount = 0;
    const firstAttemptUrls = new Set<string>();

    vi.mocked(fetch).mockImplementation((reqUrl) => {
      const urlStr = typeof reqUrl === 'string' ? reqUrl : String(reqUrl);
      if (urlStr === '/auth/refresh') {
        refreshCallCount++;
        return Promise.resolve(
          new Response(
            JSON.stringify({ accessToken: 'shared-token', user: mockUser }),
            { status: 200 },
          ),
        );
      }
      if (!firstAttemptUrls.has(urlStr)) {
        firstAttemptUrls.add(urlStr);
        return Promise.resolve(new Response(JSON.stringify({}), { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));
    });

    await Promise.all([apiFetch('/api/test1'), apiFetch('/api/test2')]);

    expect(refreshCallCount).toBe(1);
  });

  it('getOrStartRefresh 返回相同 Promise 实例给并发调用者', async () => {
    let refreshCallCount = 0;

    vi.mocked(fetch).mockImplementation((reqUrl) => {
      const urlStr = typeof reqUrl === 'string' ? reqUrl : String(reqUrl);
      if (urlStr === '/auth/refresh') {
        refreshCallCount++;
        return Promise.resolve(
          new Response(
            JSON.stringify({ accessToken: 'shared-token', user: mockUser }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const p1 = getOrStartRefresh();
    const p2 = getOrStartRefresh();

    expect(p1).toBe(p2);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(refreshCallCount).toBe(1);
  });

  it('第一次 refresh 完成后第二次调用重新发起新请求', async () => {
    let refreshCallCount = 0;

    vi.mocked(fetch).mockImplementation((reqUrl) => {
      const urlStr = typeof reqUrl === 'string' ? reqUrl : String(reqUrl);
      if (urlStr === '/auth/refresh') {
        refreshCallCount++;
        return Promise.resolve(
          new Response(
            JSON.stringify({ accessToken: `token-${refreshCallCount}`, user: mockUser }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const r1 = await getOrStartRefresh();
    expect(r1?.accessToken).toBe('token-1');

    const r2 = await getOrStartRefresh();
    expect(r2?.accessToken).toBe('token-2');

    expect(refreshCallCount).toBe(2);
  });
});