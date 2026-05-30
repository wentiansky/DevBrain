export interface RerankDocument {
  chunkId: string;
  content: string;
}

export interface RerankResult {
  chunkId: string;
  score: number;
  index: number;
}

export interface RerankProvider {
  readonly providerName: string;
  readonly model: string;

  rerank(query: string, documents: RerankDocument[], topN: number): Promise<RerankResult[]>;
}