'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useChatStream } from '@/features/chat/use-chat-stream';
import { ChatMessages } from '@/features/chat/chat-messages';
import { ChatInput } from '@/features/chat/chat-input';
import { ChatEmptyState } from '@/features/chat/chat-empty-state';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-fetch';
import { useDocumentList } from '@/features/documents/use-documents';
import type { ConversationDetailResponse } from '@devbrain/api/client';

interface KbInfo {
  id: string;
  name: string;
  description?: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const kbId = params.id as string;
  const conversationIdParam = searchParams.get('conversation');

  const { data: kb, isLoading: kbLoading } = useQuery<KbInfo>({
    queryKey: ['kb', kbId],
    queryFn: () => apiFetch<KbInfo>(`/api/kbs/${kbId}`),
  });

  const { data: docList } = useDocumentList(kbId);

  const {
    messages,
    streamingContent,
    isStreaming,
    rejectionCode,
    error,
    streamContext,
    sendMessage,
    clearError,
    clearRejection,
    loadHistory,
  } = useChatStream({
    kbId,
    onError: () => {},
  });

  const fetchAndLoadHistory = useCallback(
    async (convId: string) => {
      try {
        const detail = await apiFetch<ConversationDetailResponse>(
          `/api/kbs/${kbId}/conversations/${convId}`,
        );
        const historyMessages = (detail.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content ?? '',
          status: m.status,
          errorCode: m.errorCode,
          errorMessage: m.errorMessage,
          citations: m.citations ?? undefined,
        }));
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
    if (streamContext?.conversationId && !conversationIdParam) {
      const url = `/kb/${kbId}/chat?conversation=${streamContext.conversationId}`;
      router.replace(url, { scroll: false });
    }
  }, [streamContext?.conversationId, conversationIdParam, kbId, router]);

  if (kbLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">正在加载...</p>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center py-16">
        <p className="text-sm text-destructive">知识库不存在或无权访问</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/')}
        >
          返回首页
        </Button>
      </div>
    );
  }

  const docs = docList?.items ?? [];
  const hasDocuments = docs.length > 0;
  const hasReadyDocuments = docs.some((d) => d.status === 'ready');
  const canChat = hasReadyDocuments;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/kb/${kbId}`)}
        >
          ← 返回
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{kb.name}</h1>
          {kb.description && (
            <p className="text-xs text-muted-foreground truncate">
              {kb.description}
            </p>
          )}
        </div>
      </div>

      {!canChat ? (
        <ChatEmptyState
          kbId={kbId}
          hasDocuments={hasDocuments}
        />
      ) : (
        <>
          <ChatMessages
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            rejectionCode={rejectionCode}
            error={error}
          />
          <ChatInput
            onSend={(msg) => {
              clearError();
              clearRejection();
              const convId = streamContext?.conversationId;
              sendMessage(msg, convId);
            }}
            isStreaming={isStreaming}
            disabled={!canChat}
          />
        </>
      )}
    </div>
  );
}