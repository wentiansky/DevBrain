'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatHeader } from './chat-header';
import { ChatLoadingState, ChatNotFoundState } from './chat-loading';
import { ChatEmptyState } from './chat-empty-state';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { SourcePanel } from './source-panel';
import { useChatStream } from './use-chat-stream';
import { useChatCitation } from './use-chat-citation';
import { useChatConversation } from './use-chat-conversation';
import { useChatKbStatus } from './use-chat-kb-status';
import { SUGGESTED_QUESTIONS } from './chat-prompts';

interface ChatClientProps {
  kbId: string;
  conversationIdParam: string | null;
  initialPrompt: string;
}

export function ChatClient({
  kbId,
  conversationIdParam,
  initialPrompt,
}: ChatClientProps) {
  const router = useRouter();
  const { kb, kbLoading, hasDocuments, readyCount, canChat, statusSummary } =
    useChatKbStatus(kbId);

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
  } = useChatStream({ kbId, onError: () => {} });

  const {
    activeCitationId,
    activeMessageId,
    sourcePanelOpen,
    activeMessageCitations,
    handleCitationClick,
    closeSourcePanel,
  } = useChatCitation(messages);

  useChatConversation({
    kbId,
    conversationIdParam,
    streamConversationId: streamContext?.conversationId,
    loadHistory,
  });

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

  if (kbLoading) return <ChatLoadingState />;
  if (!kb) return <ChatNotFoundState onBack={() => router.push('/')} />;

  const showSuggest = canChat && messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <ChatHeader
          kbName={kb.name}
          statusSummary={statusSummary}
          onBack={() => router.push(`/kb/${kbId}`)}
        />

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
          onClose={closeSourcePanel}
        />
      )}
    </div>
  );
}
