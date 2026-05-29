'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { KbListResponse } from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';

export const KB_LIST_KEY = ['kbs'] as const;

export function useKnowledgeBases() {
  return useQuery<KbListResponse>({
    queryKey: KB_LIST_KEY,
    queryFn: () => apiFetch<KbListResponse>('/api/kbs'),
  });
}

export function useInvalidateKbList() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KB_LIST_KEY });
}