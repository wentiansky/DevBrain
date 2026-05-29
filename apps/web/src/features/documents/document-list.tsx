'use client';

import type { DocumentResponse } from '@devbrain/api/client';
import { FileText, CheckCircle, Loader2, XCircle, Clock } from 'lucide-react';

function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'processing':
      return '处理中';
    case 'ready':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'queued':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'ready':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DocumentListProps {
  documents: DocumentResponse[];
}

export function DocumentList({ documents }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <h3 className="text-lg font-semibold text-muted-foreground">文档列表</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          暂无文档，请上传 Markdown 文件。
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">文档列表</h3>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            {statusIcon(doc.status)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.originalName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(doc.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-xs ${
                  doc.status === 'failed'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {statusLabel(doc.status)}
              </span>
              {doc.errorMessage && (
                <p className="mt-1 text-xs text-destructive">
                  {doc.errorMessage}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}