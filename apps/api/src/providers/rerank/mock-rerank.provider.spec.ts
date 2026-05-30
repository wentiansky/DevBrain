import { MockRerankProvider } from './mock-rerank.provider';

describe('MockRerankProvider', () => {
  const provider = new MockRerankProvider();

  it('应有正确的 providerName 和 model', () => {
    expect(provider.providerName).toBe('mock');
    expect(provider.model).toBe('mock-rerank-v1');
  });

  it('应按输入顺序排序——索引靠前的分数更高', async () => {
    const docs = [
      { chunkId: 'a', content: '第一个' },
      { chunkId: 'b', content: '第二个' },
      { chunkId: 'c', content: '第三个' },
    ];

    const results = await provider.rerank('query', docs, 3);

    expect(results).toHaveLength(3);
    expect(results[0].chunkId).toBe('a');
    expect(results[0].score).toBe(1.0);
    expect(results[1].chunkId).toBe('b');
    expect(results[2].chunkId).toBe('c');
  });

  it('应正确截断到 topN', async () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({
      chunkId: `chunk-${i}`,
      content: `内容 ${i}`,
    }));

    const results = await provider.rerank('query', docs, 5);

    expect(results).toHaveLength(5);
  });

  it('topN 大于文档数时应返回所有文档', async () => {
    const docs = [{ chunkId: 'a', content: '内容' }];

    const results = await provider.rerank('query', docs, 10);

    expect(results).toHaveLength(1);
  });

  it('分数应递减', async () => {
    const docs = [
      { chunkId: 'a', content: 'A' },
      { chunkId: 'b', content: 'B' },
      { chunkId: 'c', content: 'C' },
    ];

    const results = await provider.rerank('query', docs, 3);

    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it('确定性——相同输入应返回相同结果', async () => {
    const docs = [
      { chunkId: 'a', content: 'A' },
      { chunkId: 'b', content: 'B' },
    ];

    const r1 = await provider.rerank('q', docs, 3);
    const r2 = await provider.rerank('q', docs, 3);

    expect(r1).toEqual(r2);
  });
});