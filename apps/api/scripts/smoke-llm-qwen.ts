/**
 * smoke:llm:qwen — Qwen-Plus streaming 真实 smoke 脚本
 *
 * 前置条件：
 * - 配置 DASHSCOPE_API_KEY 环境变量
 * - 网络可访问 https://dashscope.aliyuncs.com
 *
 * 用法：
 *   DASHSCOPE_API_KEY=<your-key> pnpm --filter @devbrain/api smoke:llm:qwen
 *
 * 成功输出：provider、模型名、是否收到增量片段、片段数量和成功状态
 * 失败输出：脱敏诊断信息（HTTP status、request id 或错误码）
 * 绝不输出 API key、完整 prompt、完整回答或私文档内容
 *
 * 此脚本需要显式环境变量开启，不进入默认 pnpm test、lint 或 typecheck。
 */

import { createQwenLlmProvider } from '../src/providers/llm/qwen-llm.provider';
import type { LlmProvider } from '../src/providers/llm/llm-provider.interface';

async function main(): Promise<void> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('缺少 DASHSCOPE_API_KEY 环境变量');
    console.error('用法: DASHSCOPE_API_KEY=<your-key> pnpm --filter @devbrain/api smoke:llm:qwen');
    process.exit(1);
    return;
  }

  let provider: LlmProvider;
  try {
    provider = createQwenLlmProvider({
      apiKey,
      baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
      model: process.env.LLM_MODEL || 'qwen-plus',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
    });
  } catch (err) {
    console.error(`创建 provider 失败: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  console.log(`provider: [${provider.providerName}] | model: [${provider.model}]`);

  let deltaCount = 0;
  let fullText = '';

  try {
    const stream = provider.stream({
      messages: [
        {
          role: 'system',
          content: '你是一个技术助手。请用中文简要回答以下问题，不超过两句话。',
        },
        {
          role: 'user',
          content: '什么是 Argon2id 哈希算法？请简要说明其参数含义。',
        },
      ],
      maxTokens: 256,
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'delta') {
        deltaCount++;
        fullText += chunk.delta;
      } else if (chunk.type === 'error') {
        console.error(
          `FAILED | provider: [${provider.providerName}] | model: [${provider.model}] | errorCode: [${chunk.errorCode}] | error: [${chunk.message}]`,
        );
        process.exit(1);
        return;
      } else if (chunk.type === 'finish') {
        // 正常结束
      }
    }

    console.log(`收到增量片段: 是 | 片段数量: ${deltaCount}`);
    console.log(`回答摘要: ${fullText.slice(0, 100)}${fullText.length > 100 ? '...' : ''}`);
    console.log(`SUCCESS | provider: [${provider.providerName}] | model: [${provider.model}]`);
  } catch (err) {
    console.error(
      `FAILED | provider: [${provider.providerName}] | model: [${provider.model}] | error: [${(err as Error).message}]`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`未预期异常: ${(err as Error).message}`);
  process.exit(1);
});