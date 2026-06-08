'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';
import { useUploadDocument } from '@/features/documents/use-upload-document';

interface KbDropOverlayProps {
  kbId: string;
}

function dragHasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'Files') return true;
  }
  return false;
}

export function KbDropOverlay({ kbId }: KbDropOverlayProps) {
  const { uploadFile, uploading } = useUploadDocument(kbId);
  const [active, setActive] = useState(false);
  const dragCounter = useRef(0);
  const uploadingRef = useRef(false);

  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      dragCounter.current += 1;
      if (!uploadingRef.current) setActive(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setActive(false);
    };

    const onDrop = async (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setActive(false);

      if (uploadingRef.current) {
        toast.error('已有文件上传中，请稍后再试');
        return;
      }

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      if (files.length > 1) {
        toast.message('暂不支持批量上传，已选取第一个文件');
      }

      const file = files[0];
      const result = await uploadFile(file);
      if (result.ok) {
        toast.success(`已上传 ${file.name}`);
      } else if (result.error) {
        toast.error(result.error);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [uploadFile]);

  if (!active) return null;

  return (
    <div
      data-testid="kb-drop-overlay"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="mx-4 flex w-full max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-primary bg-card px-8 py-10 text-center shadow-lg">
        <div className="rounded-full bg-primary/10 p-4">
          <UploadCloud className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">松开以上传到当前知识库</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          支持 .md 文件，单个最大 20MB
        </p>
      </div>
    </div>
  );
}
