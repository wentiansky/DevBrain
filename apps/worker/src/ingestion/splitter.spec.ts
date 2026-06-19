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

  it('相同标题路径的相邻 chunks 注入 overlap', () => {
    const blocks = [
      makeBlock('第一段介绍上传流程和处理状态。', ['Ingestion']),
      makeBlock('第二段解释解析切块和生成向量。', ['Ingestion']),
      makeBlock('第三段说明检索召回和引用定位。', ['Ingestion']),
    ];

    const chunks = splitBlocks(blocks, { targetTokens: 18, overlapTokens: 8 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].overlapText).toBeTruthy();
    expect(chunks[1].content).toContain('[上文]');
    expect(chunks[1].content).toContain('[正文]');
    expect(chunks[1].overlapTokenCount).toBeGreaterThan(0);
    expect(chunks[1].overlapTokenCount).toBeLessThanOrEqual(8);
  });

  it('不同标题路径之间不注入 overlap', () => {
    const blocks = [
      makeBlock('第一段介绍认证。第二段继续解释 token。', ['Auth']),
      makeBlock('第一段介绍检索。第二段继续解释 rerank。', ['Retrieval']),
    ];

    const chunks = splitBlocks(blocks, { targetTokens: 20, overlapTokens: 5 });
    const retrievalChunk = chunks.find((chunk) =>
      chunk.headingPath.includes('Retrieval'),
    );

    expect(retrievalChunk).toBeDefined();
    expect(retrievalChunk?.overlapText).toBe('');
    expect(retrievalChunk?.content).not.toContain('[上文]');
  });

  it('rawText 只包含当前 chunk 主体正文', () => {
    const blocks = [
      makeBlock('第一段保留为上文来源。', ['A']),
      makeBlock('第二段是当前主体内容。', ['A']),
    ];

    const chunks = splitBlocks(blocks, { targetTokens: 12, overlapTokens: 12 });

    expect(chunks.length).toBe(2);
    expect(chunks[1].overlapText).toContain('第一段');
    expect(chunks[1].rawText).toContain('第二段');
    expect(chunks[1].rawText).not.toContain('第一段');
  });
});
