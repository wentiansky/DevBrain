import { tokenEstimator } from './token-estimator';

describe('TokenEstimator', () => {
  it('空文本返回 0', () => {
    expect(tokenEstimator.estimate('')).toBe(0);
  });

  it('纯英文文本估算 token', () => {
    const text = 'This is a simple English sentence.';
    const tokens = tokenEstimator.estimate(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });

  it('纯中文文本估算 token', () => {
    const text = '这是一段中文文本用于测试 token 估算。';
    const tokens = tokenEstimator.estimate(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThanOrEqual(text.length);
  });

  it('混合中英文估算 token', () => {
    const text = 'DevBrain 是一个 RAG 知识库系统。Support Markdown and more.';
    const tokens = tokenEstimator.estimate(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('款文本估算 token 数量合理', () => {
    const longText = 'a'.repeat(1000);
    const tokens = tokenEstimator.estimate(longText);
    expect(tokens).toBeLessThan(longText.length);
    expect(tokens).toBe(250);
  });
});