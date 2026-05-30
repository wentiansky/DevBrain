import { MockEmbeddingProvider } from './mock-embedding.provider';

describe('MockEmbeddingProvider', () => {
  const provider = new MockEmbeddingProvider();

  it('providerName 应为 mock', () => {
    expect(provider.providerName).toBe('mock');
  });

  it('维度应为 1024', () => {
    expect(provider.dimension).toBe(1024);
  });

  it('相同输入应产生相同向量', async () => {
    const texts = ['测试文本'];
    const r1 = await provider.embedDocuments(texts);
    const r2 = await provider.embedDocuments(texts);

    expect(r1[0].vector).toEqual(r2[0].vector);
  });

  it('不同输入应产生不同向量', async () => {
    const results = await provider.embedDocuments(['文本A', '文本B']);

    expect(results[0].vector).not.toEqual(results[1].vector);
  });

  it('应正确返回 index', async () => {
    const results = await provider.embedDocuments(['a', 'b', 'c']);

    expect(results).toHaveLength(3);
    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(1);
    expect(results[2].index).toBe(2);
  });

  it('批处理应正确工作', async () => {
    const texts = Array.from({ length: 5 }, (_, i) => 'text-' + i);
    const results = await provider.embedDocuments(texts);

    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.vector).toHaveLength(1024);
    }
  });
});