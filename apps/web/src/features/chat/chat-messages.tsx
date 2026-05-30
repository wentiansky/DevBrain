'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { CitationList } from './citation-chip';
import { SourcePanel } from './source-panel';
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

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  rejectionCode: string | null;
  error: string | null;
}

function StreamingMarkdown({ content }: { content: string }) {
  const [rendered, setRendered] = useState('');
  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= 80) {
      setRendered(content);
      lastUpdateRef.current = now;
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setRendered(content);
        lastUpdateRef.current = Date.now();
      });
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content]);

  return (
    <div className="max-w-none break-words whitespace-pre-wrap">
      {rendered}
    </div>
  );
}

function getRejectionMessage(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  switch (errorCode) {
    case 'rejection.no_ready_chunks':
      return '请先上传并等待文档处理完成后再提问';
    case 'rejection.no_recall_hits':
    case 'rejection.low_relevance':
      return '没有找到相关资料';
    case 'rejection.insufficient_context':
      return '现有资料不足以回答该问题';
    default:
      return null;
  }
}

function MessageBubble({
  message,
  activeCitationId,
  onCitationClick,
}: {
  message: ChatMessage;
  activeCitationId: string | null;
  onCitationClick: (c: CitationResponse) => void;
}) {
  const isUser = message.role === 'user';
  const isFailed = message.status === 'failed';
  const isRejected = message.errorCode?.startsWith('rejection.');
  const rejectionText = isRejected ? getRejectionMessage(message.errorCode) : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : isFailed
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted'
        }`}
      >
        {isRejected && rejectionText ? (
          <div className="text-sm text-muted-foreground">{rejectionText}</div>
        ) : isFailed ? (
          <div className="text-sm">
            {message.errorMessage || '生成回答时出错'}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationList
            citations={message.citations}
            activeCitationId={activeCitationId}
            onCitationClick={onCitationClick}
          />
        )}
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  streamingContent,
  isStreaming,
  rejectionCode,
  error,
}: ChatMessagesProps) {
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const allCitations = useMemo(() => {
    return messages
      .filter((m) => m.role === 'assistant' && m.citations)
      .flatMap((m) => m.citations!);
  }, [messages]);

  const handleCitationClick = (citation: CitationResponse) => {
    setActiveCitationId(citation.chunkId);
    setSourcePanelOpen(true);
  };

  const isMobile =
    typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              activeCitationId={activeCitationId}
              onCitationClick={handleCitationClick}
            />
          ))}

          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2.5">
                <StreamingMarkdown content={streamingContent} />
                <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse align-middle" />
              </div>
            </div>
          )}

          {rejectionCode && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-muted px-4 py-3 text-center max-w-md">
                <p className="text-sm text-muted-foreground">
                  {rejectionCode === 'no_ready_chunks' || rejectionCode === 'rejection.no_ready_chunks'
                    ? '请先上传并等待文档处理完成后再提问'
                    : '没有找到相关资料'}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-center max-w-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {sourcePanelOpen && allCitations.length > 0 && (
        <SourcePanel
          citations={allCitations}
          activeCitationId={activeCitationId}
          isOpen={sourcePanelOpen}
          isMobile={isMobile}
          onClose={() => setSourcePanelOpen(false)}
        />
      )}
    </div>
  );
}