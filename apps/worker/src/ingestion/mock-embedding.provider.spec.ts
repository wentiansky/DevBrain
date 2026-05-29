import { MockEmbeddingProvider } from './mock-embedding.provider';

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    provider = new MockEmbeddingProvider();
  });

  it('providerName 为 mock', () => {
    expect(provider.providerName).toBe('mock');
  });

  it('模型名称为 mock-embedding-v1', () => {
    expect(provider.model).toBe('mock-embedding-v1');
  });

  it('维数为 1024', () => {
    expect(provider.dimension).toBe(1024);
  });

  it('相同文本生成相同向量（确定性）', async () => {
    const text = 'test text';
    const results1 = await provider.embedDocuments([text]);
    const results2 = await provider.embedDocuments([text]);
    expect(results1[0].vector).toEqual(results2[0].vector);
  });

  it('不同文本生成不同向量', async () => {
    const results = await provider.embedDocuments(['hello', 'world']);
    expect(results.length).toBe(2);
    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(1);
    expect(results[0].vector).not.toEqual(results[1].vector);
  });

  it('返回向量维度为 1024', async () => {
    const results = await provider.embedDocuments(['test']);
    expect(results[0].vector).toHaveLength(1024);
  });

  it('批量 embedding', async () => {
    const texts = ['a', 'b', 'c', 'd', 'e'];
    const results = await provider.embedDocuments(texts);
    expect(results.length).toBe(5);
    for (const r of results) {
      expect(r.vector).toHaveLength(1024);
    }
  });
});