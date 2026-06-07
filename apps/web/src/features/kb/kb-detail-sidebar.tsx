'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, MessagesSquare, PlusCircle, Sparkles, Trash2 } from 'lucide-react';
import type { ConversationResponse, DocumentResponse } from '@devbrain/api/client';
import { Button } from '@/components/ui/button';
import { formatRelative } from './kb-detail-format';
import { SUGGESTED_PROMPTS } from './kb-detail-prompts';
import { useDeleteConversation, type DocumentStats } from './use-kb-detail';

interface KbDetailSidebarProps {
  canChat: boolean;
  conversations: ConversationResponse[];
  inFlightDocs: DocumentResponse[];
  kbId: string;
  stats: DocumentStats;
}

export function KbDetailSidebar({
  canChat,
  conversations,
  inFlightDocs,
  kbId,
  stats,
}: KbDetailSidebarProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const deleteMutation = useDeleteConversation(kbId);

  return (
    <aside className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card divide-y divide-border/30">
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
                <Link href={`/kb/${kbId}/chat`}>
                  <PlusCircle className="mr-1 h-3 w-3" />
                  新对话
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" disabled>
                <PlusCircle className="mr-1 h-3 w-3" />
                新对话
              </Button>
            )}
          </div>
          <div className="px-2 pb-3">
            {conversations.length > 0 ? (
              <ul className="space-y-0.5">
                {conversations.slice(0, 4).map((conv) => {
                  const isConfirming = confirmingId === conv.id;
                  const isDeleting = deleteMutation.isPending && deleteMutation.variables === conv.id;

                  if (isConfirming) {
                    return (
                      <li key={conv.id}>
                        <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/5 px-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            删除「{conv.title || '未命名对话'}」？
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setConfirmingId(null)}
                              disabled={isDeleting}
                            >
                              取消
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                deleteMutation.mutate(conv.id, {
                                  onSettled: () => setConfirmingId(null),
                                })
                              }
                              disabled={isDeleting}
                            >
                              {isDeleting ? '删除中…' : '删除'}
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={conv.id}>
                      <div className="group relative">
                        <Link
                          href={`/kb/${kbId}/chat?conversation=${conv.id}`}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 pr-8 transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{conv.title || '未命名对话'}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatRelative(conv.updatedAt)}
                            </p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          aria-label="删除对话"
                          title="删除对话"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmingId(conv.id);
                          }}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {canChat ? '还没有对话，从「新对话」开始提问。' : '上传并索引文档后即可开始对话。'}
              </p>
            )}
          </div>
        </section>

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
                    <p className="truncate text-xs" title={doc.originalName}>
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
              <p className="text-xs text-muted-foreground">当前没有处理中的任务。</p>
            )}
          </div>
        </section>
      </div>

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
                  href={`/kb/${kbId}/chat?prompt=${encodeURIComponent(prompt)}`}
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
  );
}
