import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
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

export type { ChatMessage };

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
  const partialContentRef = useRef('');
  const partialCtxRef = useRef<StreamContext | null>(null);
  const stoppedRef = useRef(false);
  const queryClient = useQueryClient();

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kb', kbId, 'conversations'] });
  }, [queryClient, kbId]);

  const fetchCitations = useCallback(
    async (conversationId: string, assistantMessageId: string) => {
      try {
        const res = await fetch(`/api/kbs/${kbId}/conversations/${conversationId}`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const msg = data.messages?.find((m: ChatMessage) => m.id === assistantMessageId);
        if (msg?.citations) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, citations: msg.citations } : m)),
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
      partialContentRef.current = '';
      partialCtxRef.current = null;
      stoppedRef.current = false;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const res = await fetch(chatStreamUrl(kbId), {
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

          if (res.status >= 500) {
            Sentry.captureException(new Error(errMsg), {
              tags: {
                route: `/api/kbs/${kbId}/chat`,
                status: res.status,
                method: 'POST',
                kbId,
              },
            });
          }
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          const errMsg = '无法读取响应流';
          setError(errMsg);
          setIsStreaming(false);
          Sentry.captureException(new Error(errMsg), {
            tags: { route: `/api/kbs/${kbId}/chat`, kbId },
          });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let ctx: StreamContext | null = null;
        let parseErrorCount = 0;
        const MAX_PARSE_ERRORS = 5;
        let hasReportedParseError = false;

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
                partialContentRef.current = accumulatedContent;
                setStreamingContent(accumulatedContent);
                if (event.conversationId && event.assistantMessageId) {
                  ctx = {
                    conversationId: event.conversationId,
                    assistantMessageId: event.assistantMessageId,
                  };
                  partialCtxRef.current = ctx;
                  setStreamContext(ctx);
                }
              } else if (event.type === 'delta' && event.conversationId) {
                ctx = {
                  conversationId: event.conversationId,
                  assistantMessageId: event.assistantMessageId,
                };
                partialCtxRef.current = ctx;
                setStreamContext(ctx);
              } else if (event.type === 'rejection') {
                setRejectionCode(event.code || 'unknown');
                setIsStreaming(false);
                setStreamingContent('');
                partialContentRef.current = '';
                partialCtxRef.current = null;
                invalidateConversations();
                return;
              } else if (event.type === 'error') {
                const errMsg = event.message || '生成回答时出错';
                setError(errMsg);
                setIsStreaming(false);
                setStreamingContent('');
                partialContentRef.current = '';
                partialCtxRef.current = null;
                Sentry.captureException(new Error(errMsg), {
                  tags: {
                    route: `/api/kbs/${kbId}/chat`,
                    kbId,
                    conversationId: ctx?.conversationId,
                    messageId: ctx?.assistantMessageId,
                  },
                });
                invalidateConversations();
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
                partialContentRef.current = '';
                partialCtxRef.current = null;

                if (finalCtx.assistantMessageId && finalCtx.conversationId) {
                  void fetchCitations(finalCtx.conversationId, finalCtx.assistantMessageId);
                }
                invalidateConversations();
                return;
              }
            } catch {
              parseErrorCount++;
              if (parseErrorCount >= MAX_PARSE_ERRORS && !hasReportedParseError) {
                hasReportedParseError = true;
                Sentry.captureException(new Error('SSE JSON 解析连续失败'), {
                  tags: {
                    route: `/api/kbs/${kbId}/chat`,
                    kbId,
                    parseErrorCount,
                  },
                });
              }
            }
          }
        }

        setIsStreaming(false);
        setStreamingContent('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // stop 路径已经在 stopStreaming 中提交 partial 与重置状态
          return;
        }
        const errMsg = err instanceof Error ? err.message : '网络错误';
        setError(errMsg);
        setIsStreaming(false);
        setStreamingContent('');
        onError?.(errMsg);
        Sentry.captureException(err instanceof Error ? err : new Error(errMsg), {
          tags: {
            route: `/api/kbs/${kbId}/chat`,
            kbId,
            conversationId: streamContext?.conversationId,
          },
        });
        invalidateConversations();
      }
    },
    [kbId, isStreaming, fetchCitations, onError, streamContext?.conversationId, invalidateConversations],
  );

  const stopStreaming = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    const partial = partialContentRef.current;
    const ctx = partialCtxRef.current;

    if (partial && ctx?.assistantMessageId) {
      const abortedMsg: ChatMessage = {
        id: ctx.assistantMessageId,
        role: 'assistant',
        content: partial,
        status: 'aborted',
      };
      setMessages((prev) => [...prev, abortedMsg]);
    }

    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent('');
    partialContentRef.current = '';
    partialCtxRef.current = null;
    if (ctx?.conversationId) {
      invalidateConversations();
    }
  }, [invalidateConversations]);

  const clearError = useCallback(() => setError(null), []);

  const loadHistory = useCallback((historyMessages: ChatMessage[]) => {
    setMessages(historyMessages);
    setRejectionCode(null);
    setError(null);
  }, []);

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

function chatStreamUrl(kbId: string): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  const devBaseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
  const baseUrl = configuredBaseUrl ?? devBaseUrl;

  if (!baseUrl) {
    return `/api/kbs/${kbId}/chat`;
  }

  return `${baseUrl.replace(/\/$/, '')}/kbs/${kbId}/chat`;
}

function authHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}
