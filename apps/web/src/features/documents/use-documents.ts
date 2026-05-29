'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type {
  PresignUploadDto,
  PresignUploadResponse,
  CreateDocumentDto,
  DocumentResponse,
  DocumentListResponse,
} from '@devbrain/api/client';

export const DOCUMENT_LIST_KEY = (kbId: string) => ['kb', kbId, 'documents'] as const;

export async function presignUpload(data: PresignUploadDto): Promise<PresignUploadResponse> {
  return apiFetch<PresignUploadResponse>('/api/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createDocument(data: CreateDocumentDto): Promise<DocumentResponse> {
  return apiFetch<DocumentResponse>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function useDocumentList(kbId: string) {
  return useQuery<DocumentListResponse>({
    queryKey: DOCUMENT_LIST_KEY(kbId),
    queryFn: () => apiFetch<DocumentListResponse>(`/api/kbs/${kbId}/documents`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.items || data.items.length === 0) return false;
      const hasPending = data.items.some(
        (d) => d.status === 'queued' || d.status === 'processing',
      );
      return hasPending ? 2000 : false;
    },
  });
}

export function useInvalidateDocumentList(kbId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: DOCUMENT_LIST_KEY(kbId) });
}