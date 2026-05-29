import { Readable } from 'stream';
import type { ObjectStorage } from '@devbrain/db';

export class MemoryStorageAdapter implements ObjectStorage {
  private store = new Map<string, Buffer>();
  private meta = new Map<string, { sizeBytes: number; contentType: string }>();
  private tokenTtl = 300;

  async createPresignedPut(params: {
    objectKey: string;
    sizeBytes: number;
    contentType: string;
    ttlSeconds?: number;
  }): Promise<{ uploadUrl: string; uploadMethod: 'PUT'; objectKey: string; expiresAt: Date }> {
    const ttl = params.ttlSeconds ?? this.tokenTtl;
    return {
      uploadUrl: `/memory-put/${encodeURIComponent(params.objectKey)}`,
      uploadMethod: 'PUT',
      objectKey: params.objectKey,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }

  async headObject(objectKey: string) {
    const m = this.meta.get(objectKey);
    if (m) {
      return { exists: true, sizeBytes: m.sizeBytes, contentType: m.contentType };
    }
    return { exists: false };
  }

  async getObjectStream(objectKey: string): Promise<NodeJS.ReadableStream> {
    const buf = this.store.get(objectKey);
    if (!buf) throw new Error(`对象不存在: ${objectKey}`);
    const stream = new Readable();
    stream.push(buf);
    stream.push(null);
    return stream;
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const buf = this.store.get(objectKey);
    if (!buf) throw new Error(`对象不存在: ${objectKey}`);
    return buf;
  }

  putObject(objectKey: string, buffer: Buffer, maxSize: number): void {
    if (buffer.length > maxSize) {
      throw new Error(`内容长度 ${buffer.length} 超过上限 ${maxSize}`);
    }
    this.store.set(objectKey, buffer);
    this.meta.set(objectKey, {
      sizeBytes: buffer.length,
      contentType: 'application/octet-stream',
    });
  }

  reset(): void {
    this.store.clear();
    this.meta.clear();
  }
}