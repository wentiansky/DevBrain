import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  const historyQuery = useQuery<ChatMessage[]>({
    queryKey: ['kb', kbId, 'conversation', conversationIdParam],
    queryFn: async () => {
      if (!conversationIdParam) return [];
      const detail = await apiFetch<ConversationDetailResponse>(
        `/api/kbs/${kbId}/conversations/${conversationIdParam}`,
      );
      return (detail.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content ?? '',
        status: m.status,
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        citations: m.citations ?? undefined,
      }));
    },
    enabled: Boolean(conversationIdParam),
    retry: false,
  });

  useEffect(() => {
    if (conversationIdParam && historyQuery.data) {
      loadHistory(historyQuery.data);
    }
  }, [conversationIdParam, historyQuery.data, loadHistory]);

  useEffect(() => {
    if (streamConversationId && !conversationIdParam) {
      const url = `/kb/${kbId}/chat?conversation=${streamConversationId}`;
      router.replace(url, { scroll: false });
    }
  }, [streamConversationId, conversationIdParam, kbId, router]);

  return { isHistoryLoading: Boolean(conversationIdParam) && historyQuery.isFetching };
}
