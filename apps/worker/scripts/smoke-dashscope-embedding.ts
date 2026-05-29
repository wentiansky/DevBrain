/**
 * DashScope Embedding Smoke 测试
 *
 * 前置条件:
 *   - 设置环境变量 DASHSCOPE_API_KEY
 *   - 确保机器可以访问 https://dashscope.aliyuncs.com
 *   - 可选设置 DASHSCOPE_BASE_URL（默认 https://dashscope.aliyuncs.com）
 *   - 可选设置 EMBEDDING_MODEL（默认 text-embedding-v3）
 *
 * 运行方式:
 *   pnpm --filter @devbrain/worker smoke:embedding:dashscope
 *   或手动:
 *   npx ts-node scripts/smoke-dashscope-embedding.ts
 *
 * 成功标准:
 *   - 命令输出包含 provider、模型名、向量维度和成功状态
 *   - 不会输出 API Key 或完整测试文档内容
 *
 * 失败时:
 *   - 输出 provider、模型名、HTTP status、request id 或错误码
 *   - 不会输出 API Key 或原始私文档全文
 */

import { createDashScopeEmbeddingProvider } from '../src/ingestion/dashscope-embedding.provider';
import type { EmbeddingProvider } from '../src/ingestion/embedding-provider.interface';

const TEST_TEXTS = [
  'DevBrain 是一个给开发者的自托管 RAG 知识库系统。',
  'PostgreSQL 16 使用 pgvector 扩展支持向量检索。',
  '认证模块使用 Argon2id 哈希和 JWT 双 token 方案。',
];

async function main(): Promise<void> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('❌ 缺少 DASHSCOPE_API_KEY 环境变量');
    console.error('   请设置: export DASHSCOPE_API_KEY=your-key');
    process.exit(1);
    return;
  }

  const config = {
    apiKey: apiKey,
    baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
    timeoutMs: parseInt(process.env.EMBEDDING_TIMEOUT_MS || '30000', 10),
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '20', 10),
  };

  let provider: EmbeddingProvider;
  try {
    provider = createDashScopeEmbeddingProvider(config);
  } catch (err) {
    console.error(`❌ 创建 provider 失败: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  console.log(
    `provider: [${provider.providerName}] | model: [${provider.model}] | ` +
    `dimension: [${provider.dimension}]`,
  );

  try {
    const results = await provider.embedDocuments(TEST_TEXTS);

    const dims = new Set(results.map((r) => r.vector.length));
    if (dims.size !== 1) {
      console.error(`❌ 向量维度不一致: ${[...dims].join(', ')}`);
      process.exit(1);
      return;
    }

    const dim = [...dims][0];
    if (dim !== provider.dimension) {
      console.error(
        `❌ 向量维度不匹配: 返回 ${dim}，预期 ${provider.dimension}`,
      );
      process.exit(1);
      return;
    }

    console.log(
      `SUCCESS | provider: [${provider.providerName}] | ` +
      `model: [${provider.model}] | dimension: [${dim}] | ` +
      `chunks: [${results.length}]`,
    );
  } catch (err) {
    const error = err as Error;
    console.error(
      `FAILED | provider: [${provider.providerName}] | ` +
      `model: [${provider.model}] | ` +
      `error: [${error.message}]`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`未预期异常: ${err.message}`);
  process.exit(1);
});