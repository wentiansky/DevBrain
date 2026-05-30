export interface RrfOutput {
  chunkId: string;
  rrfScore: number;
  ftsRank?: number;
  vectorRank?: number;
}

export function computeRRF(
  ftsCandidates: Array<{ chunkId: string; rank: number }>,
  vectorCandidates: Array<{ chunkId: string; rank: number }>,
  k: number = 60,
  topN: number = 30,
): RrfOutput[] {
  const scoreMap = new Map<string, { ftsRank?: number; vectorRank?: number; score: number }>();

  for (const { chunkId, rank } of ftsCandidates) {
    const entry = scoreMap.get(chunkId) ?? { score: 0 };
    entry.ftsRank = rank;
    entry.score += 1 / (k + rank);
    scoreMap.set(chunkId, entry);
  }

  for (const { chunkId, rank } of vectorCandidates) {
    const entry = scoreMap.get(chunkId) ?? { score: 0 };
    entry.vectorRank = rank;
    entry.score += 1 / (k + rank);
    scoreMap.set(chunkId, entry);
  }

  const results: RrfOutput[] = [];
  for (const [chunkId, entry] of scoreMap) {
    results.push({
      chunkId,
      rrfScore: entry.score,
      ftsRank: entry.ftsRank,
      vectorRank: entry.vectorRank,
    });
  }

  results.sort((a, b) => {
    const scoreDiff = b.rrfScore - a.rrfScore;
    if (scoreDiff !== 0) return scoreDiff;
    const aMinRank = Math.min(a.ftsRank ?? Number.MAX_VALUE, a.vectorRank ?? Number.MAX_VALUE);
    const bMinRank = Math.min(b.ftsRank ?? Number.MAX_VALUE, b.vectorRank ?? Number.MAX_VALUE);
    if (aMinRank !== bMinRank) return aMinRank - bMinRank;
    return a.chunkId.localeCompare(b.chunkId);
  });

  return results.slice(0, topN);
}