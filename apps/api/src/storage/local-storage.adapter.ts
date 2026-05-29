import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { createSignatureToken } from './signature';
import type { ObjectStorage } from '@devbrain/db';

@Injectable()
export class LocalStorageAdapter implements ObjectStorage {
  private readonly storageRoot: string;
  private readonly tokenTtl: number;

  constructor() {
    this.storageRoot = process.env.DEV_STORAGE_ROOT ?? '.devbrain/storage';
    this.tokenTtl = parseInt(
      process.env.STORAGE_TOKEN_TTL_SECONDS ?? '300',
      10,
    );
  }

  private objectPath(objectKey: string): string {
    const safe = path.normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(path.join(this.storageRoot, safe));

    if (!fullPath.startsWith(path.resolve(this.storageRoot))) {
      throw new Error('路径穿越拒绝');
    }

    return fullPath;
  }

  async createPresignedPut(params: {
    objectKey: string;
    sizeBytes: number;
    contentType: string;
    ttlSeconds?: number;
  }): Promise<{
    uploadUrl: string;
    uploadMethod: 'PUT';
    objectKey: string;
    expiresAt: Date;
  }> {
    const ttl = params.ttlSeconds ?? this.tokenTtl;
    const token = createSignatureToken(params.objectKey, params.sizeBytes, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      uploadUrl: `/storage/local/${encodeURIComponent(token)}`,
      uploadMethod: 'PUT',
      objectKey: params.objectKey,
      expiresAt,
    };
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
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`对象不存在: ${objectKey}`);
    }
    return fsSync.createReadStream(filePath);
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const filePath = this.objectPath(objectKey);
    return fs.readFile(filePath);
  }

  async putObject(
    objectKey: string,
    buffer: Buffer,
    maxContentLength: number,
    receivedLength: number,
  ): Promise<void> {
    if (!receivedLength) {
      throw new Error('Content-Length 缺失');
    }

    if (receivedLength > maxContentLength) {
      throw new Error(`内容长度 ${receivedLength} 超过签名上限 ${maxContentLength}`);
    }

    const filePath = this.objectPath(objectKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }
}