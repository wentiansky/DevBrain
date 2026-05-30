import { buildRagPrompt } from './prompt-builder';
import type { RetrievalChunk } from '../retrieval/retrieval.types';

describe('buildRagPrompt', () => {
  const baseChunks: RetrievalChunk[] = [
    {
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      kbId: 'kb-1',
      sourceType: 'markdown',
      content: 'DevBrain 是一个自托管 RAG 知识库系统。',
      headingPath: ['概述'],
      anchor: 'overview',
      page: null,
      bbox: null,
    },
    {
      chunkId: 'chunk-2',
      documentId: 'doc-1',
      kbId: 'kb-1',
      sourceType: 'markdown',
      content: '使用 Argon2id 进行密码哈希。',
      headingPath: ['认证'],
      anchor: 'auth',
      page: null,
      bbox: null,
    },
  ];

  it('应生成包含 system 和 user 两条消息', () => {
    const result = buildRagPrompt({ query: '什么是 DevBrain？', chunks: baseChunks });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('user');
  });

  it('system prompt 应包含 chunk 标记和内容', () => {
    const result = buildRagPrompt({ query: '问题', chunks: baseChunks });

    expect(result.messages[0].content).toContain('[chunk-1]');
    expect(result.messages[0].content).toContain('chunkId=chunk-1');
    expect(result.messages[0].content).toContain('DevBrain 是一个自托管 RAG 知识库系统。');
    expect(result.messages[0].content).toContain('[chunk-2]');
  });

  it('system prompt 应包含 INSUFFICIENT_CONTEXT 指令', () => {
    const result = buildRagPrompt({ query: '问题', chunks: baseChunks });

    expect(result.messages[0].content).toContain('INSUFFICIENT_CONTEXT');
    expect(result.messages[0].content).toContain('不要编造');
  });

  it('user 消息应为原始 query', () => {
    const query = '什么是 Argon2id？';
    const result = buildRagPrompt({ query, chunks: baseChunks });

    expect(result.messages[1].content).toBe(query);
  });

  it('chunkMapping 应正确映射编号到 chunkId', () => {
    const result = buildRagPrompt({ query: '问题', chunks: baseChunks });

    expect(result.chunkMapping.get(1)).toBe('chunk-1');
    expect(result.chunkMapping.get(2)).toBe('chunk-2');
  });

  it('应处理空标题路径', () => {
    const chunks: RetrievalChunk[] = [
      {
        ...baseChunks[0],
        headingPath: [],
        chunkId: 'noheading-1',
      },
    ];

    const result = buildRagPrompt({ query: '问题', chunks });

    expect(result.messages[0].content).toContain('heading=无标题');
  });

  it('空 chunks 应仍可生成有效 prompt', () => {
    const result = buildRagPrompt({ query: '问题', chunks: [] });

    expect(result.messages).toHaveLength(2);
    expect(result.chunkMapping.size).toBe(0);
  });
});