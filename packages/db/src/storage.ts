export interface ObjectStorage {
  createPresignedPut(params: {
    objectKey: string;
    sizeBytes: number;
    contentType: string;
    ttlSeconds?: number;
  }): Promise<{
    uploadUrl: string;
    uploadMethod: 'PUT';
    objectKey: string;
    expiresAt: Date;
  }>;

  headObject(objectKey: string): Promise<{
    exists: boolean;
    sizeBytes?: number;
    contentType?: string;
  }>;

  getObjectStream(objectKey: string): Promise<NodeJS.ReadableStream>;

  getObjectBuffer(objectKey: string): Promise<Buffer>;
}