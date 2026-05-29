import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedHomePage from '@/app/(protected)/page';

const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      accessToken: 'test-token',
      user: { id: 'u1', email: 'test@test.local', status: 'active', createdAt: '' },
      isInitialized: true,
    };
    return selector ? selector(state) : state;
  }),
}));

let mockKbs: Array<{ id: string; name: string; description?: string; createdAt: string; updatedAt: string }> = [];
let mockError = false;

vi.mock('@/lib/api-fetch', () => ({
  apiFetch: vi.fn((url: string, options?: RequestInit) => {
    if (mockError) {
      const err = new Error('加载失败') as Error & { status: number };
      err.status = 500;
      throw err;
    }
    if (url === '/api/kbs') {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        const newKb = {
          id: `kb-new-${Date.now()}`,
          name: body.name,
          description: body.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockKbs.unshift(newKb);
        return Promise.resolve(newKb);
      }
      return Promise.resolve({ items: mockKbs });
    }
    return Promise.resolve({});
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  mockKbs = [];
  mockError = false;
  mockRouterPush.mockReset();
});

describe('KB 首页', () => {
  it('无 KB 时显示空状态和创建入口', async () => {
    renderWithQuery(<ProtectedHomePage />);

    await waitFor(() => {
      expect(screen.getByText('还没有知识库')).toBeInTheDocument();
    });

    expect(
      screen.getByText('创建你的第一个个人知识库，上传文档并开始提问。'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '创建知识库' }),
    ).toBeInTheDocument();
  });

  it('从空状态创建 KB 后不跳转详情页，保留在列表页', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ProtectedHomePage />);

    await waitFor(() => {
      expect(screen.getByText('还没有知识库')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('输入知识库名称');
    await user.type(nameInput, '我的第一个KB');

    const submitButton = screen.getByRole('button', { name: '创建知识库' });
    await user.click(submitButton);

    // 验证没有调用 router.push（不跳转详情页）
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('有 KB 时显示列表', async () => {
    mockKbs = [
      {
        id: 'kb-1',
        name: '前端知识库',
        description: 'React/Vue 笔记',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ];

    renderWithQuery(<ProtectedHomePage />);

    await waitFor(() => {
      expect(screen.getByText('我的知识库')).toBeInTheDocument();
    });

    expect(screen.getByText('前端知识库')).toBeInTheDocument();
    expect(screen.getByText('React/Vue 笔记')).toBeInTheDocument();
    expect(screen.getByText('新建知识库')).toBeInTheDocument();
  });

  it('列表加载失败显示错误态和重试入口', async () => {
    mockError = true;
    renderWithQuery(<ProtectedHomePage />);

    await waitFor(() => {
      expect(screen.getByText('加载知识库失败')).toBeInTheDocument();
    });

    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('列表项点击可导航到详情页', async () => {
    mockKbs = [
      {
        id: 'kb-2',
        name: '后端知识库',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ];

    renderWithQuery(<ProtectedHomePage />);

    await waitFor(() => {
      expect(screen.getByText('后端知识库')).toBeInTheDocument();
    });

    const link = screen.getByText('后端知识库').closest('a');
    expect(link).toHaveAttribute('href', '/kb/kb-2');
  });
});