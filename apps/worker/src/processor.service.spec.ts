import { validateMarkdownBuffer } from './processor.service';
import { DocumentErrorCodes } from '@devbrain/db';

jest.mock('./ingestion', () => ({
  parseMarkdown: jest.fn(() => [{ type: 'paragraph', text: 'mocked', headingPath: [] }]),
  splitBlocks: jest.fn(() => [
    { content: 'mocked', headingPath: [], blockTypes: ['paragraph'], tokenCount: 10, ordinal: 0, rawText: 'mocked' },
  ]),
  computeContentHash: jest.fn(() => 'abc123'),
  CONTENT_HASH_VERSION: 1,
  generateAnchor: jest.fn(() => 'h/root/c0-abc123'),
  ChunkRepository: jest.fn(() => ({ replaceDocumentChunks: jest.fn() })),
  EmbeddingProviderError: class extends Error { constructor(public errorCode: string, msg: string) { super(msg); } },
}));

describe('validateMarkdownBuffer', () => {
  it('合法 Markdown 返回 null', () => {
    const buf = Buffer.from('# Hello\n\nThis is **bold** text.\n', 'utf-8');
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });

  it('纯文本返回 null', () => {
    const buf = Buffer.from('这是一段纯文本内容，没有 markdown 语法。\n', 'utf-8');
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });

  it('中文 Markdown 返回 null', () => {
    const buf = Buffer.from('# 标题\n\n这是一段中文内容。\n', 'utf-8');
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });

  it('空 buffer 返回 markdown.empty', () => {
    const buf = Buffer.alloc(0);
    expect(validateMarkdownBuffer(buf)).toBe(DocumentErrorCodes.MARKDOWN_EMPTY);
  });

  it('超过 20MB 返回 markdown.too_large', () => {
    const buf = Buffer.alloc(21 * 1024 * 1024, 'a');
    expect(validateMarkdownBuffer(buf)).toBe(
      DocumentErrorCodes.MARKDOWN_TOO_LARGE,
    );
  });

  it('20MB 边界通过', () => {
    const buf = Buffer.alloc(20 * 1024 * 1024, '#');
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });

  it('包含 null 字节返回 markdown.binary_content', () => {
    const buf = Buffer.from([0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(validateMarkdownBuffer(buf)).toBe(
      DocumentErrorCodes.MARKDOWN_BINARY_CONTENT,
    );
  });

  it('包含控制字符返回 markdown.binary_content', () => {
    const buf = Buffer.from([
      0x01, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a,
    ]);
    expect(validateMarkdownBuffer(buf)).toBe(
      DocumentErrorCodes.MARKDOWN_BINARY_CONTENT,
    );
  });

  it('非 UTF-8 内容返回 markdown.invalid_encoding', () => {
    const buf = Buffer.from([0xff, 0xfe, 0x00, 0x00]);
    const result = validateMarkdownBuffer(buf);
    expect(result).toBe(DocumentErrorCodes.MARKDOWN_INVALID_ENCODING);
  });

  it('普通换行和制表符不触发 binary content', () => {
    const buf = Buffer.from('Line 1\n\tLine 2\nLine 3\n', 'utf-8');
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });

  it('ESC 字符 (0x1b) 不触发 binary content', () => {
    const buf = Buffer.from([0x1b, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]);
    expect(validateMarkdownBuffer(buf)).toBeNull();
  });
});