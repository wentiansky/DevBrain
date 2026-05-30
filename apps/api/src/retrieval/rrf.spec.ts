import { computeRRF } from './rrf';

describe('computeRRF', () => {
  it('应正确计算单分支 FTS 的 RRF 分数', () => {
    const fts = [
      { chunkId: 'a', rank: 1 },
      { chunkId: 'b', rank: 2 },
      { chunkId: 'c', rank: 3 },
    ];

    const results = computeRRF(fts, [], 60, 30);

    expect(results).toHaveLength(3);
    expect(results[0].chunkId).toBe('a');
    expect(results[0].rrfScore).toBeCloseTo(1 / 61, 8);
    expect(results[0].ftsRank).toBe(1);
    expect(results[0].vectorRank).toBeUndefined();
  });

  it('应正确计算单分支 vector 的 RRF 分数', () => {
    const vector = [
      { chunkId: 'x', rank: 1 },
      { chunkId: 'y', rank: 2 },
    ];

    const results = computeRRF([], vector, 60, 30);

    expect(results).toHaveLength(2);
    expect(results[0].chunkId).toBe('x');
    expect(results[1].vectorRank).toBe(2);
  });

  it('应正确合并双分支中重复的 chunk', () => {
    const fts = [
      { chunkId: 'a', rank: 1 },
      { chunkId: 'b', rank: 2 },
    ];
    const vector = [
      { chunkId: 'a', rank: 3 },
      { chunkId: 'c', rank: 1 },
    ];

    const results = computeRRF(fts, vector, 60, 30);

    const a = results.find((r) => r.chunkId === 'a');
    expect(a).toBeDefined();
    expect(a!.ftsRank).toBe(1);
    expect(a!.vectorRank).toBe(3);
    expect(a!.rrfScore).toBeCloseTo(1 / 61 + 1 / 63, 8);
  });

  it('不应做 score normalization', () => {
    const fts = [{ chunkId: 'a', rank: 1 }];
    const vector = [{ chunkId: 'b', rank: 1 }];

    const results = computeRRF(fts, vector, 60, 30);

    expect(results[0].rrfScore).toBeCloseTo(1 / 61, 8);
    expect(results[1].rrfScore).toBeCloseTo(1 / 61, 8);
  });

  it('应按 rrfScore 降序排序', () => {
    const fts = [
      { chunkId: 'c', rank: 3 },
      { chunkId: 'a', rank: 1 },
    ];
    const vector = [{ chunkId: 'b', rank: 2 }];

    const results = computeRRF(fts, vector, 60, 30);

    expect(results[0].chunkId).toBe('a');
    expect(results[1].chunkId).toBe('b');
    expect(results[2].chunkId).toBe('c');
  });

  it('应将结果截断到 top 30', () => {
    const fts = Array.from({ length: 20 }, (_, i) => ({
      chunkId: `fts-${i + 1}`,
      rank: i + 1,
    }));
    const vector = Array.from({ length: 20 }, (_, i) => ({
      chunkId: `vec-${i + 1}`,
      rank: i + 1,
    }));

    const results = computeRRF(fts, vector, 60, 30);

    expect(results.length).toBeLessThanOrEqual(30);
  });

  it('应使用稳定 tie-breaker 处理同分候选', () => {
    const fts = [
      { chunkId: 'a', rank: 1 },
      { chunkId: 'b', rank: 1 },
    ];
    const vector = [
      { chunkId: 'a', rank: 1 },
      { chunkId: 'b', rank: 1 },
    ];

    const results1 = computeRRF(fts, vector, 60, 30);
    const results2 = computeRRF(fts, vector, 60, 30);

    expect(results1[0].chunkId).toBe(results2[0].chunkId);
    expect(results1[1].chunkId).toBe(results2[1].chunkId);
  });

  it('应正确处理空输入', () => {
    const results = computeRRF([], [], 60, 30);
    expect(results).toHaveLength(0);
  });

  it('应支持自定义 k 值', () => {
    const fts = [{ chunkId: 'a', rank: 1 }];

    const results = computeRRF(fts, [], 100, 30);

    expect(results[0].rrfScore).toBeCloseTo(1 / 101, 8);
  });
});