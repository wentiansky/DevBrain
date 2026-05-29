import { generateAnchor } from './anchor';

describe('generateAnchor', () => {
  it('生成 h/slug/cN-hash8 格式', () => {
    const anchor = generateAnchor(['标题'], 0, 'abc123def456ghi789');
    expect(anchor).toMatch(/^h\/.+\/c0-abc123de$/);
  });

  it('无标题使用 root slug', () => {
    const anchor = generateAnchor([], 3, 'testhash00000000');
    expect(anchor).toContain('h/root/');
    expect(anchor).toContain('c3-');
  });

  it('中文标题生成 slug', () => {
    const anchor = generateAnchor(['认证设计'], 1, 'testhash');
    expect(anchor).toContain('认证设计');
  });

  it('混合中英文标题', () => {
    const anchor = generateAnchor(['DevBrain 知识库'], 2, 'testhash');
    expect(anchor).toContain('devbrain');
    expect(anchor).toContain('知识库');
  });

  it('不同 ordinal 生成不同 anchor', () => {
    const a1 = generateAnchor(['test'], 0, 'abcdefgh');
    const a2 = generateAnchor(['test'], 1, 'abcdefgh');
    expect(a1).not.toBe(a2);
    expect(a1).toContain('c0-');
    expect(a2).toContain('c1-');
  });
});