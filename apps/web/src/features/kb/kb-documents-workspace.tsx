'use client';

import { Inbox, Loader2, Search } from 'lucide-react';
import type { DocumentResponse } from '@devbrain/api/client';
import { Button } from '@/components/ui/button';
import { DocumentList } from '@/features/documents/document-list';
import { MarkdownUpload } from '@/features/documents/markdown-upload';
import type { DocumentStats, StatusFilter } from './use-kb-detail';

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-foreground text-background'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? 'bg-background/20 text-background' : 'bg-background text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface KbDocumentsWorkspaceProps {
  filteredDocs: DocumentResponse[];
  hasDocuments: boolean;
  kbId: string;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  searchQuery: string;
  stats: DocumentStats;
  statusFilter: StatusFilter;
}

export function KbDocumentsWorkspace({
  filteredDocs,
  hasDocuments,
  kbId,
  onResetFilters,
  onSearchQueryChange,
  onStatusFilterChange,
  searchQuery,
  stats,
  statusFilter,
}: KbDocumentsWorkspaceProps) {
  if (!hasDocuments) {
    return (
      <section data-testid="kb-documents-slot" className="rounded-lg border bg-card">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">还没有任何文档</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            上传 Markdown 文档后，系统会自动切分、索引，随后即可在 AI 对话中检索。
          </p>
        </div>
        <div className="border-t px-4 py-5 sm:px-6">
          <section data-testid="kb-upload-slot">
            <MarkdownUpload kbId={kbId} variant="full" />
          </section>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="kb-documents-slot"
      className="flex flex-col overflow-hidden rounded-lg border bg-card lg:min-h-[520px]"
    >
      <div className="flex flex-col gap-3 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-5">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="搜索文档名称"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="搜索文档"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto sm:ml-1">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => onStatusFilterChange('all')}
            label="全部"
            count={stats.total}
          />
          <FilterChip
            active={statusFilter === 'ready'}
            onClick={() => onStatusFilterChange('ready')}
            label="已索引"
            count={stats.ready}
          />
          <FilterChip
            active={statusFilter === 'processing'}
            onClick={() => onStatusFilterChange('processing')}
            label="处理中"
            count={stats.processing}
          />
          {stats.failed > 0 && (
            <FilterChip
              active={statusFilter === 'failed'}
              onClick={() => onStatusFilterChange('failed')}
              label="失败"
              count={stats.failed}
            />
          )}
        </div>

        <div className="flex justify-end sm:ml-auto sm:border-l sm:border-border/60 sm:pl-3">
          <section data-testid="kb-upload-slot">
            <MarkdownUpload kbId={kbId} variant="compact" />
          </section>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {filteredDocs.length > 0 ? (
          <DocumentList documents={filteredDocs} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">没有符合条件的文档</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={onResetFilters}>
              清除筛选
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        <span>
          显示 {filteredDocs.length}
          {filteredDocs.length !== stats.total ? ` / ${stats.total}` : ''} 个文档
        </span>
        <div className="flex items-center gap-3">
          {stats.processing > 0 && (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {stats.processing} 处理中
            </span>
          )}
          {stats.failed > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive">
              {stats.failed} 失败
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
