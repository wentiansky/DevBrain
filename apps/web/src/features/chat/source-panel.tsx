'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CitationResponse } from '@devbrain/api/client';

interface SourcePanelProps {
  citations: CitationResponse[];
  activeCitationId: string | null;
  isOpen: boolean;
  isMobile: boolean;
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
      className={`rounded-lg border p-3 ${
        isActive ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[10px] font-medium text-muted-foreground">
          [{citation.order + 1}]
        </span>
        {citation.headingPath && citation.headingPath.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {citation.headingPath.join(' > ')}
          </span>
        )}
        {!citation.headingPath?.length && (
          <span className="text-xs text-muted-foreground">
            引用 {citation.order + 1} · {citation.sourceType}
          </span>
        )}
      </div>
      <div
        id={citation.anchor ? `chunk-${citation.anchor}` : undefined}
        className="max-h-48 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-foreground"
      >
        {citation.chunkText}
      </div>
    </div>
  );
}

export function SourcePanel({
  citations,
  activeCitationId,
  isOpen,
  isMobile,
  onClose,
}: SourcePanelProps) {
  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-border bg-background shadow-lg animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">
            引用来源 ({citations.length})
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {citations.map((c) => (
            <SourceItem
              key={c.id || c.chunkId}
              citation={c}
              isActive={activeCitationId === c.chunkId}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 shrink-0 border-l border-border bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">
          引用来源 ({citations.length})
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-3">
        {citations.map((c) => (
          <SourceItem
            key={c.id || c.chunkId}
            citation={c}
            isActive={activeCitationId === c.chunkId}
          />
        ))}
      </div>
    </div>
  );
}