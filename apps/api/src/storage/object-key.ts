import * as crypto from 'crypto';

export function generateObjectKey(params: {
  kbId: string;
  userId: string;
  fileName: string;
}): string {
  const id = crypto.randomBytes(16).toString('hex');
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${params.kbId}/${params.userId}/${id}/${safeName}`;
}