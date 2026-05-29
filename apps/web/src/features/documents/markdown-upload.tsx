'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import {
  presignUpload,
  createDocument,
  useInvalidateDocumentList,
} from './use-documents';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface MarkdownUploadProps {
  kbId: string;
}

export function MarkdownUpload({ kbId }: MarkdownUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invalidateDocuments = useInvalidateDocumentList(kbId);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError('文件超过 20MB 上限');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowedExts = ['md', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn'];
      if (!ext || !allowedExts.includes(ext)) {
        setError('不支持的文件类型，请上传 Markdown 文件');
        if (fileInputRef.current) fileInputRef.current.value = '';
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
          throw new Error('文件直传失败');
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
        setError((err as Error).message || '上传失败，请重试');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [kbId, invalidateDocuments],
  );

  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h3 className="text-lg font-semibold">文档上传</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        支持 Markdown (.md) 文件，最大 20MB。
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkdn,.mkd,.mdwn"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
        data-testid="markdown-upload-input"
      />

      <Button
        variant="outline"
        className="mt-4"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? '上传中...' : '选择文件'}
      </Button>

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}