/**
 * smoke:rerank:dashscope — DashScope gte-rerank 真实 smoke 脚本
 *
 * 前置条件：
 * - 配置 DASHSCOPE_API_KEY 环境变量
 * - 网络可访问 https://dashscope.aliyuncs.com
 *
 * 用法：
 *   DASHSCOPE_API_KEY=<your-key> pnpm --filter @devbrain/api smoke:rerank:dashscope
 *
 * 成功输出：provider、模型名、输入候选数量、返回数量和成功状态
 * 失败输出：脱敏诊断信息（HTTP status、request id 或错误码）
 * 绝不输出 API key、完整测试文档内容或完整 provider request body
 *
 * 此脚本需要显式环境变量开启，不进入默认 pnpm test、lint 或 typecheck。
 */

import { createDashScopeRerankProvider } from '../src/providers/rerank/dashscope-rerank.provider';
import type { RerankProvider } from '../src/providers/rerank/rerank-provider.interface';

const TEST_QUERY = 'DevBrain 的认证模块使用了什么密码哈希算法？';
const TEST_DOCUMENTS = [
  { chunkId: 'chunk-1', content: 'DevBrain 是一个给开发者的自托管 RAG 知识库系统，支持个人和团队知识管理。' },
  { chunkId: 'chunk-2', content: '认证模块使用 Argon2id 哈希算法，参数为 m=64MB、t=3、p=4，配合 JWT 双 token 方案。' },
  { chunkId: 'chunk-3', content: 'PostgreSQL 16 使用 pgvector 扩展支持向量检索，同时使用 zhparser 扩展支持中文全文检索。' },
  { chunkId: 'chunk-4', content: '前端使用 Next.js App Router 和 shadcn/ui 组件库，后端使用 NestJS 框架。' },
  { chunkId: 'chunk-5', content: '对象存储使用 Cloudflare R2，通过 presigned URL 实现安全上传。' },
];

async function main(): Promise<void> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('缺少 DASHSCOPE_API_KEY 环境变量');
    console.error('用法: DASHSCOPE_API_KEY=<your-key> pnpm --filter @devbrain/api smoke:rerank:dashscope');
    process.exit(1);
    return;
  }

  let provider: RerankProvider;
  try {
    provider = createDashScopeRerankProvider({
      apiKey,
      baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
      model: process.env.RERANK_MODEL || 'gte-rerank',
      timeoutMs: parseInt(process.env.RERANK_TIMEOUT_MS || '30000', 10),
    });
  } catch (err) {
    console.error(`创建 provider 失败: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  console.log(`provider: [${provider.providerName}] | model: [${provider.model}]`);
  console.log(`输入候选数量: ${TEST_DOCUMENTS.length}`);

  try {
    const results = await provider.rerank(TEST_QUERY, TEST_DOCUMENTS, 5);

    console.log(`返回数量: ${results.length}`);
    console.log('结果:');
    for (const r of results) {
      console.log(`  index=${r.index} chunkId=${r.chunkId} score=${r.score.toFixed(4)}`);
    }

    console.log('SUCCESS | provider: [dashscope] | model: [gte-rerank]');
  } catch (err) {
    const error = err as { statusCode?: number; requestId?: string; message: string };
    console.error(
      `FAILED | provider: [dashscope] | model: [gte-rerank] | status: [${error.statusCode ?? 'N/A'}] | requestId: [${error.requestId ?? 'N/A'}] | error: [${error.message}]`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`未预期异常: ${(err as Error).message}`);
  process.exit(1);
});