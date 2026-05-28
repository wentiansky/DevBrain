import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/features/auth/register-form';
import { useAuthStore } from '@/stores/auth-store';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

const mockRegister = vi.fn();
const mockInitialize = vi.fn();

vi.mock('@/lib/api-fetch', () => ({
  authRegister: (...args: [string, string]) => mockRegister(...args),
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
  mockRegister.mockReset();
  mockInitialize.mockReset();
});

describe('RegisterForm - 注册表单组件', () => {
  it('user 存在时执行重定向并返回 null', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 't', user: mockUser });

    await act(async () => {
      render(<RegisterForm />);
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('注册 DevBrain')).not.toBeInTheDocument();
  });

  it('未初始化时显示登录验证状态', () => {
    useAuthStore.setState({ isInitialized: false, user: null });

    render(<RegisterForm />);

    expect(screen.getByText('正在验证登录状态...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument();
  });

  it('提交成功后显示 toast 并跳转到首页', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({ accessToken: 'token', user: mockUser });

    render(<RegisterForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'new@test.com');
    await user.type(screen.getByPlaceholderText('至少 8 个字符'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('new@test.com', 'SecurePass123');
    });

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('注册成功，欢迎使用 DevBrain');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('提交失败时显示服务端错误', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error('邮箱已被注册'));

    render(<RegisterForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'used@test.com');
    await user.type(screen.getByPlaceholderText('至少 8 个字符'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByText('邮箱已被注册')).toBeInTheDocument();
    });
  });

  it('密码少于 8 个字符时触发客户端校验', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('至少 8 个字符'), 'short');
    await user.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByText('密码至少 8 个字符')).toBeInTheDocument();
    });
  });

  it('邮箱格式无效时触发客户端校验', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'notemail');
    await user.type(screen.getByPlaceholderText('至少 8 个字符'), 'SecurePass123');

    const form = container.querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText('user@example.com');
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
});