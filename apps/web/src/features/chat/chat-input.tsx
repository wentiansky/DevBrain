'use client';

import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  placeholder = '提问关于该知识库的问题…  (Enter 发送, Shift+Enter 换行)',
  initialValue = '',
}: ChatInputProps) {
  const [input, setInput] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isStreaming || disabled) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canStop = isStreaming && typeof onStop === 'function';
  const canSend = !isStreaming && !disabled && input.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-background/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur"
    >
      <div className="mx-auto w-full max-w-[800px] px-3 sm:px-6">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-background px-3 py-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="消息输入框"
            className="min-h-[28px] max-h-[200px] flex-1 resize-none border-0 bg-transparent py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {canStop ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStop}
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label="停止生成"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label="发送消息"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
