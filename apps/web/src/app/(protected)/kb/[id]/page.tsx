'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { KbResponse } from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { MarkdownUpload } from '@/features/documents/markdown-upload';
import { DocumentList } from '@/features/documents/document-list';
import { useDocumentList } from '@/features/documents/use-documents';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function KbDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const { data: kb, isLoading, isError, refetch } = useQuery<KbResponse>({
    queryKey: ['kb', kbId],
    queryFn: () => apiFetch<KbResponse>(`/api/kbs/${kbId}`),
  });

  const { data: docList } = useDocumentList(kbId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">正在加载知识库...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center py-16">
        <p className="text-sm text-destructive">无法加载知识库，可能不存在或无权访问。</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/')}
        >
          返回知识库列表
        </Button>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => refetch()}
        >
          重试
        </Button>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center py-16">
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push('/')}
      >
        ← 返回知识库列表
      </Button>

      <div className="rounded-lg border p-6">
        <h1 className="text-2xl font-bold">{kb.name}</h1>
        {kb.description && (
          <p className="mt-2 text-muted-foreground">{kb.description}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          创建于 {formatDate(kb.createdAt)} · 更新于{' '}
          {formatDate(kb.updatedAt)}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <section data-testid="kb-upload-slot">
          <MarkdownUpload kbId={kbId} />
        </section>

        <section data-testid="kb-documents-slot">
          <DocumentList documents={docList?.items ?? []} />
        </section>

        <section
          data-testid="kb-chat-slot"
          className="rounded-lg border border-dashed p-8 text-center"
        >
          <h3 className="text-lg font-semibold text-muted-foreground">
            AI 对话
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            基于知识库内容的智能问答将在后续步骤中接入，完成后此处展示对话界面。
          </p>
          <Button variant="outline" className="mt-4" disabled>
            即将上线
          </Button>
        </section>
      </div>
    </div>
  );
}