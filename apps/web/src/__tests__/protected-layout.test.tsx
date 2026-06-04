import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from '@/app/(protected)/layout';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

describe('ProtectedLayout - RSC 静态外壳', () => {
  it('未初始化时渲染骨架 header 和 main 容器', () => {
    useAuthStore.setState({ isInitialized: false, user: null });
    const { container } = render(
      <ProtectedLayout>
        <div data-testid="child">内容</div>
      </ProtectedLayout>,
    );

    expect(screen.getByText('DevBrain')).toBeInTheDocument();
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('未初始化时不展示纯文本 loading 占位', () => {
    useAuthStore.setState({ isInitialized: false, user: null });
    render(
      <ProtectedLayout>
        <div>内容</div>
      </ProtectedLayout>,
    );

    expect(screen.queryByText('正在加载...')).not.toBeInTheDocument();
    expect(screen.queryByText('正在验证登录状态...')).not.toBeInTheDocument();
  });

  it('初始化后无 user 时不渲染 children（ProtectedShell 返回 null 等待 redirect）', () => {
    useAuthStore.setState({
      isInitialized: true,
      accessToken: null,
      user: null,
    });

    render(
      <ProtectedLayout>
        <div data-testid="child">受保护内容</div>
      </ProtectedLayout>,
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.queryByText('受保护内容')).not.toBeInTheDocument();
  });

  it('初始化且有 user 时渲染真实 Header 和 children', () => {
    useAuthStore.setState({
      isInitialized: true,
      accessToken: 'token-abc',
      user: mockUser,
    });

    render(
      <ProtectedLayout>
        <div data-testid="child">受保护内容</div>
      </ProtectedLayout>,
    );

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });
});