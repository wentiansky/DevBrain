import { MockLlmProvider } from './mock-llm.provider';

describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  it('应有正确的 providerName 和 model', () => {
    expect(provider.providerName).toBe('mock');
    expect(provider.model).toBe('mock-llm-v1');
  });

  it('应产生 delta 片段', async () => {
    const stream = provider.stream({
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: '你好' },
      ],
    });

    const chunks: Array<{ type: string }> = [];
    for await (const chunk of stream) {
      chunks.push({ type: chunk.type });
    }

    expect(chunks.some((c) => c.type === 'delta')).toBe(true);
    expect(chunks.some((c) => c.type === 'finish')).toBe(true);
  });

  it('应产生 finish 事件作为最后一个 chunk', async () => {
    const stream = provider.stream({
      messages: [{ role: 'user', content: 'test' }],
    });

    const chunks: Array<{ type: string }> = [];
    for await (const chunk of stream) {
      chunks.push({ type: chunk.type });
    }

    expect(chunks[chunks.length - 1].type).toBe('finish');
  });

  it('回答中应包含用户问题引用', async () => {
    const stream = provider.stream({
      messages: [{ role: 'user', content: '什么是 RAG？' }],
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.type === 'delta') {
        text += chunk.delta;
      }
    }

    expect(text).toContain('什么是 RAG');
  });

  it('不应产生 error chunk', async () => {
    const stream = provider.stream({
      messages: [{ role: 'user', content: 'test' }],
    });

    for await (const chunk of stream) {
      expect(chunk.type).not.toBe('error');
    }
  });
});