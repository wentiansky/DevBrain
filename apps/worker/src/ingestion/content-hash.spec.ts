import { normalizeForHash, computeContentHash, hashPrefix, CONTENT_HASH_VERSION } from './content-hash';

describe('normalizeForHash', () => {
  it('移除 UTF-8 BOM', () => {
    const text = '\uFEFFhello';
    expect(normalizeForHash(text)).toBe('hello');
  });

  it('CRLF 统一为 LF', () => {
    const text = 'line1\r\nline2\r\nline3';
    const result = normalizeForHash(text);
    expect(result).not.toContain('\r');
    expect(result).toBe('line1\nline2\nline3');
  });

  it('CR 统一为 LF', () => {
    const text = 'line1\rline2';
    expect(normalizeForHash(text)).toBe('line1\nline2');
  });

  it('去除首尾空白', () => {
    const text = '  hello world  \n';
    expect(normalizeForHash(text)).toBe('hello world');
  });

  it('去除行尾空白', () => {
    const text = 'hello   \nworld   ';
    expect(normalizeForHash(text)).toBe('hello\nworld');
  });

  it('3 个及以上空行折叠为 2 个', () => {
    const text = 'a\n\n\n\nb\n\n\nc';
    const result = normalizeForHash(text);
    expect(result).toBe('a\n\nb\n\nc');
  });

  it('正式空格不被折叠', () => {
    const text = 'hello    world';
    expect(normalizeForHash(text)).toBe('hello    world');
  });

  it('代码缩进不被折叠', () => {
    const text = '    indented code';
    expect(normalizeForHash(text)).toBe('indented code');
  });
});

describe('computeContentHash', () => {
  it('相同内容生成稳定 hash', () => {
    const content = 'hello world';
    const headingPath = ['title'];
    const hash1 = computeContentHash(content, headingPath);
    const hash2 = computeContentHash(content, headingPath);
    expect(hash1).toBe(hash2);
  });

  it('不同内容生成不同 hash', () => {
    const hash1 = computeContentHash('hello', ['a']);
    const hash2 = computeContentHash('world', ['a']);
    expect(hash1).not.toBe(hash2);
  });

  it('不同标题路径生成不同 hash', () => {
    const hash1 = computeContentHash('same', ['path1']);
    const hash2 = computeContentHash('same', ['path2']);
    expect(hash1).not.toBe(hash2);
  });

  it('CRLF/BOM 归一后 hash 稳定', () => {
    const hash1 = computeContentHash('hello\nworld', ['a']);
    const hash2 = computeContentHash('hello\r\nworld', ['a']);
    const hash3 = computeContentHash('\uFEFFhello\nworld', ['a']);
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it('CONTENT_HASH_VERSION 为 1', () => {
    expect(CONTENT_HASH_VERSION).toBe(1);
  });
});

describe('hashPrefix', () => {
  it('返回指定长度前缀', () => {
    const hash = 'abc123def456ghi789';
    expect(hashPrefix(hash, 8)).toBe('abc123de');
  });

  it('默认长度为 8', () => {
    const hash = 'abc123def456ghi789';
    expect(hashPrefix(hash)).toHaveLength(8);
  });
});