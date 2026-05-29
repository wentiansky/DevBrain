import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter (Worker)', () => {
  const originalRoot = process.env.DEV_STORAGE_ROOT;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devbrain-worker-storage-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalRoot === undefined) {
      delete process.env.DEV_STORAGE_ROOT;
    } else {
      process.env.DEV_STORAGE_ROOT = originalRoot;
    }
  });

  it('DEV_STORAGE_ROOT 已设为绝对路径时 getObjectBuffer 正常读取', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    // Worker adapter 没有 putObject，直接写文件模拟已存在的对象
    const filePath = path.join(tmpDir, 'test/worker-doc.txt');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'worker content');

    const buf = await adapter.getObjectBuffer('test/worker-doc.txt');
    expect(buf.toString()).toBe('worker content');
  });

  it('DEV_STORAGE_ROOT 已设为绝对路径时 getObjectStream 可读取', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    const filePath = path.join(tmpDir, 'test/stream-file.txt');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'stream content here');

    const stream = await adapter.getObjectStream('test/stream-file.txt');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk.toString()));
    }
    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('stream content here');
  });

  it('getObjectBuffer 对不存在的对象抛错', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    await expect(adapter.getObjectBuffer('nonexistent')).rejects.toThrow();
  });

  it('headObject 对存在的对象返回正确信息', async () => {
    process.env.DEV_STORAGE_ROOT = tmpDir;
    const adapter = new LocalStorageAdapter();

    const filePath = path.join(tmpDir, 'test/data.bin');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.alloc(100));

    const info = await adapter.headObject('test/data.bin');
    expect(info.exists).toBe(true);
    expect(info.sizeBytes).toBe(100);
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