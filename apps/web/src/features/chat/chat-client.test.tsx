import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatClient } from './chat-client';
import { apiFetch } from '@/lib/api-fetch';

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/api-fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('./chat-empty-state', () => ({
  ChatEmptyState: ({ mode }: { mode: string }) => (
    <div data-testid={`chat-empty-${mode}`} />
  ),
}));

vi.mock('./chat-messages', () => ({
  ChatMessages: ({ messages }: { messages: Array<{ content: string }> }) => (
    <div data-testid="chat-messages">
      {messages.map((message) => (
        <span key={message.content}>{message.content}</span>
      ))}
    </div>
  ),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ChatClient', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    vi.mocked(apiFetch).mockReset();
  });

  it('带历史会话进入时，历史加载完成前不显示新对话建议空态', async () => {
    const history = createDeferred<{
      messages: Array<{ id: string; role: string; content: string; status: string }>;
    }>();

    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url === '/api/kbs/kb-chat-1') {
        return Promise.resolve({
          id: 'kb-chat-1',
          name: '测试知识库',
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        });
      }
      if (url === '/api/kbs/kb-chat-1/documents') {
        return Promise.resolve({
          items: [{ id: 'doc-1', originalName: 'note.md', status: 'ready' }],
        });
      }
      if (url === '/api/kbs/kb-chat-1/conversations/conv-1') {
        return history.promise;
      }
      return Promise.reject(new Error(`未 mock 的请求：${url}`));
    });

    renderWithQuery(
      <ChatClient
        kbId="kb-chat-1"
        conversationIdParam="conv-1"
        initialPrompt=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('chat-empty-suggest')).not.toBeInTheDocument();

    history.resolve({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '历史问题',
          status: 'completed',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('历史问题')).toBeInTheDocument();
    });
  });
});
