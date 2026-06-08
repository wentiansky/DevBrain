'use client';

import { useParams, useRouter } from 'next/navigation';
import { KbDetailHeader } from './kb-detail-header';
import { KbDetailSidebar } from './kb-detail-sidebar';
import { KbDetailLoading, KbDetailLoadError, KbDetailNotFound } from './kb-detail-states';
import { KbDocumentsWorkspace } from './kb-documents-workspace';
import { KbDropOverlay } from './kb-drop-overlay';
import {
  useConversationItems,
  useKbConversations,
  useKbDocumentFilters,
  useKbDocuments,
  useKnowledgeBase,
} from './use-kb-detail';

export function KbDetailClient() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const { data: kb, isLoading, isError, refetch } = useKnowledgeBase(kbId);
  const documents = useKbDocuments(kbId);
  const { data: convList } = useKbConversations(kbId, Boolean(kb));
  const conversations = useConversationItems(convList);
  const {
    filteredDocs,
    inFlightDocs,
    resetFilters,
    searchQuery,
    setSearchQuery,
    setStatusFilter,
    stats,
    statusFilter,
  } = useKbDocumentFilters(documents);

  if (isLoading) {
    return <KbDetailLoading />;
  }

  if (isError) {
    return <KbDetailLoadError onRetry={() => refetch()} />;
  }

  if (!kb) {
    return <KbDetailNotFound />;
  }

  const hasDocuments = documents.length > 0;
  const canChat = stats.ready > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <KbDropOverlay kbId={kbId} />
      <KbDetailHeader kb={kb} stats={stats} canChat={canChat} onBack={() => router.push('/')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <KbDocumentsWorkspace
            filteredDocs={filteredDocs}
            hasDocuments={hasDocuments}
            kbId={kbId}
            onResetFilters={resetFilters}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            stats={stats}
            statusFilter={statusFilter}
          />
        </div>

        <KbDetailSidebar
          canChat={canChat}
          conversations={conversations}
          inFlightDocs={inFlightDocs}
          kbId={kb.id}
          stats={stats}
        />
      </div>
    </div>
  );
}
