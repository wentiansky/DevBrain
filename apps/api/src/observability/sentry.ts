import * as Sentry from '@sentry/nestjs';

const REDACTED_VALUE = '[已脱敏]';
const MAX_STRING_LENGTH = 200;
const MANUALLY_CAPTURED_ERROR = Symbol.for('devbrain.sentry.manually_captured');

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'secret',
  'apikey',
  'api_key',
  'message',
  'prompt',
  'content',
  'text',
  'body',
  'file',
  'filecontent',
  'documentcontent',
  'chunktext',
  'chunk_text',
  'answer',
  'response',
]);

const SAFE_CONTEXT_KEYS = new Set([
  'route',
  'method',
  'status',
  'kbId',
  'documentId',
  'conversationId',
  'messageId',
  'sourceType',
  'errorCode',
  'provider',
  'stage',
  'sizeBytes',
  'fileExtension',
  'mimeType',
]);

export type SafeSentryContextInput = Record<string, unknown>;
export type SafeSentryContext = Record<string, string | number | boolean>;
type ManuallyCapturedError = Error & { [MANUALLY_CAPTURED_ERROR]?: true };

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function redactString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return REDACTED_VALUE;
  return `${REDACTED_VALUE} (${value.length} chars)`;
}

function redactKnownSensitiveSubstrings(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED_VALUE}`)
    .replace(/(devbrain_refresh=)[^;\s]+/gi, `$1${REDACTED_VALUE}`)
    .replace(
      /((?:access[_-]?token|refresh[_-]?token|token|password|secret|api[_-]?key)=)[^&\s]+/gi,
      `$1${REDACTED_VALUE}`,
    );
}

function sanitizeExceptionValue(value: string): string {
  if (value.length > MAX_STRING_LENGTH) return redactString(value);
  return redactKnownSensitiveSubstrings(value);
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return redactString(value);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveKey(key) && val !== null && val !== undefined) {
        result[key] = typeof val === 'string' ? redactString(val) : REDACTED_VALUE;
      } else if (key.toLowerCase() === 'headers' && isPlainObject(val)) {
        result[key] = redactHeaders(val);
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
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  return result;
}

export function sanitizeSentryContext(context: SafeSentryContextInput): SafeSentryContext {
  const result: SafeSentryContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeSentryEvent<T extends Sentry.Event>(event: T): T {
  if (event.request?.headers) {
    event.request.headers = redactHeaders(event.request.headers as Record<string, unknown>) as Record<
      string,
      string
    >;
  }

  if (event.request?.cookies) {
    delete event.request.cookies;
  }

  if (event.request?.query_string) {
    event.request.query_string = REDACTED_VALUE;
  }

  if (event.request?.data) {
    if (typeof event.request.data === 'string') {
      try {
        event.request.data = sanitizeValue(JSON.parse(event.request.data));
      } catch {
        event.request.data = REDACTED_VALUE;
      }
    } else {
      event.request.data = sanitizeValue(event.request.data);
    }
  }

  if (event.extra) {
    event.extra = sanitizeValue(event.extra) as Record<string, unknown>;
  }

  if (event.tags) {
    event.tags = sanitizeValue(event.tags) as Record<string, string>;
  }

  if (event.contexts) {
    event.contexts = sanitizeValue(event.contexts) as Sentry.Event['contexts'];
  }

  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.data) {
        breadcrumb.data = sanitizeValue(breadcrumb.data) as Record<string, unknown>;
      }
    }
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value:
        typeof exception.value === 'string'
          ? sanitizeExceptionValue(exception.value)
          : exception.value,
    }));
  }

  return event;
}

export function markErrorManuallyCaptured(error: unknown): void {
  if (error instanceof Error) {
    (error as ManuallyCapturedError)[MANUALLY_CAPTURED_ERROR] = true;
  }
}

export function isManuallyCapturedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as ManuallyCapturedError)[MANUALLY_CAPTURED_ERROR] === true
  );
}

function isAutoFilterEvent(event: Sentry.Event): boolean {
  return (
    event.exception?.values?.some((exception) =>
      exception.mechanism?.type?.startsWith('auto.'),
    ) ?? false
  );
}

export function shouldDropSentryEvent(
  event: Sentry.Event,
  hint?: Sentry.EventHint,
): boolean {
  return isAutoFilterEvent(event) && isManuallyCapturedError(hint?.originalException);
}

export function shouldReportHttpStatus(status: number): boolean {
  return status >= 500;
}

function captureWithContext(capture: () => void, context: SafeSentryContextInput): void {
  const safeContext = sanitizeSentryContext(context);
  Sentry.withScope((scope) => {
    scope.setContext('devbrain', safeContext);
    for (const [key, value] of Object.entries(safeContext)) {
      scope.setTag(key, String(value));
    }
    capture();
  });
}

export function captureBusinessException(
  error: unknown,
  context: SafeSentryContextInput = {},
): void {
  const exception = error instanceof Error ? error : new Error(String(error));
  markErrorManuallyCaptured(exception);
  captureWithContext(() => {
    Sentry.captureException(exception);
  }, context);
}

export function captureBusinessMessage(
  message: string,
  context: SafeSentryContextInput = {},
): void {
  captureWithContext(() => {
    Sentry.captureMessage(message, 'warning');
  }, context);
}
