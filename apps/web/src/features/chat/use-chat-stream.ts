import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { CitationResponse } from '@devbrain/api/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  citations?: CitationResponse[];
}

interface StreamContext {
  conversationId: string;
  assistantMessageId: string;
}

export interface UseChatStreamOptions {
  kbId: string;
  onError?: (message: string) => void;
}

export function useChatStream({ kbId, onError }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [rejectionCode, setRejectionCode] = useState<string | null>(null);
  const [streamContext, setStreamContext] = useState<StreamContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCitations = useCallback(
    async (conversationId: string, assistantMessageId: string) => {
      try {
        const res = await fetch(
          `/api/kbs/${kbId}/conversations/${conversationId}`,
          { credentials: 'include', headers: authHeaders() },
        );
        if (!res.ok) return;
        const data = await res.json();
        const msg = data.messages?.find(
          (m: ChatMessage) => m.id === assistantMessageId,
        );
        if (msg?.citations) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, citations: msg.citations }
                : m,
            ),
          );
        }
      } catch {
        // 获取 citations 失败，不阻塞主流程
      }
    },
    [kbId],
  );

  const sendMessage = useCallback(
    async (content: string, conversationId?: string) => {
      if (!content.trim() || isStreaming) return;

      setError(null);
      setRejectionCode(null);
      setIsStreaming(true);
      setStreamingContent('');

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const res = await fetch(`/api/kbs/${kbId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            message: content.trim(),
            conversationId,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          const errMsg = errorBody.message || `请求失败 (${res.status})`;
          setError(errMsg);
          setIsStreaming(false);
          onError?.(errMsg);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError('无法读取响应流');
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let ctx: StreamContext | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
              const event = JSON.parse(trimmed.slice(6));

              if (event.type === 'delta' && event.content) {
                accumulatedContent += event.content;
                setStreamingContent(accumulatedContent);
                if (event.conversationId && event.assistantMessageId) {
                  ctx = {
                    conversationId: event.conversationId,
                    assistantMessageId: event.assistantMessageId,
                  };
                  setStreamContext(ctx);
                }
              } else if (event.type === 'delta' && event.conversationId) {
                ctx = {
                  conversationId: event.conversationId,
                  assistantMessageId: event.assistantMessageId,
                };
                setStreamContext(ctx);
              } else if (event.type === 'rejection') {
                setRejectionCode(event.code || 'unknown');
                setIsStreaming(false);
                setStreamingContent('');
                return;
              } else if (event.type === 'error') {
                setError(event.message || '生成回答时出错');
                setIsStreaming(false);
                setStreamingContent('');
                return;
              } else if (event.type === 'done') {
                const finalCtx = ctx || {
                  conversationId: event.conversationId,
                  assistantMessageId: event.assistantMessageId,
                };

                const assistantMsg: ChatMessage = {
                  id: finalCtx.assistantMessageId,
                  role: 'assistant',
                  content: accumulatedContent,
                  status: 'completed',
                };

                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingContent('');
                setIsStreaming(false);

                if (finalCtx.assistantMessageId && finalCtx.conversationId) {
                  void fetchCitations(
                    finalCtx.conversationId,
                    finalCtx.assistantMessageId,
                  );
                }
                return;
              }
            } catch {
              // 忽略解析错误的行
            }
          }
        }

        setIsStreaming(false);
        setStreamingContent('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const errMsg = err instanceof Error ? err.message : '网络错误';
        setError(errMsg);
        setIsStreaming(false);
        setStreamingContent('');
        onError?.(errMsg);
      }
    },
    [kbId, isStreaming, fetchCitations, onError],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent('');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const loadHistory = useCallback(
    (historyMessages: ChatMessage[]) => {
      setMessages(historyMessages);
    },
    [],
  );

  return {
    messages,
    streamingContent,
    isStreaming,
    rejectionCode,
    streamContext,
    error,
    sendMessage,
    stopStreaming,
    clearError,
    loadHistory,
    clearRejection: () => setRejectionCode(null),
  };
}

function authHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}