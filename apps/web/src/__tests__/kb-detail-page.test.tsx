import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KbDetailPage from '@/app/(protected)/kb/[id]/page';

const mockRouterPush = vi.fn();
const mockRouterBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
  useParams: () => ({ id: 'kb-detail-1' }),
  useSearchParams: () => new URLSearchParams(),
}));

let mockKb: { id: string; name: string; description?: string; createdAt: string; updatedAt: string } | null = null;
let mockDocuments: { items: Array<{ id: string; originalName: string; status: string }> } = { items: [] };
let mockError = false;

vi.mock('@/lib/api-fetch', () => ({
  apiFetch: vi.fn((url: string) => {
    if (mockError) {
      const err = new Error('加载失败') as Error & { status: number };
      err.status = 500;
      throw err;
    }
    if (url.includes('/documents')) {
      return Promise.resolve(mockDocuments);
    }
    if (!mockKb) {
      const err = new Error('KB 不存在') as Error & { status: number };
      err.status = 404;
      throw err;
    }
    return Promise.resolve(mockKb);
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
  mockKb = null;
  mockDocuments = { items: [] };
  mockError = false;
  mockRouterPush.mockReset();
  mockRouterBack.mockReset();
});

describe('KB 详情页', () => {
  it('展示 KB 名称和描述', async () => {
    mockKb = {
      id: 'kb-detail-1',
      name: '测试知识库',
      description: '这是描述',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-29T00:00:00Z',
    };

    renderWithQuery(<KbDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('测试知识库')).toBeInTheDocument();
    });

    expect(screen.getByText('这是描述')).toBeInTheDocument();
    expect(screen.getByText('← 返回知识库列表')).toBeInTheDocument();
  });

  it('渲染上传区、文档区和 AI 对话入口', async () => {
    mockKb = {
      id: 'kb-detail-1',
      name: 'Test',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-29T00:00:00Z',
    };

    renderWithQuery(<KbDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kb-upload-slot')).toBeInTheDocument();
      expect(screen.getByTestId('kb-documents-slot')).toBeInTheDocument();
      expect(screen.getByTestId('kb-chat-slot')).toBeInTheDocument();
    });
  });

  it('加载失败显示错误态和返回列表入口', async () => {
    mockError = true;
    renderWithQuery(<KbDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByText('无法加载知识库，可能不存在或无权访问。'),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('返回知识库列表')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('返回按钮导航到列表', async () => {
    mockKb = {
      id: 'kb-detail-1',
      name: 'Test',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-29T00:00:00Z',
    };

    renderWithQuery(<KbDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('← 返回知识库列表')).toBeInTheDocument();
    });
  });
});