export interface FtsCandidate {
  chunkId: string;
  documentId: string;
  kbId: string;
  sourceType: string;
  content: string;
  headingPath: string[];
  anchor: string | null;
  page: number | null;
  bbox: Record<string, unknown> | null;
  ftsRank: number;
  ftsScore: number;
}

export interface VectorCandidate {
  chunkId: string;
  documentId: string;
  kbId: string;
  sourceType: string;
  content: string;
  headingPath: string[];
  anchor: string | null;
  page: number | null;
  bbox: Record<string, unknown> | null;
  vectorRank: number;
  vectorDistance: number;
}

export interface ChunkCitationFields {
  chunkId: string;
  documentId: string;
  kbId: string;
  sourceType: string;
  content: string;
  headingPath: string[];
  anchor: string | null;
  page: number | null;
  bbox: Record<string, unknown> | null;
}

export interface VectorStore {
  ftsRecall(kbId: string, query: string, topK: number): Promise<FtsCandidate[]>;

  vectorRecall(
    kbId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<VectorCandidate[]>;

  loadCitationFields(userId: string, kbId: string, chunkIds: string[]): Promise<ChunkCitationFields[]>;
}