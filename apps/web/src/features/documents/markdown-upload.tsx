'use client';

import { useState, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Upload, UploadCloud } from 'lucide-react';
import { presignUpload, createDocument, useInvalidateDocumentList } from './use-documents';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTS = ['md', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn'];

interface MarkdownUploadProps {
  kbId: string;
  variant?: 'full' | 'compact';
}

export function MarkdownUpload({ kbId, variant = 'full' }: MarkdownUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invalidateDocuments = useInvalidateDocumentList(kbId);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError('文件超过 20MB 上限');
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTS.includes(ext)) {
        setError('不支持的文件类型，请上传 Markdown 文件');
        return;
      }

      setUploading(true);

      try {
        const presignRes = await presignUpload({
          kbId,
          fileName: file.name,
          mimeType: file.type || 'text/markdown',
          sizeBytes: file.size,
        });

        const putRes = await fetch(presignRes.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'text/markdown',
            'Content-Length': String(file.size),
          },
          body: file,
        });

        if (!putRes.ok) {
          const err = new Error('文件直传失败');
          Sentry.captureException(err, {
            tags: {
              kbId,
              putStatus: putRes.status,
              fileExtension: ext,
              sizeBytes: file.size,
            },
          });
          throw err;
        }

        await createDocument({
          kbId,
          objectKey: presignRes.objectKey,
          uploadToken: presignRes.uploadToken,
          originalName: file.name,
          mimeType: file.type || 'text/markdown',
          sizeBytes: file.size,
        });

        invalidateDocuments();
      } catch (err) {
        const errMsg = (err as Error).message || '上传失败，请重试';
        setError(errMsg);

        if (!(err as Error).message?.includes('直传') && errMsg !== '文件直传失败') {
          Sentry.captureException(err instanceof Error ? err : new Error(errMsg), {
            tags: {
              kbId,
              fileExtension: ext,
              sizeBytes: file.size,
              mimeType: file.type || 'text/markdown',
            },
          });
        }
      } finally {
        setUploading(false);
      }
    },
    [kbId, invalidateDocuments],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await uploadFile(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        await uploadFile(file);
      }
    },
    [uploadFile],
  );

  const input = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md,.markdown,.mdown,.mkdn,.mkd,.mdwn"
      onChange={handleFileChange}
      className="hidden"
      disabled={uploading}
      data-testid="markdown-upload-input"
    />
  );

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-end gap-1">
        {input}
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? '上传中…' : '上传文档'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="rounded-full bg-background p-3 shadow-sm ring-1 ring-border">
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">上传 Markdown 文档</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        拖拽文件到此处，或点击下方按钮选择。支持 .md 文件，单个最大 20MB。
      </p>

      {input}

      <Button
        variant="default"
        className="mt-5"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? '上传中…' : '选择文件'}
      </Button>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
