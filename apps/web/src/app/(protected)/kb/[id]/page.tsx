'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Settings,
  Inbox,
  Search,
  MessagesSquare,
  Loader2,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';
import type {
  KbResponse,
  ConversationListResponse,
  ConversationResponse,
} from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownUpload } from '@/features/documents/markdown-upload';
import { DocumentList } from '@/features/documents/document-list';
import { useDocumentList } from '@/features/documents/use-documents';

type StatusFilter = 'all' | 'ready' | 'processing' | 'failed';

const SUGGESTED_PROMPTS = [
  '帮我用一句话总结这个知识库的主要内容',
  '列出最近上传文档中的核心概念和关键术语',
  '基于这些资料，给我 5 条最值得关注的要点',
];

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(dateStr: string): string {
  const target = new Date(dateStr).getTime();
  const diff = Date.now() - target;
  if (Number.isNaN(diff)) return '';
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function MetaBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

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

export default function KbDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: kb, isLoading, isError, refetch } = useQuery<KbResponse>({
    queryKey: ['kb', kbId],
    queryFn: () => apiFetch<KbResponse>(`/api/kbs/${kbId}`),
  });

  const { data: docList } = useDocumentList(kbId);
  const documents = useMemo(() => docList?.items ?? [], [docList?.items]);

  const { data: convList } = useQuery<ConversationListResponse>({
    queryKey: ['kb', kbId, 'conversations'],
    queryFn: () =>
      apiFetch<ConversationListResponse>(`/api/kbs/${kbId}/conversations`),
    enabled: Boolean(kb),
  });
  const conversations: ConversationResponse[] = useMemo(
    () => convList?.items ?? [],
    [convList?.items],
  );

  const stats = useMemo(() => {
    const total = documents.length;
    const ready = documents.filter((d) => d.status === 'ready').length;
    const processing = documents.filter(
      (d) => d.status === 'queued' || d.status === 'processing',
    ).length;
    const failed = documents.filter((d) => d.status === 'failed').length;
    return { total, ready, processing, failed };
  }, [documents]);

  const inFlightDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.status === 'queued' || d.status === 'processing',
      ),
    [documents],
  );

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (statusFilter === 'processing') {
        if (doc.status !== 'queued' && doc.status !== 'processing') return false;
      } else if (statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }
      if (q && !doc.originalName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 flex items-start justify-between gap-4 pb-6">
          <div className="space-y-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96 rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-destructive">无法加载知识库，可能不存在或无权访问。</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/')}
        >
          返回知识库列表
        </Button>
        <Button variant="ghost" className="mt-2" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">知识库不存在</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/')}
        >
          返回知识库列表
        </Button>
      </div>
    );
  }

  const hasDocuments = documents.length > 0;
  const canChat = stats.ready > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* 面包屑（弱化） */}
      <nav className="flex items-center gap-0.5 text-xs text-muted-foreground/80">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          知识库
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground/80">{kb.name}</span>
      </nav>

      {/* KB Header：lg+ 与主体共享 grid，按钮落在主列右上角 */}
      <header className="mt-3 grid grid-cols-1 gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{kb.name}</h1>
            {kb.description ? (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                {kb.description}
              </p>
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

      {/* 主体两栏 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 主区：文档工作区 */}
        <div className="min-w-0">
          {hasDocuments ? (
            <section
              data-testid="kb-documents-slot"
              className="flex flex-col overflow-hidden rounded-lg border bg-card lg:min-h-[520px]"
            >
              {/* 工具栏：搜索 / 状态筛选 / 上传 三组分明 */}
              <div className="flex flex-col gap-3 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-5">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[280px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索文档名称"
                    className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="搜索文档"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto sm:ml-1">
                  <FilterChip
                    active={statusFilter === 'all'}
                    onClick={() => setStatusFilter('all')}
                    label="全部"
                    count={stats.total}
                  />
                  <FilterChip
                    active={statusFilter === 'ready'}
                    onClick={() => setStatusFilter('ready')}
                    label="已索引"
                    count={stats.ready}
                  />
                  <FilterChip
                    active={statusFilter === 'processing'}
                    onClick={() => setStatusFilter('processing')}
                    label="处理中"
                    count={stats.processing}
                  />
                  {stats.failed > 0 && (
                    <FilterChip
                      active={statusFilter === 'failed'}
                      onClick={() => setStatusFilter('failed')}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                      }}
                    >
                      清除筛选
                    </Button>
                  </div>
                )}
              </div>

              {/* 底部状态条 */}
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
          ) : (
            <section
              data-testid="kb-documents-slot"
              className="rounded-lg border bg-card"
            >
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
          )}
        </div>

        {/* 辅助栏 */}
        <aside className="space-y-4">
          {/* 分段卡：最近对话 + 索引队列（共享外框，视觉权重轻） */}
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card divide-y divide-border/30">
            {/* 最近对话 */}
            <section data-testid="kb-chat-slot" className="pb-1">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground/90">最近对话</h3>
                </div>
                {canChat ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Link href={`/kb/${kb.id}/chat`}>
                      <PlusCircle className="mr-1 h-3 w-3" />
                      新对话
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    disabled
                  >
                    <PlusCircle className="mr-1 h-3 w-3" />
                    新对话
                  </Button>
                )}
              </div>
              <div className="px-2 pb-3">
                {conversations.length > 0 ? (
                  <ul className="space-y-0.5">
                    {conversations.slice(0, 4).map((conv) => (
                      <li key={conv.id}>
                        <Link
                          href={`/kb/${kb.id}/chat?conversation=${conv.id}`}
                          className="group flex items-start justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {conv.title || '未命名对话'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatRelative(conv.updatedAt)}
                            </p>
                          </div>
                          <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {canChat
                      ? '还没有对话，从「新对话」开始提问。'
                      : '上传并索引文档后即可开始对话。'}
                  </p>
                )}
              </div>
            </section>

            {/* 索引队列 */}
            <section className="pt-1">
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <Loader2
                  className={`h-3.5 w-3.5 ${stats.processing > 0 ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}
                />
                <h3 className="text-xs font-semibold text-foreground/90">索引队列</h3>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {stats.processing} 处理中
                </span>
              </div>
              <div className="px-4 pb-4">
                {inFlightDocs.length > 0 ? (
                  <ul className="space-y-1.5">
                    {inFlightDocs.slice(0, 3).map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-500" />
                        <p
                          className="truncate text-xs"
                          title={doc.originalName}
                        >
                          {doc.originalName}
                        </p>
                      </li>
                    ))}
                    {inFlightDocs.length > 3 && (
                      <li className="text-[10px] text-muted-foreground">
                        还有 {inFlightDocs.length - 3} 个排队中
                      </li>
                    )}
                  </ul>
                ) : stats.failed > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    当前没有处理中的任务，{stats.failed} 个失败需要关注。
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    当前没有处理中的任务。
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* 快捷问题：独立卡片，视觉权重更重 */}
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-xs font-semibold">快捷问题</h3>
            </div>
            <ul className="space-y-0.5 p-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  {canChat ? (
                    <Link
                      href={`/kb/${kb.id}/chat?prompt=${encodeURIComponent(prompt)}`}
                      className="group flex items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-xs transition-colors hover:border-border/60 hover:bg-muted"
                    >
                      <Sparkles className="h-3 w-3 shrink-0 text-amber-500/80" />
                      <span className="flex-1 leading-relaxed">{prompt}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 px-2 py-2 text-xs text-muted-foreground/60">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span className="flex-1 leading-relaxed">{prompt}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
