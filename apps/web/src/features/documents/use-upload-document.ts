'use client';

import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { presignUpload, createDocument, useInvalidateDocumentList } from './use-documents';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ALLOWED_EXTS = ['md', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn'];

export function validateMarkdownFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return '文件超过 20MB 上限';
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return '不支持的文件类型，请上传 Markdown 文件';
  }
  return null;
}

export function useUploadDocument(kbId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidateDocuments = useInvalidateDocumentList(kbId);

  const uploadFile = useCallback(
    async (file: File): Promise<{ ok: boolean; error?: string }> => {
      setError(null);

      const validationError = validateMarkdownFile(file);
      if (validationError) {
        setError(validationError);
        return { ok: false, error: validationError };
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
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
        return { ok: true };
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
        return { ok: false, error: errMsg };
      } finally {
        setUploading(false);
      }
    },
    [kbId, invalidateDocuments],
  );

  return { uploadFile, uploading, error, setError };
}
