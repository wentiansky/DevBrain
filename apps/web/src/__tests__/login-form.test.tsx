import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/features/auth/login-form';
import { useAuthStore } from '@/stores/auth-store';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGetNext = vi.fn().mockReturnValue(null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: mockGetNext }),
}));

const mockLogin = vi.fn();
const mockInitialize = vi.fn();

vi.mock('@/lib/api-fetch', () => ({
  authLogin: (...args: [string, string]) => mockLogin(...args),
  initializeAuth: () => mockInitialize(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
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
    isInitialized: true,
  });
  mockPush.mockReset();
  mockReplace.mockReset();
  mockGetNext.mockReset().mockReturnValue(null);
  mockLogin.mockReset();
  mockInitialize.mockReset();
});

describe('LoginForm - 登录表单组件', () => {
  it('user 存在时执行重定向并返回 null', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 't', user: mockUser });

    await act(async () => {
      render(<LoginForm />);
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('登录 DevBrain')).not.toBeInTheDocument();
  });

  it('user 存在且携带 next 参数时跳转到 next', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 't', user: mockUser });
    mockGetNext.mockReturnValue('/dashboard');

    await act(async () => {
      render(<LoginForm />);
    });

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('user 存在但 next 为恶意绝对路径时忽略 next', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 't', user: mockUser });
    mockGetNext.mockReturnValue('https://evil.com');

    await act(async () => {
      render(<LoginForm />);
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('未初始化时显示登录验证状态', () => {
    useAuthStore.setState({ isInitialized: false, user: null });

    render(<LoginForm />);

    expect(screen.getByText('正在验证登录状态...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument();
  });

  it('提交成功后显示 toast 并跳转', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ accessToken: 'token', user: mockUser });
    useAuthStore.setState({ isInitialized: true, user: null });

    render(<LoginForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('输入密码'), 'password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('登录成功');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('提交成功后携带 next 参数跳转', async () => {
    const user = userEvent.setup();
    mockGetNext.mockReturnValue('/kb/123');
    mockLogin.mockResolvedValue({ accessToken: 'token', user: mockUser });

    render(<LoginForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('输入密码'), 'password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/kb/123');
    });
  });

  it('提交失败时显示服务端错误', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('邮箱或密码错误'));

    render(<LoginForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'wrong@test.com');
    await user.type(screen.getByPlaceholderText('输入密码'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument();
    });
  });

  it('未输入邮箱时提交触发客户端校验', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByPlaceholderText('输入密码'), 'password');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
    });
  });
});