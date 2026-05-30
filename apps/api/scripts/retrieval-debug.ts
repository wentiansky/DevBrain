/**
 * retrieval:debug — 本地检索调试脚本
 *
 * 前置条件：
 * - API 依赖已安装 (pnpm install)
 * - PostgreSQL 已启动，数据库中有 ready 状态的 Document 和 Chunk
 *
 * 用法：
 *   pnpm --filter @devbrain/api retrieval:debug -- --user=<userId> --kb=<kbId> --q="你的问题"
 *
 * 输出每个 top chunk 的 chunkId、rank、score、headingPath 和截断摘要（不超过 200 字符），
 * 不输出完整 chunk content、不暴露 HTTP endpoint、不写入持久日志。
 * 此脚本复用 retrieval service 的 KB 权限校验，不提供绕过权限的 admin 模式。
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RetrievalService } from '../src/retrieval/retrieval.service';

function parseArgs(): { userId: string; kbId: string; query: string } | null {
  const args = process.argv.slice(2);
  let userId = '';
  let kbId = '';
  let query = '';

  for (const arg of args) {
    if (arg.startsWith('--user=')) {
      userId = arg.slice(7);
    } else if (arg.startsWith('--kb=')) {
      kbId = arg.slice(5);
    } else if (arg.startsWith('--q=')) {
      query = arg.slice(4);
    }
  }

  if (!userId || !kbId || !query) {
    console.error('用法: pnpm --filter @devbrain/api retrieval:debug -- --user=<userId> --kb=<kbId> --q="..."');
    console.error('  --user  已认证用户 ID');
    console.error('  --kb    知识库 ID');
    console.error('  --q     检索查询文本');
    return null;
  }

  return { userId, kbId, query };
}

function truncateContent(content: string, maxLen: number = 200): string {
  const firstLine = content.split('\n')[0];
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + '...';
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('禁止在生产环境运行检索调试脚本');
    process.exit(1);
    return;
  }

  const args = parseArgs();
  if (!args) {
    process.exit(1);
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const retrievalService = app.get(RetrievalService);

  try {
    console.log(`检索查询 | userId: ${args.userId} | kbId: ${args.kbId}`);
    console.log(`query: ${args.query}`);
    console.log('');

    const result = await retrievalService.retrieve(args.userId, args.kbId, args.query);

    if (result.status === 'rejected') {
      console.log(`拒答信号 | reason: ${result.reason}`);
      return;
    }

    if (!result.chunks || result.chunks.length === 0) {
      console.log('无检索结果');
      return;
    }

    console.log(`返回 ${result.chunks.length} 个 top chunks:`);
    console.log('');

    for (let i = 0; i < result.chunks.length; i++) {
      const chunk = result.chunks[i];
      console.log(`[${i + 1}] chunkId: ${chunk.chunkId}`);
      console.log(`    documentId: ${chunk.documentId}`);
      console.log(`    headingPath: ${chunk.headingPath.join(' > ') || '无标题'}`);
      console.log(`    ftsRank: ${chunk.ftsRank ?? '-'} | vectorRank: ${chunk.vectorRank ?? '-'}`);
      console.log(`    rrfScore: ${chunk.rrfScore?.toFixed(6) ?? '-'} | rerankScore: ${chunk.rerankScore?.toFixed(4) ?? '-'}`);
      console.log(`    content: ${truncateContent(chunk.content)}`);
      console.log('');
    }
  } catch (err) {
    const message = (err as Error).message || '';
    if (message === 'not_found') {
      console.error('KB 不存在或无权访问');
    } else {
      console.error(`检索失败: ${message}`);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`未预期异常: ${(err as Error).message}`);
  process.exit(1);
});