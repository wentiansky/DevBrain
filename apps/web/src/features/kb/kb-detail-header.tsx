'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { KbResponse } from '@devbrain/api/client';
import { Button } from '@/components/ui/button';
import { formatDateTime } from './kb-detail-format';
import type { DocumentStats } from './use-kb-detail';

function MetaBadge({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

interface KbDetailHeaderProps {
  kb: KbResponse;
  stats: DocumentStats;
  canChat: boolean;
  onBack: () => void;
}

export function KbDetailHeader({ kb, stats, canChat, onBack }: KbDetailHeaderProps) {
  return (
    <>
      <nav className="flex items-center gap-0.5 text-xs text-muted-foreground/80">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          知识库
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground/80">{kb.name}</span>
      </nav>

      <header className="mt-3 grid grid-cols-1 gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{kb.name}</h1>
            {kb.description ? (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{kb.description}</p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground/70">暂无描述</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <MetaBadge
                icon={<FileText className="h-3.5 w-3.5" />}
                label={`${stats.total} 个文档`}
              />
              <MetaBadge
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label={`${stats.ready} 个已索引`}
              />
              {stats.processing > 0 && (
                <MetaBadge
                  icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  label={`${stats.processing} 个处理中`}
                />
              )}
              <MetaBadge
                icon={<Clock className="h-3.5 w-3.5" />}
                label={`更新于 ${formatDateTime(kb.updatedAt)}`}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canChat ? (
              <Button asChild variant="default" size="sm">
                <Link href={`/kb/${kb.id}/chat`}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  AI 对话
                </Link>
              </Button>
            ) : (
              <Button variant="default" size="sm" disabled>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                AI 对话
              </Button>
            )}
            <Button variant="ghost" size="icon" disabled title="设置（即将推出）">
              <Settings className="h-4 w-4" />
              <span className="sr-only">设置</span>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
