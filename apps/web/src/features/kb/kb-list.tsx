'use client';

import Link from 'next/link';
import type { KbResponse } from '@devbrain/api/client';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function KbList({
  items,
  onCreateClick,
}: {
  items: KbResponse[];
  onCreateClick: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-tight">我的知识库</h2>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建知识库
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-muted-foreground">暂无知识库</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((kb) => (
            <Link
              key={kb.id}
              href={`/kb/${kb.id}`}
              className="group block rounded-lg border p-5 transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <h3 className="font-semibold truncate">{kb.name}</h3>
              {kb.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {kb.description}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                更新于 {formatDate(kb.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}