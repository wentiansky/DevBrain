import { generateObjectKey } from './object-key';

describe('generateObjectKey', () => {
  it('生成包含 kbId、userId 和 fileName 的 key', () => {
    const key = generateObjectKey({
      kbId: 'kb-1',
      userId: 'user-1',
      fileName: 'test.md',
    });
    expect(key).toMatch(/^kb-1\/user-1\/[a-f0-9]+\/test\.md$/);
  });

  it('特殊字符文件名被替换为下划线', () => {
    const key = generateObjectKey({
      kbId: 'kb-1',
      userId: 'user-1',
      fileName: 'path/traversal..md',
    });
    expect(key).toContain('path_');
    expect(key).not.toMatch(/path\/traversal/);
  });

  it('每次生成不同的随机 key', () => {
    const key1 = generateObjectKey({
      kbId: 'kb-1',
      userId: 'user-1',
      fileName: 'doc.md',
    });
    const key2 = generateObjectKey({
      kbId: 'kb-1',
      userId: 'user-1',
      fileName: 'doc.md',
    });
    expect(key1).not.toBe(key2);
  });
});