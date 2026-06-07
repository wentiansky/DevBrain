'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ChatClient } from '@/features/chat/chat-client';

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const kbId = params.id as string;
  const conversationIdParam = searchParams.get('conversation');
  const initialPrompt = searchParams.get('prompt') ?? '';

  return (
    <ChatClient
      kbId={kbId}
      conversationIdParam={conversationIdParam}
      initialPrompt={initialPrompt}
    />
  );
}
