'use client';

import { useState } from 'react';
import type { DocumentResponse } from '@devbrain/api/client';
import {
  FileText,
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  MoreHorizontal,
  Copy,
  Trash2,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'processing':
      return '处理中';
    case 'ready':
      return '已索引';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'queued':
      return <Clock className="h-3.5 w-3.5" />;
    case 'processing':
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case 'ready':
      return <CheckCircle className="h-3.5 w-3.5" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60';
    case 'failed':
      return 'bg-destructive/10 text-destructive ring-1 ring-destructive/20';
    case 'processing':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60';
    case 'queued':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60';
    default:
      return 'bg-muted text-muted-foreground ring-1 ring-border';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value >= 100 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'markdown':
      return 'Markdown';
    case 'pdf':
      return 'PDF';
    case 'web':
      return '网页';
    case 'code':
      return '代码';
    default:
      return sourceType;
  }
}

interface DocumentListProps {
  documents: DocumentResponse[];
}

export function DocumentList({ documents }: DocumentListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (documents.length === 0) {
    return null;
  }

  const handleCopy = async (doc: DocumentResponse) => {
    try {
      await navigator.clipboard.writeText(doc.originalName);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId((id) => (id === doc.id ? null : id)), 1500);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  return (
    <div>
      {/* 表头（仅 md+ 可见） */}
      <div className="hidden border-b bg-muted/30 px-5 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1fr_120px_120px_160px_60px] md:gap-4">
        <div>名称</div>
        <div>类型 · 大小</div>
        <div>分块数</div>
        <div>更新时间</div>
        <div className="text-right">操作</div>
      </div>

      <ul className="divide-y divide-border">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="group grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5 md:grid-cols-[1fr_120px_120px_160px_60px] md:items-center md:gap-4"
          >
            {/* 名称列 + 状态 */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="truncate text-sm font-medium"
                    title={doc.originalName}
                  >
                    {doc.originalName}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                      doc.status,
                    )}`}
                  >
                    {statusIcon(doc.status)}
                    {statusLabel(doc.status)}
                  </span>
                </div>
                {doc.errorMessage && (
                  <p
                    className="mt-1 truncate text-xs text-destructive"
                    title={doc.errorMessage}
                  >
                    {doc.errorMessage}
                  </p>
                )}
                {/* 移动端副行 */}
                <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                  {sourceLabel(doc.sourceType)} · {formatSize(doc.sizeBytes)} ·{' '}
                  {doc.chunkCount ?? 0} 段 · {formatDate(doc.updatedAt)}
                </p>
              </div>
            </div>

            {/* 桌面端列：类型 + 大小 */}
            <div className="hidden text-xs text-muted-foreground md:block">
              <div>{sourceLabel(doc.sourceType)}</div>
              <div className="text-foreground/80">{formatSize(doc.sizeBytes)}</div>
            </div>

            {/* 桌面端列：分块数 */}
            <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              <Hash className="h-3 w-3" />
              <span className="text-foreground/80">{doc.chunkCount ?? 0}</span>
              <span>段</span>
            </div>

            {/* 桌面端列：更新时间 */}
            <div className="hidden text-xs text-muted-foreground md:block">
              {formatDate(doc.updatedAt)}
            </div>

            {/* 操作菜单 */}
            <div className="hidden justify-end md:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
                    aria-label="文档操作"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleCopy(doc)}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    {copiedId === doc.id ? '已复制' : '复制文件名'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    删除（即将推出）
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
