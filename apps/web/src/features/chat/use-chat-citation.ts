import { useCallback, useMemo, useState } from 'react';
import type { CitationResponse } from '@devbrain/api/client';
import type { ChatMessage } from './use-chat-stream';

export function useChatCitation(messages: ChatMessage[]) {
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);

  const activeMessageCitations = useMemo(() => {
    if (!activeMessageId) return [];
    const msg = messages.find((m) => m.id === activeMessageId);
    return msg?.citations ?? [];
  }, [messages, activeMessageId]);

  const handleCitationClick = useCallback(
    (c: CitationResponse, messageId: string) => {
      setActiveCitationId(c.chunkId);
      setActiveMessageId(messageId);
      setSourcePanelOpen(true);
    },
    [],
  );

  const closeSourcePanel = useCallback(() => {
    setSourcePanelOpen(false);
  }, []);

  return {
    activeCitationId,
    activeMessageId,
    sourcePanelOpen,
    activeMessageCitations,
    handleCitationClick,
    closeSourcePanel,
  };
}
