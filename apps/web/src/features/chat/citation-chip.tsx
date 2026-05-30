'use client';

import type { CitationResponse } from '@devbrain/api/client';

interface CitationChipProps {
  citation: CitationResponse;
  isActive: boolean;
  onClick: (citation: CitationResponse) => void;
}

export function CitationChip({ citation, isActive, onClick }: CitationChipProps) {
  const label = citation.headingPath?.length
    ? citation.headingPath[citation.headingPath.length - 1]
    : `引用 ${citation.order + 1}`;

  return (
    <button
      type="button"
      onClick={() => onClick(citation)}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
      }`}
    >
      <span className="font-mono text-[10px]">{citation.order + 1}</span>
      <span className="max-w-[120px] truncate">{label}</span>
    </button>
  );
}

export function CitationList({
  citations,
  activeCitationId,
  onCitationClick,
}: {
  citations: CitationResponse[];
  activeCitationId: string | null;
  onCitationClick: (citation: CitationResponse) => void;
}) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {citations.map((c) => (
        <CitationChip
          key={c.id || c.chunkId}
          citation={c}
          isActive={activeCitationId === c.chunkId}
          onClick={onCitationClick}
        />
      ))}
    </div>
  );
}