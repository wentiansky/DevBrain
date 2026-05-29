'use client';

import { KbCreateForm } from './kb-create-form';
import type { KbResponse } from '@devbrain/api/client';

export function KbEmptyState({
  onCreated,
}: {
  onCreated: (kb: KbResponse) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h2 className="text-2xl font-bold tracking-tight">还没有知识库</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        创建你的第一个个人知识库，上传文档并开始提问。
      </p>

      <div className="mt-8 w-full max-w-md rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold">创建知识库</h3>
        <KbCreateForm onCreated={onCreated} />
      </div>
    </div>
  );
}