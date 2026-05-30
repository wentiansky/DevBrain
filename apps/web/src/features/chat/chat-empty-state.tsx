'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileWarning } from 'lucide-react';

interface ChatEmptyStateProps {
  kbId: string;
  hasDocuments: boolean;
}

export function ChatEmptyState({
  kbId,
  hasDocuments,
}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <FileWarning className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">
        {hasDocuments ? '文档处理中' : '还没有可检索的文档'}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasDocuments
          ? '请等待文档处理完成后再开始提问'
          : '请先上传 Markdown 文档，系统处理后即可开始提问'}
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link href={`/kb/${kbId}`}>返回知识库</Link>
      </Button>
    </div>
  );
}