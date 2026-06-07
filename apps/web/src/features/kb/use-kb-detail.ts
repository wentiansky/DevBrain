'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConversationListResponse,
  ConversationResponse,
  DocumentResponse,
  KbResponse,
} from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';
import { useDocumentList } from '@/features/documents/use-documents';

export type StatusFilter = 'all' | 'ready' | 'processing' | 'failed';

export interface DocumentStats {
  total: number;
  ready: number;
  processing: number;
  failed: number;
}

export function useKnowledgeBase(kbId: string) {
  return useQuery<KbResponse>({
    queryKey: ['kb', kbId],
    queryFn: () => apiFetch<KbResponse>(`/api/kbs/${kbId}`),
  });
}

export function useKbConversations(kbId: string, enabled: boolean) {
  return useQuery<ConversationListResponse>({
    queryKey: ['kb', kbId, 'conversations'],
    queryFn: () => apiFetch<ConversationListResponse>(`/api/kbs/${kbId}/conversations`),
    enabled,
  });
}

export function useDeleteConversation(kbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<void>(`/api/kbs/${kbId}/conversations/${conversationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', kbId, 'conversations'] });
    },
  });
}

export function useKbDocuments(kbId: string) {
  const { data: docList } = useDocumentList(kbId);
  return useMemo(() => docList?.items ?? [], [docList?.items]);
}

export function useConversationItems(convList?: ConversationListResponse): ConversationResponse[] {
  return useMemo(() => convList?.items ?? [], [convList?.items]);
}

export function useKbDocumentFilters(documents: DocumentResponse[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const stats = useMemo<DocumentStats>(() => {
    const total = documents.length;
    const ready = documents.filter((d) => d.status === 'ready').length;
    const processing = documents.filter(
      (d) => d.status === 'queued' || d.status === 'processing',
    ).length;
    const failed = documents.filter((d) => d.status === 'failed').length;
    return { total, ready, processing, failed };
  }, [documents]);

  const inFlightDocs = useMemo(
    () => documents.filter((d) => d.status === 'queued' || d.status === 'processing'),
    [documents],
  );

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (statusFilter === 'processing') {
        if (doc.status !== 'queued' && doc.status !== 'processing') return false;
      } else if (statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }
      if (q && !doc.originalName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, searchQuery, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return {
    filteredDocs,
    inFlightDocs,
    resetFilters,
    searchQuery,
    setSearchQuery,
    setStatusFilter,
    stats,
    statusFilter,
  };
}
