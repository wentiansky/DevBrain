'use client';

import { useState } from 'react';
import { useKnowledgeBases, useInvalidateKbList } from '@/features/kb/use-kbs';
import { KbEmptyState } from '@/features/kb/kb-empty-state';
import { KbList } from '@/features/kb/kb-list';
import { KbCreateForm } from '@/features/kb/kb-create-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { KbResponse } from '@devbrain/api/client';

export function KbHomeClient() {
  const { data, isLoading, isError, refetch } = useKnowledgeBases();
  const invalidateList = useInvalidateKbList();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreated = (_kb: KbResponse) => {
    void _kb;
    invalidateList();
    setShowCreateForm(false);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-destructive">加载知识库失败</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0 && !showCreateForm) {
    return <KbEmptyState onCreated={handleCreated} />;
  }

  if (showCreateForm) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-md rounded-lg border p-6">
          <h3 className="mb-4 text-lg font-semibold">创建知识库</h3>
          <KbCreateForm onCreated={handleCreated} />
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => setShowCreateForm(false)}
          >
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <KbList
      items={items}
      onCreateClick={() => setShowCreateForm(true)}
    />
  );
}