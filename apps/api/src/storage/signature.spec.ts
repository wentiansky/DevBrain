import { createSignatureToken, verifySignatureToken } from './signature';

describe('signature', () => {
  beforeAll(() => {
    process.env.STORAGE_SIGNATURE_SECRET = 'test-secret-for-signing';
  });

  it('创建并验证签名 token', () => {
    const token = createSignatureToken('test/key.md', 1024, 300);
    const payload = verifySignatureToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.objectKey).toBe('test/key.md');
    expect(payload!.maxContentLength).toBe(1024);
    expect(payload!.httpMethod).toBe('PUT');
    expect(payload!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('过期 token 返回 null', async () => {
    const token = createSignatureToken('test/key.md', 1024, 0);
    await new Promise((r) => setTimeout(r, 10));
    const payload = verifySignatureToken(token);
    expect(payload).toBeNull();
  });

  it('被篡改 token 返回 null', () => {
    const token = createSignatureToken('test/key.md', 1024, 300);
    const tampered = token.slice(0, -1) + 'X';
    const payload = verifySignatureToken(tampered);
    expect(payload).toBeNull();
  });

  it('无效格式 token 返回 null', () => {
    expect(verifySignatureToken('not-a-valid-token')).toBeNull();
    expect(verifySignatureToken('')).toBeNull();
  });

  it('缓冲区长度不一致的恶意 token 返回 null（不应抛 RangeError）', () => {
    const token = createSignatureToken('test/key.md', 1024, 300);
    const parts = token.split('.');
    const shortPayload = Buffer.from(JSON.stringify({ x: 1 })).toString('base64url');
    const malformed = `${shortPayload}.${parts[0]}`;
    expect(() => verifySignatureToken(malformed)).not.toThrow();
    expect(verifySignatureToken(malformed)).toBeNull();
  });

  it('自定义 httpMethod token 可正常签发和校验', () => {
    const token = createSignatureToken('test/key.md', 1024, 300, 'GET');
    const payload = verifySignatureToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.httpMethod).toBe('GET');
  });

  it('默认 httpMethod 为 PUT', () => {
    const token = createSignatureToken('test/key.md', 1024);
    const payload = verifySignatureToken(token);
    expect(payload!.httpMethod).toBe('PUT');
  });

  it('未配置 SECRET 时抛出错误', () => {
    const oldSecret = process.env.STORAGE_SIGNATURE_SECRET;
    delete process.env.STORAGE_SIGNATURE_SECRET;
    expect(() => createSignatureToken('test/key.md', 1024)).toThrow(
      'STORAGE_SIGNATURE_SECRET',
    );
    process.env.STORAGE_SIGNATURE_SECRET = oldSecret;
  });
});