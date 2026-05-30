import { parseCitationsFromAnswer } from './citation-parser';

describe('parseCitationsFromAnswer', () => {
  it('应该解析 [chunk-n] 标记', () => {
    const answer = '这是回答 [chunk-1] 引用第一个 [chunk-2]';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]).toEqual({ chunkNumber: 1, order: 0 });
    expect(result.citations[1]).toEqual({ chunkNumber: 2, order: 1 });
  });

  it('应该去除回答中的裸 [chunk-n] 标记', () => {
    const answer = '回答开头 [chunk-1] 中间 [chunk-2] 结尾';
    const result = parseCitationsFromAnswer(answer);

    expect(result.cleanedAnswer).toBe('回答开头  中间  结尾');
  });

  it('应该对重复引用去重并按首次出现顺序排列', () => {
    const answer = '[chunk-1] 重复 [chunk-2] 再重复 [chunk-1] [chunk-2]';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]).toEqual({ chunkNumber: 1, order: 0 });
    expect(result.citations[1]).toEqual({ chunkNumber: 2, order: 1 });
  });

  it('应该处理多种空白和标点形态', () => {
    const answer = '文本[chunk-1]文本[chunk-2]。\n[chunk-3]\n';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(3);
    expect(result.citations.map(c => c.chunkNumber)).toEqual([1, 2, 3]);
  });

  it('应该处理没有引用的回答', () => {
    const answer = '这是一个没有任何引用的回答';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(0);
    expect(result.cleanedAnswer).toBe(answer);
  });

  it('应该按 order 递增', () => {
    const answer = '[chunk-5] [chunk-3] [chunk-1]';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations[0]).toEqual({ chunkNumber: 5, order: 0 });
    expect(result.citations[1]).toEqual({ chunkNumber: 3, order: 1 });
    expect(result.citations[2]).toEqual({ chunkNumber: 1, order: 2 });
  });

  it('应该清理多余空行', () => {
    const answer = '第一段\n\n\n\n[chunk-1]\n\n\n第二段';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(1);
    expect(result.cleanedAnswer).toMatch(/^第一段\n\n第二段$/);
  });

  it('应该支持大写 CHUNK 标记', () => {
    const answer = '[CHUNK-1] 注释 [Chunk-2]';
    const result = parseCitationsFromAnswer(answer);

    expect(result.citations).toHaveLength(2);
  });
});