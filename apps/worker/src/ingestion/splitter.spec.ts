import { splitBlocks } from './splitter';
import type { MarkdownBlock } from './markdown-parser';

function makeBlock(
  text: string,
  headingPath: string[],
  type = 'paragraph',
): MarkdownBlock {
  return { text, headingPath, type };
}

describe('splitBlocks', () => {
  it('空 blocks 返回空数组', () => {
    expect(splitBlocks([])).toEqual([]);
  });

  it('单个短 block 生成一个 chunk', () => {
    const blocks = [makeBlock('短文本', ['标题'])];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBe(1);
    expect(chunks[0].headingPath).toEqual(['标题']);
    expect(chunks[0].blockTypes).toContain('paragraph');
  });

  it('相同标题路径的 block 合并到一个 chunk', () => {
    const blocks = [
      makeBlock('段落一', ['A']),
      makeBlock('段落二', ['A']),
      makeBlock('段落三', ['A']),
    ];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain('段落一');
    expect(chunks[0].content).toContain('段落三');
  });

  it('不同标题路径的 block 分到不同 chunk', () => {
    const blocks = [
      makeBlock('内容A', ['A']),
      makeBlock('内容B', ['B']),
    ];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('每个 chunk 有 ordinal', () => {
    const blocks = [
      makeBlock('A', ['a']),
      makeBlock('B', ['b']),
      makeBlock('C', ['c']),
    ];
    const chunks = splitBlocks(blocks);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].ordinal).toBe(i);
    }
  });

  it('每个 chunk 有 tokenCount', () => {
    const blocks = [makeBlock('hello', ['a'])];
    const chunks = splitBlocks(blocks);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('每个 chunk 包含 content', () => {
    const blocks = [makeBlock('hello world', ['title'])];
    const chunks = splitBlocks(blocks);
    expect(chunks[0].content).toContain('title');
    expect(chunks[0].content).toContain('hello world');
  });

  it('chunk 的 headingPath 保留标题信息', () => {
    const blocks = [makeBlock('正文', ['第一章', '第一节'])];
    const chunks = splitBlocks(blocks);
    expect(chunks[0].headingPath).toEqual(['第一章', '第一节']);
  });

  it('包含代码块的 block', () => {
    const blocks = [
      { type: 'code', text: 'console.log("hello");', headingPath: ['代码'] },
    ] as MarkdownBlock[];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBe(1);
    expect(chunks[0].blockTypes).toContain('code');
  });

  it('空白 chunk 被丢弃', () => {
    const blocks = [
      { type: 'paragraph', text: '', headingPath: [] },
    ] as MarkdownBlock[];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBe(0);
  });
});