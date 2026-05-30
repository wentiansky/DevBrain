import type { RetrievalChunk } from '../retrieval/retrieval.types';

export interface PromptInput {
  query: string;
  chunks: RetrievalChunk[];
}

export interface PromptOutput {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  chunkMapping: Map<number, string>;
}

export function buildRagPrompt(input: PromptInput): PromptOutput {
  const chunkMapping = new Map<number, string>();

  const contextParts = input.chunks.map((chunk, index) => {
    const num = index + 1;
    chunkMapping.set(num, chunk.chunkId);
    const truncatedContent = chunk.content.length > 2000
      ? chunk.content.slice(0, 2000) + '\n[...内容已截断]'
      : chunk.content;
    return `[chunk-${num}] documentId=${chunk.documentId} chunkId=${chunk.chunkId} heading=${chunk.headingPath.join(' > ') || '无标题'}
${truncatedContent}`;
  });

  const systemPrompt = `你是 DevBrain 的知识库问答助手。请只基于给定的资料片段回答用户问题。
如果资料不足以回答，请输出：INSUFFICIENT_CONTEXT
回答使用中文；保留必要的代码标识、API 名称和英文专业术语。

资料片段：
${contextParts.join('\n\n')}

要求：
- 不要编造资料片段中不存在的事实。
- 使用与资料片段对应的 [chunk-n] 标记支撑关键结论。
- 如果没有足够上下文，必须只输出 INSUFFICIENT_CONTEXT。`;

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.query },
    ],
    chunkMapping,
  };
}