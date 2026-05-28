import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch, authLogin, authRegister, authRefresh, authLogout } from './api-fetch';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  status: 'active',
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isInitialized: false,
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('should send requests with credentials: include', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    await apiFetch('/api/test');

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('should attach Authorization header when access token exists', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-abc',
      user: mockUser,
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    await apiFetch('/api/test');

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
      }),
    );
  });

  it('should attach Authorization header for /auth/me (protected endpoint)', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-abc',
      user: mockUser,
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    await apiFetch('/auth/me');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer token-abc');
  });

  it('should not attach Authorization header for anonymous /auth/login', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-abc',
      user: mockUser,
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: 'x', user: mockUser }), { status: 200 }),
    );

    await authLogin('test@example.com', 'password');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });

  it('should trigger 401 refresh and retry for /auth/me', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'old-token',
      user: mockUser,
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: 'new-token', user: mockUser }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ email: 'test@example.com' }), { status: 200 }),
      );

    const result = await apiFetch('/auth/me');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ email: 'test@example.com' });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('should retry after 401 with successful refresh', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: 'new-token', user: mockUser }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'retry-ok' }), { status: 200 }),
      );

    const result = await apiFetch<{ data: string }>('/api/test');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ data: 'retry-ok' });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('should clear auth and throw when refresh itself returns 401', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'old-token',
      user: mockUser,
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }));

    // The redirect to login happens in browser (window.location.href), so we just check the store
    await expect(apiFetch('/api/test')).rejects.toThrow('登录已过期');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should not recursively refresh when /auth/refresh itself gets 401', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 401 }));

    const result = await authRefresh();

    expect(result).toBeNull();
  });

  it('should share a single refresh across concurrent 401s (single-flight)', async () => {
    let refreshCalls = 0;
    const firstAttemptUrls = new Set<string>();
    const hasRefreshed = { value: false };

    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : String(url);
      if (urlStr === '/auth/refresh') {
        refreshCalls++;
        hasRefreshed.value = true;
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
      return Promise.resolve(
        new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
      );
    });

    await Promise.all([apiFetch('/api/test1'), apiFetch('/api/test2')]);

    expect(refreshCalls).toBe(1);
  });

  it('should throw on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: '服务器错误' }), { status: 500 }),
    );

    await expect(apiFetch('/api/test')).rejects.toThrow('服务器错误');
  });

  it('should return undefined for 204 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await apiFetch('/api/test');
    expect(result).toBeUndefined();
  });
});

describe('auth helpers', () => {
  it('authLogin should call /auth/login and set store', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'login-token', user: mockUser }),
        { status: 200 },
      ),
    );

    const result = await authLogin('test@example.com', 'password');

    expect(result.accessToken).toBe('login-token');
    expect(result.user.email).toBe('test@example.com');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('login-token');
    expect(state.isInitialized).toBe(true);
  });

  it('authRegister should call /auth/register and set store', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'reg-token', user: mockUser }),
        { status: 201 },
      ),
    );

    const result = await authRegister('new@example.com', 'SecurePass1');

    expect(result.accessToken).toBe('reg-token');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('reg-token');
  });

  it('authRefresh should return null on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 401 }),
    );

    const result = await authRefresh();

    expect(result).toBeNull();
  });

  it('authLogout should not throw on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    await expect(authLogout()).resolves.toBeUndefined();
  });
});