import {
  isDocumentJobPayload,
} from './queue-constants';

describe('isDocumentJobPayload', () => {
  it('合法 payload 返回 true', () => {
    expect(
      isDocumentJobPayload({
        documentId: 'doc-1',
        kbId: 'kb-1',
        objectKey: 'key-1',
      }),
    ).toBe(true);
  });

  it('null 返回 false', () => {
    expect(isDocumentJobPayload(null)).toBe(false);
  });

  it('undefined 返回 false', () => {
    expect(isDocumentJobPayload(undefined)).toBe(false);
  });

  it('空对象返回 false', () => {
    expect(isDocumentJobPayload({})).toBe(false);
  });

  it('缺少 documentId 返回 false', () => {
    expect(
      isDocumentJobPayload({ kbId: 'kb-1', objectKey: 'key-1' }),
    ).toBe(false);
  });

  it('缺少 kbId 返回 false', () => {
    expect(
      isDocumentJobPayload({ documentId: 'doc-1', objectKey: 'key-1' }),
    ).toBe(false);
  });

  it('缺少 objectKey 返回 false', () => {
    expect(
      isDocumentJobPayload({ documentId: 'doc-1', kbId: 'kb-1' }),
    ).toBe(false);
  });

  it('documentId 为空字符串返回 false', () => {
    expect(
      isDocumentJobPayload({ documentId: '', kbId: 'kb-1', objectKey: 'key-1' }),
    ).toBe(false);
  });

  it('非对象类型返回 false', () => {
    expect(isDocumentJobPayload('string')).toBe(false);
    expect(isDocumentJobPayload(123)).toBe(false);
    expect(isDocumentJobPayload([])).toBe(false);
  });
});