export interface EmbeddingResult {
  vector: number[];
  index: number;
}

export interface EmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimension: number;

  embedDocuments(texts: string[]): Promise<EmbeddingResult[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const ProviderErrorCodes = {
  AUTH_FAILED: 'provider.auth_failed',
  RATE_LIMITED: 'provider.rate_limited',
  TIMEOUT: 'provider.timeout',
  NETWORK_ERROR: 'provider.network_error',
  SCHEMA_MISMATCH: 'provider.schema_mismatch',
  DIMENSION_MISMATCH: 'provider.dimension_mismatch',
  STREAM_INTERRUPTED: 'provider.stream_interrupted',
  FAILED: 'provider.failed',
} as const;

export type ProviderErrorCode =
  (typeof ProviderErrorCodes)[keyof typeof ProviderErrorCodes];