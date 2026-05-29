import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  const originalRoot = process.env.DEV_STORAGE_ROOT;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devbrain-storage-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalRoot === undefined) {
      delete process.env.DEV_STORAGE_ROOT;
    } else {
      process.env.DEV_STORAGE_ROOT = originalRoot;
    }
  });

  it('DEV_STORAGE_ROOT 已设为绝对路径时 putObject/getObjectBuffer 读写正确', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    const key = 'test/doc.txt';
    const content = Buffer.from('hello devbrain');

    await adapter.putObject(key, content, content.length, content.length);

    const buf = await adapter.getObjectBuffer(key);
    expect(buf.toString()).toBe('hello devbrain');
  });

  it('headObject 对存在的对象返回正确 sizeBytes', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    const key = 'test/file.bin';
    const content = Buffer.alloc(42, 0xab);
    await adapter.putObject(key, content, content.length, content.length);

    const info = await adapter.headObject(key);
    expect(info.exists).toBe(true);
    expect(info.sizeBytes).toBe(42);
  });

  it('headObject 对不存在的对象返回 exists=false', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    const info = await adapter.headObject('nonexistent');
    expect(info.exists).toBe(false);
  });

  it('DEV_STORAGE_ROOT 未设置时 adapter 不抛错且回退到默认相对路径', () => {
    delete process.env.DEV_STORAGE_ROOT;
    const adapter = new LocalStorageAdapter();
    // 构造成功即通过 — adapter 使用 '.devbrain/storage' 作为兜底
    // 实际运行由 main.ts 保证在此之前已将绝对路径写入 process.env
    expect(adapter).toBeDefined();
  });
});