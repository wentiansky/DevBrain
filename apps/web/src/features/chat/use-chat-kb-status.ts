import { useMemo } from 'react';
import { useKnowledgeBase } from '@/features/kb/use-kb-detail';
import { useDocumentList } from '@/features/documents/use-documents';

export function useChatKbStatus(kbId: string) {
  const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId);
  const { data: docList } = useDocumentList(kbId);

  return useMemo(() => {
    const docs = docList?.items ?? [];
    const hasDocuments = docs.length > 0;
    const readyCount = docs.filter((d) => d.status === 'ready').length;
    const processingCount = docs.filter(
      (d) => d.status === 'queued' || d.status === 'processing',
    ).length;
    const canChat = readyCount > 0;
    const statusSummary = canChat
      ? `${readyCount} 个文档可检索${processingCount > 0 ? ` · ${processingCount} 处理中` : ''}`
      : kb?.description || '该知识库暂无可检索文档';

    return {
      kb,
      kbLoading,
      hasDocuments,
      readyCount,
      canChat,
      statusSummary,
    };
  }, [kb, kbLoading, docList?.items]);
}
