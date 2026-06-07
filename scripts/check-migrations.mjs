#!/usr/bin/env node
// CI 校验：扫描所有 packages/db/prisma/migrations/*/migration.sql，
// 若含有 forbidden DROP INDEX（会废掉 pgvector HNSW / FTS GIN 索引）则 fail。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'packages/db/prisma/migrations');

const FORBIDDEN = [
  { name: 'Chunk_embedding_idx', re: /DROP\s+INDEX\s+"Chunk_embedding_idx"/i },
  { name: 'Chunk_ftsVector_idx', re: /DROP\s+INDEX\s+"Chunk_ftsVector_idx"/i },
];

let bad = false;

for (const dir of readdirSync(MIGRATIONS_DIR)) {
  const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
  let stat;
  try {
    stat = statSync(sqlPath);
  } catch {
    continue;
  }
  if (!stat.isFile()) continue;

  const content = readFileSync(sqlPath, 'utf8');
  for (const f of FORBIDDEN) {
    if (f.re.test(content)) {
      console.error(`[check-migrations] ${dir}/migration.sql 含 forbidden DROP INDEX：${f.name}`);
      bad = true;
    }
  }
}

if (bad) {
  console.error('');
  console.error('[check-migrations] 这些索引是 pgvector HNSW 和 PG FTS GIN，是检索三段法的核心。');
  console.error('[check-migrations] 请手动从 migration.sql 删除 DROP INDEX 行；本地用 pnpm db:migrate-safe 跑可避免。');
  process.exit(1);
}

console.log('[check-migrations] 所有 migration.sql 已校验通过');
