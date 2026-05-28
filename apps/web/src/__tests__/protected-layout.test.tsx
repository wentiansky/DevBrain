import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ProtectedLayout from '@/app/(protected)/layout';
import { useAuthStore } from '@/stores/auth-store';

const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api-fetch', () => ({
  initializeAuth: vi.fn(),
  logout: vi.fn(),
}));

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
  mockRouterReplace.mockReset();
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

describe('ProtectedLayout - 路由守卫', () => {
  it('isInitialized=false 时显示加载状态', () => {
    useAuthStore.setState({ isInitialized: false, user: null });
    const { container } = render(
      <ProtectedLayout>
        <div data-testid="child">内容</div>
      </ProtectedLayout>,
    );

    expect(screen.getByText('正在加载...')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    const main = container.querySelector('main');
    expect(main).toBeNull();
  });

  it('isInitialized=true 且 user=null 时显示验证状态并跳转登录页', async () => {
    useAuthStore.setState({ isInitialized: true, user: null });

    await act(async () => {
      render(
        <ProtectedLayout>
          <div data-testid="child">内容</div>
        </ProtectedLayout>,
      );
    });

    expect(screen.getByText('正在验证登录状态...')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it('isInitialized=true 且 user 存在时渲染受保护内容', () => {
    useAuthStore.setState({
      isInitialized: true,
      accessToken: 'token-abc',
      user: mockUser,
    });

    render(
      <ProtectedLayout>
        <div data-testid="child">内容</div>
      </ProtectedLayout>,
    );

    expect(screen.getByText('DevBrain')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('内容')).toBeInTheDocument();
  });

  it('已登录时渲染 Header 和 children', () => {
    useAuthStore.setState({
      isInitialized: true,
      accessToken: 'token-abc',
      user: mockUser,
    });

    const { container } = render(
      <ProtectedLayout>
        <div data-testid="child">受保护内容</div>
      </ProtectedLayout>,
    );

    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });

  it('未登录时调用 initializeAuth', async () => {
    useAuthStore.setState({ isInitialized: false, user: null });

    await act(async () => {
      render(
        <ProtectedLayout>
          <div>内容</div>
        </ProtectedLayout>,
      );
    });

    const { initializeAuth } = await import('@/lib/api-fetch');
    expect(initializeAuth).toHaveBeenCalled();
  });
});