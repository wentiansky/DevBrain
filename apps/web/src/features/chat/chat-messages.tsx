'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CitationList } from './citation-chip';
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
  activeCitationId: string | null;
  activeMessageId: string | null;
  onCitationClick: (c: CitationResponse, messageId: string) => void;
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
    <div className="break-words whitespace-pre-wrap text-sm leading-relaxed">
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
      return '没有找到相关资料，换个问题或先补充文档试试';
    case 'rejection.insufficient_context':
      return '现有资料不足以回答该问题';
    default:
      return null;
  }
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground break-words whitespace-pre-wrap sm:max-w-[75%]">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  activeCitationId,
  onCitationClick,
}: {
  message: ChatMessage;
  activeCitationId: string | null;
  onCitationClick: (c: CitationResponse, messageId: string) => void;
}) {
  const isFailed = message.status === 'failed';
  const isAborted = message.status === 'aborted';
  const isRejected = message.errorCode?.startsWith('rejection.');
  const rejectionText = isRejected ? getRejectionMessage(message.errorCode) : null;

  if (isRejected && rejectionText) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-dashed border-border bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground">
          {rejectionText}
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive/5 px-3.5 py-2 text-sm text-destructive">
          {message.errorMessage || '生成回答时出错，请稍后重试'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] sm:max-w-[85%]">
        <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-card/50 px-3.5 py-2.5 text-sm leading-relaxed text-foreground break-words whitespace-pre-wrap">
          {message.content}
          {isAborted && (
            <span className="ml-1 align-middle text-xs text-muted-foreground">
              · 已停止
            </span>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <CitationList
            citations={message.citations}
            activeCitationId={activeCitationId}
            onCitationClick={(c) => onCitationClick(c, message.id)}
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
  activeCitationId,
  activeMessageId,
  onCitationClick,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 80;
    stickToBottomRef.current = nearBottom;
    setShowJumpBottom(!nearBottom);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [messages, streamingContent, scrollToBottom]);

  const showFirstTokenLoading = isStreaming && !streamingContent;

  return (
    <div className="relative flex flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-4"
      >
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-3 sm:px-6">
          {messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                activeCitationId={
                  activeMessageId === message.id ? activeCitationId : null
                }
                onCitationClick={onCitationClick}
              />
            ),
          )}

          {showFirstTokenLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-card/50 px-3.5 py-3">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
                </div>
              </div>
            </div>
          )}

          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-border/60 bg-card/50 px-3.5 py-2.5 sm:max-w-[85%]">
                <StreamingMarkdown content={streamingContent} />
                <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse align-middle bg-foreground/70" />
              </div>
            </div>
          )}

          {rejectionCode && !isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-dashed border-border bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground">
                {getRejectionMessage(rejectionCode) ||
                  getRejectionMessage(`rejection.${rejectionCode}`) ||
                  '没有找到相关资料'}
              </div>
            </div>
          )}

          {error && !isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive/5 px-3.5 py-2 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}

          <div ref={endRef} className="h-px" />
        </div>
      </div>

      {showJumpBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stickToBottomRef.current = true;
              scrollToBottom('smooth');
            }}
            className="pointer-events-auto h-8 gap-1.5 rounded-full bg-background/90 px-3 shadow-sm backdrop-blur"
            aria-label="回到底部"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span className="text-xs">回到底部</span>
          </Button>
        </div>
      )}
    </div>
  );
}
