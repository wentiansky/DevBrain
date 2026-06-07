'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useChatStream } from '@/features/chat/use-chat-stream';
import { ChatMessages } from '@/features/chat/chat-messages';
import { ChatInput } from '@/features/chat/chat-input';
import { ChatEmptyState } from '@/features/chat/chat-empty-state';
import { SourcePanel } from '@/features/chat/source-panel';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-fetch';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentList } from '@/features/documents/use-documents';
import type {
  CitationResponse,
  ConversationDetailResponse,
} from '@devbrain/api/client';

interface KbInfo {
  id: string;
  name: string;
  description?: string;
}

const SUGGESTED_QUESTIONS = [
  '这个知识库主要讲了什么？',
  '帮我列出最关键的几个要点',
  '有什么需要特别注意的细节？',
];

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const kbId = params.id as string;
  const conversationIdParam = searchParams.get('conversation');
  const initialPrompt = searchParams.get('prompt') ?? '';

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
    stopStreaming,
    clearError,
    clearRejection,
    loadHistory,
  } = useChatStream({
    kbId,
    onError: () => {},
  });

  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);

  const activeMessageCitations = useMemo(() => {
    if (!activeMessageId) return [];
    const msg = messages.find((m) => m.id === activeMessageId);
    return msg?.citations ?? [];
  }, [messages, activeMessageId]);

  const handleCitationClick = useCallback(
    (c: CitationResponse, messageId: string) => {
      setActiveCitationId(c.chunkId);
      setActiveMessageId(messageId);
      setSourcePanelOpen(true);
    },
    [],
  );

  const handleSend = useCallback(
    (content: string) => {
      clearError();
      clearRejection();
      const convId =
        streamContext?.conversationId ?? conversationIdParam ?? undefined;
      sendMessage(content, convId);
    },
    [
      clearError,
      clearRejection,
      streamContext?.conversationId,
      conversationIdParam,
      sendMessage,
    ],
  );

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
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-16" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <Skeleton className="h-48 w-full max-w-lg rounded-lg" />
        </div>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
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
  const readyCount = docs.filter((d) => d.status === 'ready').length;
  const processingCount = docs.filter(
    (d) => d.status === 'queued' || d.status === 'processing',
  ).length;
  const canChat = readyCount > 0;
  const showSuggest = canChat && messages.length === 0 && !isStreaming;

  const statusSummary = canChat
    ? `${readyCount} 个文档可检索${processingCount > 0 ? ` · ${processingCount} 处理中` : ''}`
    : kb.description || '该知识库暂无可检索文档';

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <div className="bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[800px] items-center gap-3 px-3 py-1.5 sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/kb/${kbId}`)}
              className="-ml-2 h-7 gap-1 px-2 text-xs"
              aria-label="返回知识库"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">返回</span>
            </Button>
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="truncate text-sm font-semibold">{kb.name}</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {statusSummary}
              </p>
            </div>
          </div>
        </div>

        {!canChat ? (
          <ChatEmptyState
            kbId={kbId}
            hasDocuments={hasDocuments}
            mode="no-ready"
          />
        ) : (
          <>
            {showSuggest ? (
              <ChatEmptyState
                kbId={kbId}
                hasDocuments={hasDocuments}
                mode="suggest"
                kbName={kb.name}
                readyCount={readyCount}
                suggestions={SUGGESTED_QUESTIONS}
                onSuggest={handleSend}
              />
            ) : (
              <ChatMessages
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                rejectionCode={rejectionCode}
                error={error}
                activeCitationId={activeCitationId}
                activeMessageId={activeMessageId}
                onCitationClick={handleCitationClick}
              />
            )}
            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={stopStreaming}
              disabled={!canChat}
              initialValue={initialPrompt}
            />
          </>
        )}
      </div>

      {sourcePanelOpen && activeMessageCitations.length > 0 && (
        <SourcePanel
          citations={activeMessageCitations}
          activeCitationId={activeCitationId}
          onClose={() => setSourcePanelOpen(false)}
        />
      )}
    </div>
  );
}
