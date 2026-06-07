import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';
import type { ConversationDetailResponse } from '@devbrain/api/client';
import type { ChatMessage } from './use-chat-stream';

interface UseChatConversationOptions {
  kbId: string;
  conversationIdParam: string | null;
  streamConversationId: string | undefined;
  loadHistory: (messages: ChatMessage[]) => void;
}

export function useChatConversation({
  kbId,
  conversationIdParam,
  streamConversationId,
  loadHistory,
}: UseChatConversationOptions) {
  const router = useRouter();

  const fetchAndLoadHistory = useCallback(
    async (convId: string) => {
      try {
        const detail = await apiFetch<ConversationDetailResponse>(
          `/api/kbs/${kbId}/conversations/${convId}`,
        );
        const historyMessages: ChatMessage[] = (detail.messages ?? []).map(
          (m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content ?? '',
            status: m.status,
            errorCode: m.errorCode,
            errorMessage: m.errorMessage,
            citations: m.citations ?? undefined,
          }),
        );
        loadHistory(historyMessages);
      } catch {
        // 历史加载失败不阻塞主流程
      }
    },
    [kbId, loadHistory],
  );

  useEffect(() => {
    if (conversationIdParam) {
      fetchAndLoadHistory(conversationIdParam);
    }
  }, [conversationIdParam, fetchAndLoadHistory]);

  useEffect(() => {
    if (streamConversationId && !conversationIdParam) {
      const url = `/kb/${kbId}/chat?conversation=${streamConversationId}`;
      router.replace(url, { scroll: false });
    }
  }, [streamConversationId, conversationIdParam, kbId, router]);
}
