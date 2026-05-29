export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';
export const DOCUMENT_PROCESSING_JOB = 'process-document';

export interface DocumentJobPayload {
  documentId: string;
  kbId: string;
  objectKey: string;
}

export function isDocumentJobPayload(
  payload: unknown,
): payload is DocumentJobPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.documentId === 'string' &&
    p.documentId.length > 0 &&
    typeof p.kbId === 'string' &&
    p.kbId.length > 0 &&
    typeof p.objectKey === 'string' &&
    p.objectKey.length > 0
  );
}