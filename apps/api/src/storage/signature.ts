import * as crypto from 'crypto';

const SIGNATURE_ALGORITHM = 'sha256';
const SEPARATOR = '.';

interface SignedTokenPayload {
  objectKey: string;
  expiresAt: number;
  httpMethod: string;
  maxContentLength: number;
}

function getSecret(): string {
  const secret = process.env.STORAGE_SIGNATURE_SECRET;
  if (!secret) {
    throw new Error('STORAGE_SIGNATURE_SECRET 未配置');
  }
  return secret;
}

export function createSignatureToken(
  objectKey: string,
  maxContentLength: number,
  ttlSeconds: number = 300,
  httpMethod: string = 'PUT',
): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload: Omit<SignedTokenPayload, ''> = {
    objectKey,
    expiresAt,
    httpMethod,
    maxContentLength,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac(SIGNATURE_ALGORITHM, getSecret());
  hmac.update(encodedPayload);
  const signature = hmac.digest('base64url');

  return `${encodedPayload}${SEPARATOR}${signature}`;
}

export function verifySignatureToken(
  token: string,
): SignedTokenPayload | null {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  const hmac = crypto.createHmac(SIGNATURE_ALGORITHM, getSecret());
  hmac.update(encodedPayload);
  const expected = hmac.digest('base64url');

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    signatureBuf.byteLength !== expectedBuf.byteLength ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
    );
  } catch {
    return null;
  }

  if (!payload.objectKey || !payload.expiresAt || !payload.httpMethod || !payload.maxContentLength) {
    return null;
  }

  if (Date.now() > payload.expiresAt) {
    return null;
  }

  return payload;
}