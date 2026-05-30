export interface RetrievalChunk {
  chunkId: string;
  documentId: string;
  kbId: string;
  sourceType: string;
  content: string;
  headingPath: string[];
  anchor: string | null;
  page: number | null;
  bbox: Record<string, unknown> | null;
  ftsRank?: number;
  ftsScore?: number;
  vectorRank?: number;
  vectorDistance?: number;
  rrfScore?: number;
  rerankScore?: number;
}

export type RejectionReason = 'no_ready_chunks' | 'no_recall_hits' | 'low_relevance';

export interface RetrievalResult {
  status: 'success' | 'rejected';
  chunks?: RetrievalChunk[];
  reason?: RejectionReason;
}

export interface GenerationOutput {
  status: 'success' | 'rejected';
  answer?: string;
  reason?: RejectionReason;
}