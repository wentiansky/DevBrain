import type { LlmProvider, LlmGenerateParams, StreamChunk } from './llm-provider.interface';

export class MockLlmProvider implements LlmProvider {
  readonly providerName = 'mock';
  readonly model = 'mock-llm-v1';

  async *stream(params: LlmGenerateParams): AsyncIterable<StreamChunk> {
    const userMessage = params.messages.find((m) => m.role === 'user');
    const query = userMessage?.content ?? '';

    const answer = `这是基于资料片段的模拟回答。已收到 ${params.messages.length} 条消息，用户问题是：「${query.slice(0, 50)}${query.length > 50 ? '...' : ''}」`;

    const words = answer.split('');
    for (let i = 0; i < words.length; i += 3) {
      yield { type: 'delta', delta: words.slice(i, i + 3).join('') };
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    yield { type: 'finish', finishReason: 'stop' };
  }
}