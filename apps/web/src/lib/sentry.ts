const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
] as const;

const SENSITIVE_BODY_KEYS = [
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'secret',
  'apiKey',
  'api_key',
] as const;

const SENSITIVE_PAYLOAD_FIELDS = [
  'message',
  'prompt',
  'content',
  'text',
  'body',
  'file',
  'fileContent',
  'documentContent',
  'chunkText',
  'chunk_text',
  'answer',
  'response',
] as const;

const MAX_STRING_LENGTH = 200;

const REDACTED_VALUE = '[已脱敏]';

function redactString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return REDACTED_VALUE;
  }
  return `${REDACTED_VALUE} (${value.length} chars)`;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    SENSITIVE_BODY_KEYS.some((k) => lower === k.toLowerCase()) ||
    SENSITIVE_PAYLOAD_FIELDS.some((k) => lower === k.toLowerCase())
  );
}

function isHeadersKey(key: string): boolean {
  return key.toLowerCase() === 'headers';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      return redactString(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isHeadersKey(key) && isPlainObject(val)) {
        result[key] = redactHeaders(val);
      } else if (isSensitiveKey(key) && val !== null && val !== undefined) {
        if (typeof val === 'string') {
          result[key] = redactString(val);
        } else {
          result[key] = REDACTED_VALUE;
        }
      } else {
        result[key] = sanitizeValue(val);
      }
    }
    return result;
  }

  return value;
}

function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase() as (typeof SENSITIVE_HEADERS)[number])) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export interface SafeMetadata {
  route?: string;
  status?: number;
  method?: string;
  kbId?: string;
  documentId?: string;
  conversationId?: string;
  messageId?: string;
  sourceType?: string;
  errorCode?: string;
  sizeBytes?: number;
  fileExtension?: string;
  mimeType?: string;
}

export function extractFileNameInfo(fileName?: string): {
  extension?: string;
  hasName: boolean;
} {
  if (!fileName) return { hasName: false };
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return { hasName: true };
  return {
    extension: fileName.slice(lastDot).toLowerCase(),
    hasName: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeEvent(event: any): any {
  if (event.request?.headers) {
    event.request.headers = redactHeaders(event.request.headers);
  }

  if (event.request?.data) {
    if (typeof event.request.data === 'string') {
      try {
        const parsed = JSON.parse(event.request.data);
        event.request.data = JSON.stringify(sanitizeValue(parsed));
      } catch {
        event.request.data =
          event.request.data.length > MAX_STRING_LENGTH
            ? redactString(event.request.data)
            : REDACTED_VALUE;
      }
    } else {
      event.request.data = sanitizeValue(event.request.data);
    }
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data) {
        crumb.data = sanitizeValue(crumb.data);
      }
    }
  }

  if (event.tags) {
    const safeTags: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.tags)) {
      if (isSensitiveKey(key)) {
        safeTags[key] = REDACTED_VALUE;
      } else if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        safeTags[key] = redactString(value);
      } else {
        safeTags[key] = value;
      }
    }
    event.tags = safeTags;
  }

  if (event.extra) {
    event.extra = sanitizeValue(event.extra);
  }

  return event;
}

export function isSentEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN;
  }
  return process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN;
}

export function shouldReportHttpError(status: number): boolean {
  return status >= 500;
}

export function isExpectedError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if ('status' in error && typeof (error as { status: number }).status === 'number') {
      const status = (error as { status: number }).status;
      if (status === 401 || status === 403 || status === 404) return true;
      if (status >= 400 && status < 500) return true;
    }
  }
  return false;
}
