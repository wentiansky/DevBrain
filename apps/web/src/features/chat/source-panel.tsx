'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CitationResponse } from '@devbrain/api/client';

interface SourcePanelProps {
  citations: CitationResponse[];
  activeCitationId: string | null;
  onClose: () => void;
}

function SourceItem({
  citation,
  isActive,
}: {
  citation: CitationResponse;
  isActive: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      id={`source-${citation.chunkId}`}
      className={`rounded-lg border p-3 transition-colors ${
        isActive ? 'border-primary bg-primary/5' : 'border-border bg-card/40'
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] font-medium text-muted-foreground">
          [{citation.order + 1}]
        </span>
        {citation.headingPath && citation.headingPath.length > 0 ? (
          <span className="truncate text-xs text-muted-foreground">
            {citation.headingPath.join(' › ')}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            引用 {citation.order + 1} · {citation.sourceType}
          </span>
        )}
      </div>
      <div
        id={citation.anchor ? `chunk-${citation.anchor}` : undefined}
        className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground"
      >
        {citation.chunkText}
      </div>
    </div>
  );
}

function PanelHeader({
  count,
  titleId,
  onClose,
}: {
  count: number;
  titleId: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 id={titleId} className="text-sm font-semibold">
        引用来源 ({count})
      </h3>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-7 w-7"
        aria-label="关闭引用面板"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SourcePanel({
  citations,
  activeCitationId,
  onClose,
}: SourcePanelProps) {
  const desktopTitleId = useId();
  const mobileTitleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <aside
        aria-labelledby={desktopTitleId}
        className="hidden w-[360px] shrink-0 flex-col border-l border-border bg-background lg:flex"
      >
        <PanelHeader
          count={citations.length}
          titleId={desktopTitleId}
          onClose={onClose}
        />
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {citations.map((c) => (
            <SourceItem
              key={c.id || c.chunkId}
              citation={c}
              isActive={activeCitationId === c.chunkId}
            />
          ))}
        </div>
      </aside>

      <div
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={mobileTitleId}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col rounded-t-2xl border border-border bg-background shadow-xl lg:hidden"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <PanelHeader
          count={citations.length}
          titleId={mobileTitleId}
          onClose={onClose}
        />
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {citations.map((c) => (
            <SourceItem
              key={c.id || c.chunkId}
              citation={c}
              isActive={activeCitationId === c.chunkId}
            />
          ))}
        </div>
      </div>
    </>
  );
}
