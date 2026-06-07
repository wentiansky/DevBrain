'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyMode = 'no-ready' | 'suggest';

interface ChatEmptyStateProps {
  kbId: string;
  hasDocuments: boolean;
  mode: EmptyMode;
  kbName?: string;
  readyCount?: number;
  suggestions?: string[];
  onSuggest?: (q: string) => void;
}

export function ChatEmptyState({
  kbId,
  hasDocuments,
  mode,
  kbName,
  readyCount,
  suggestions,
  onSuggest,
}: ChatEmptyStateProps) {
  if (mode === 'suggest') {
    return (
      <div className="flex flex-1 flex-col items-center overflow-y-auto">
        <div className="mx-auto mt-[12dvh] w-full max-w-[800px] px-3 pb-12 sm:px-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              开始和「{kbName ?? '知识库'}」对话
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              直接提问，或试试下面的建议
            </p>
          </div>

          {suggestions && suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSuggest?.(q)}
                  title={q}
                  className="max-w-full truncate rounded-full bg-muted px-3 py-1.5 text-xs text-foreground transition-all hover:bg-foreground/10 active:scale-[0.97] active:bg-foreground/15"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {typeof readyCount === 'number' && readyCount > 0 && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground/80">
              将基于该知识库的 {readyCount} 个文档回答
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-12">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          {hasDocuments ? '文档正在处理中' : '还没有可检索的文档'}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {hasDocuments
            ? '稍等片刻，文档处理完成后即可开始提问'
            : '请先上传 Markdown 文档，系统处理完成后即可开始提问'}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link href={`/kb/${kbId}`}>返回知识库</Link>
        </Button>
      </div>
    </div>
  );
}
