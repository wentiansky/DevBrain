export type StreamEventType = 'delta' | 'finish' | 'error';

export interface StreamDelta {
  type: 'delta';
  delta: string;
}

export interface StreamFinish {
  type: 'finish';
  finishReason?: string;
  usage?: unknown;
}

export interface StreamError {
  type: 'error';
  errorCode: string;
  message: string;
}

export type StreamChunk = StreamDelta | StreamFinish | StreamError;

export interface LlmGenerateParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmProvider {
  readonly providerName: string;
  readonly model: string;

  stream(params: LlmGenerateParams): AsyncIterable<StreamChunk>;
}