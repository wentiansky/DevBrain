import type { RerankProvider, RerankDocument, RerankResult } from './rerank-provider.interface';

export class MockRerankProvider implements RerankProvider {
  readonly providerName = 'mock';
  readonly model = 'mock-rerank-v1';

  async rerank(
    _query: string,
    documents: RerankDocument[],
    topN: number,
  ): Promise<RerankResult[]> {
    const results: RerankResult[] = documents.map((doc, index) => ({
      chunkId: doc.chunkId,
      score: 1.0 - index * 0.01,
      index,
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topN);
  }
}