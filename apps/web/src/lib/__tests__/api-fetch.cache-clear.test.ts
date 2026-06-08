import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authLogin, authRegister, logout } from '@/lib/api-fetch';
import { getQueryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

const otherUser = {
  id: 'user-2',
  email: 'other@example.com',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  // 重置 auth store
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isInitialized: false,
  });
  // 清掉单例 QueryClient 内残留的 cache，保持测试间隔离
  getQueryClient().clear();
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

function seedKbCache(payload: unknown) {
  const qc = getQueryClient();
  qc.setQueryData(['kbs'], payload);
  return qc;
}

describe('用户切换时清理 QueryClient cache', () => {
  it('logout 后清空所有 query cache', async () => {
    const qc = seedKbCache({ items: [{ id: 'kb-a', name: '用户 A 的库' }] });
    useAuthStore.setState({
      accessToken: 'token-a',
      user: mockUser,
      isInitialized: true,
    });

    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    logout();
    await new Promise((r) => setTimeout(r, 0));

    expect(qc.getQueryData(['kbs'])).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(window.location.href).toBe('/');
  });

  it('authLogin 成功时清掉旧用户的 cache，再写入新用户 auth', async () => {
    const qc = seedKbCache({ items: [{ id: 'kb-a', name: '用户 A 的库' }] });
    useAuthStore.setState({
      accessToken: 'token-a',
      user: mockUser,
      isInitialized: true,
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'token-b', user: otherUser }),
        { status: 200 },
      ),
    );

    await authLogin('other@example.com', 'pw');

    expect(qc.getQueryData(['kbs'])).toBeUndefined();
    expect(useAuthStore.getState().user?.id).toBe('user-2');
    expect(useAuthStore.getState().accessToken).toBe('token-b');
  });

  it('authRegister 成功时同样清掉旧 cache', async () => {
    const qc = seedKbCache({ items: [{ id: 'kb-a' }] });

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'token-b', user: otherUser }),
        { status: 200 },
      ),
    );

    await authRegister('other@example.com', 'pw');

    expect(qc.getQueryData(['kbs'])).toBeUndefined();
    expect(useAuthStore.getState().user?.id).toBe('user-2');
  });
});
