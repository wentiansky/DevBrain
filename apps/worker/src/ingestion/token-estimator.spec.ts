import { tokenCounter, tokenCounterMetadata } from './token-estimator';

describe('tokenCounter', () => {
  it('空文本返回 0', () => {
    expect(tokenCounter.count('')).toBe(0);
  });

  it('中英文混合文本返回稳定 token 数', () => {
    const text = 'DevBrain 是一个 RAG 知识库系统。Support Markdown and code blocks.';
    const tokens = tokenCounter.count(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(tokenCounter.count(text));
  });

  it('记录 tokenizer metadata 和近似语义', () => {
    expect(tokenCounterMetadata.tokenCounter).toBe('js-tiktoken/cl100k_base');
    expect(tokenCounterMetadata.tokenCounterKind).toBe('approximate');
    expect(tokenCounterMetadata.encoding).toBe('cl100k_base');
  });

  it('可以截取尾部约 N tokens 文本', () => {
    const text = '第一句介绍系统。第二句解释检索。第三句说明引用。第四句补充边界。';
    const tail = tokenCounter.takeTail(text, 12);
    expect(tail).toContain('第四句');
    expect(tokenCounter.count(tail)).toBeLessThanOrEqual(12);
  });
});
