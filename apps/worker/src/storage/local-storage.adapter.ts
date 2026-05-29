import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { ObjectStorage } from '@devbrain/db';

@Injectable()
export class LocalStorageAdapter implements ObjectStorage {
  private readonly storageRoot: string;

  constructor() {
    this.storageRoot = process.env.DEV_STORAGE_ROOT ?? '.devbrain/storage';
  }

  private objectPath(objectKey: string): string {
    const safe = path.normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(path.join(this.storageRoot, safe));

    if (!fullPath.startsWith(path.resolve(this.storageRoot))) {
      throw new Error('路径穿越拒绝');
    }

    return fullPath;
  }

  createPresignedPut(): Promise<{
    uploadUrl: string;
    uploadMethod: 'PUT';
    objectKey: string;
    expiresAt: Date;
  }> {
    throw new Error('Worker 不支持创建 presigned PUT');
  }

  async headObject(objectKey: string): Promise<{
    exists: boolean;
    sizeBytes?: number;
    contentType?: string;
  }> {
    const filePath = this.objectPath(objectKey);
    try {
      const stat = await fs.stat(filePath);
      return {
        exists: true,
        sizeBytes: stat.size,
        contentType: 'application/octet-stream',
      };
    } catch {
      return { exists: false };
    }
  }

  async getObjectStream(objectKey: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.objectPath(objectKey);
    await fs.access(filePath);
    const fsSync = await import('node:fs');
    return fsSync.createReadStream(filePath);
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const filePath = this.objectPath(objectKey);
    return fs.readFile(filePath);
  }
}