import { parseMarkdown } from './markdown-parser';

describe('parseMarkdown', () => {
  it('解析包含多级标题的 Markdown', () => {
    const md = `# 一级标题

这是一段正文。

## 二级标题

另一段正文。`;

    const blocks = parseMarkdown(md);
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    const paraBlocks = blocks.filter((b) => b.type === 'paragraph');
    expect(paraBlocks.length).toBe(2);
    expect(paraBlocks[0].headingPath).toEqual(['一级标题']);
    expect(paraBlocks[1].headingPath).toEqual(['一级标题', '二级标题']);
  });

  it('中文标题路径被保留', () => {
    const md = `# 认证设计

正文内容。

## Refresh Token

刷新令牌内容。`;

    const blocks = parseMarkdown(md);
    const headingPaths = [...new Set(blocks.map((b) => b.headingPath.join(' > ')))];
    expect(headingPaths.some((p) => p.includes('认证设计'))).toBe(true);
    expect(headingPaths.some((p) => p.includes('Refresh Token'))).toBe(true);
  });

  it('无标题文档仍可解析', () => {
    const md = `这是一段没有标题的纯文本。

还有第二段内容。`;

    const blocks = parseMarkdown(md);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => b.headingPath.length === 0)).toBe(true);
  });

  it('fenced code 不被当成标题', () => {
    const md = `# 真实标题

正文。

\`\`\`python
# 这是一段 Python 注释，不是标题
print("hello")
\`\`\`

更多正文。`;

    const blocks = parseMarkdown(md);
    const codeBlocks = blocks.filter((b) => b.type === 'code');
    expect(codeBlocks.length).toBeGreaterThan(0);

    for (const cb of codeBlocks) {
      expect(cb.headingPath).toEqual(['真实标题']);
    }

    for (const para of blocks.filter((b) => b.type === 'paragraph')) {
      expect(para.headingPath[0]).toBe('真实标题');
    }
  });

  it('列表项被解析', () => {
    const md = `# 列表测试

- 项目一
- 项目二
- 项目三`;

    const blocks = parseMarkdown(md);
    const listBlocks = blocks.filter((b) => b.type === 'list');
    expect(listBlocks.length).toBeGreaterThan(0);
    expect(listBlocks[0].headingPath).toEqual(['列表测试']);
  });

  it('段落中的加粗和斜体被提取为纯文本', () => {
    const md = `# 格式测试

这是 **加粗** 和 *斜体* 测试。`;

    const blocks = parseMarkdown(md);
    const paras = blocks.filter((b) => b.type === 'paragraph');
    expect(paras.length).toBeGreaterThan(0);
    expect(paras[0].text).toContain('加粗');
    expect(paras[0].text).toContain('斜体');
  });

  it('空白块被过滤', () => {
    const md = `# 标题


正文。`;

    const blocks = parseMarkdown(md);
    const emptyBlocks = blocks.filter((b) => b.text.trim().length === 0);
    expect(emptyBlocks.length).toBe(0);
  });
});