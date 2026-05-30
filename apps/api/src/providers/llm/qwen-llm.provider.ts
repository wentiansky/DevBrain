import type { LlmProvider, LlmGenerateParams, StreamChunk } from './llm-provider.interface';
import { ProviderErrorCodes } from '../embedding/embedding-provider.interface';

export interface QwenLlmConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export function createQwenLlmProvider(config: QwenLlmConfig): LlmProvider {
  const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com';
  const model = config.model || 'qwen-plus';
  const timeoutMs = config.timeoutMs ?? 60000;

  return {
    providerName: 'qwen',
    model,

    async *stream(params: LlmGenerateParams): AsyncIterable<StreamChunk> {
      const url = `${baseUrl}/compatible-mode/v1/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: params.messages,
            max_tokens: params.maxTokens ?? 2048,
            temperature: params.temperature ?? 0.3,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const status = response.status;
          void (await response.text().catch(() => ''));

          if (status === 401 || status === 403) {
            yield {
              type: 'error',
              errorCode: ProviderErrorCodes.AUTH_FAILED,
              message: 'LLM 服务认证失败，请检查 API Key',
            };
            return;
          }
          if (status === 429) {
            yield {
              type: 'error',
              errorCode: ProviderErrorCodes.RATE_LIMITED,
              message: 'LLM 服务请求过于频繁，请稍后重试',
            };
            return;
          }
          if (status >= 500) {
            yield {
              type: 'error',
              errorCode: ProviderErrorCodes.FAILED,
              message: `LLM 服务返回错误 (${status})`,
            };
            return;
          }
          yield {
            type: 'error',
            errorCode: ProviderErrorCodes.FAILED,
            message: `LLM 服务返回异常状态 ${status}`,
          };
          return;
        }

        if (!response.body) {
          yield {
            type: 'error',
            errorCode: ProviderErrorCodes.STREAM_INTERRUPTED,
            message: 'LLM 服务未返回流式响应体',
          };
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                yield { type: 'finish', finishReason: 'stop' };
                return;
              }

              try {
                const parsed: Record<string, unknown> = JSON.parse(data);
                const choices = parsed.choices as Array<Record<string, unknown>> | undefined;

                if (choices && choices.length > 0) {
                  const delta = choices[0].delta as Record<string, unknown> | undefined;
                  if (delta?.content) {
                    yield { type: 'delta', delta: delta.content as string };
                  }
                  if (choices[0].finish_reason) {
                    yield {
                      type: 'finish',
                      finishReason: choices[0].finish_reason as string,
                      usage: parsed.usage,
                    };
                    return;
                  }
                }
              } catch {
                // 跳过无法解析的片段行
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            yield {
              type: 'error',
              errorCode: ProviderErrorCodes.TIMEOUT,
              message: 'LLM 服务响应超时',
            };
            return;
          }
          yield {
            type: 'error',
            errorCode: ProviderErrorCodes.STREAM_INTERRUPTED,
            message: 'LLM 流式传输中断',
          };
          return;
        } finally {
          reader.releaseLock();
        }

        yield { type: 'finish', finishReason: 'stop' };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          yield {
            type: 'error',
            errorCode: ProviderErrorCodes.TIMEOUT,
            message: 'LLM 服务响应超时',
          };
          return;
        }
        const message = (err as Error).message || '';
        if (
          message.includes('fetch') ||
          message.includes('ENOTFOUND') ||
          message.includes('ECONNREFUSED') ||
          message.includes('network')
        ) {
          yield {
            type: 'error',
            errorCode: ProviderErrorCodes.NETWORK_ERROR,
            message: 'LLM 服务网络连接失败',
          };
          return;
        }
        yield {
          type: 'error',
          errorCode: ProviderErrorCodes.FAILED,
          message: 'LLM 服务调用失败',
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}