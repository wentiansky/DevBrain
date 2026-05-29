export interface EmbeddingResult {
  vector: number[];
  index: number;
}

export interface EmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimension: number;

  embedDocuments(texts: string[]): Promise<EmbeddingResult[]>;
}