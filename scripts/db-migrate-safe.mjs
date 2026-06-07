#!/usr/bin/env node
// 包装 prisma migrate dev：跑完后自动清理 pgvector/FTS 索引的 forbidden DROP，
// 重建本地索引并对齐 checksum。
// 用法：pnpm --filter @devbrain/db db:migrate-safe <migration-name>

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DB_PACKAGE = join(REPO_ROOT, 'packages/db');
const MIGRATIONS_DIR = join(DB_PACKAGE, 'prisma/migrations');

const FORBIDDEN_DROPS = [
  /^DROP INDEX "Chunk_embedding_idx";\s*\n?/gm,
  /^DROP INDEX "Chunk_ftsVector_idx";\s*\n?/gm,
];

const RECREATE_SQL =
  'CREATE INDEX IF NOT EXISTS "Chunk_ftsVector_idx" ON "Chunk" USING GIN ("ftsVector");\n' +
  'CREATE INDEX IF NOT EXISTS "Chunk_embedding_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);\n';

const log = (msg) => console.log(`[migrate-safe] ${msg}`);
const fail = (msg, code = 1) => {
  console.error(`[migrate-safe] ${msg}`);
  process.exit(code);
};

const name = process.argv[2];
if (!name) {
  fail('用法: pnpm --filter @devbrain/db db:migrate-safe <migration-name>');
}

function listMigrationDirs() {
  return readdirSync(MIGRATIONS_DIR).filter((d) => {
    try {
      return statSync(join(MIGRATIONS_DIR, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

function runPrisma(args, opts = {}) {
  return spawnSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: DB_PACKAGE,
    stdio: opts.input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input: opts.input,
  });
}

const before = new Set(listMigrationDirs());

log(`运行 prisma migrate dev --name ${name}`);
const migrate = runPrisma(['migrate', 'dev', '--name', name]);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const newDirs = listMigrationDirs().filter((d) => !before.has(d));
if (newDirs.length === 0) {
  log('无新 migration 生成，结束');
  process.exit(0);
}
if (newDirs.length > 1) {
  fail(`检测到多个新 migration ${newDirs.join(', ')}，请手动检查`);
}

const newDir = newDirs[0];
const sqlPath = join(MIGRATIONS_DIR, newDir, 'migration.sql');
const original = readFileSync(sqlPath, 'utf8');
let cleaned = original;
let modified = false;
for (const re of FORBIDDEN_DROPS) {
  if (re.test(cleaned)) {
    cleaned = cleaned.replace(re, '');
    modified = true;
  }
}

if (!modified) {
  log(`${newDir}/migration.sql 无 forbidden DROP，OK`);
  process.exit(0);
}

cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
writeFileSync(sqlPath, cleaned);
log(`已从 ${newDir}/migration.sql 移除 forbidden DROP INDEX`);

log('重建本地 Chunk_embedding_idx 和 Chunk_ftsVector_idx');
const recreate = runPrisma(['db', 'execute', '--stdin', '--schema=prisma/schema.prisma'], {
  input: RECREATE_SQL,
});
if (recreate.status !== 0) fail('重建索引失败，请手动 psql 执行 RECREATE_SQL', recreate.status ?? 1);

log('清除旧 _prisma_migrations 记录');
const del = runPrisma(['db', 'execute', '--stdin', '--schema=prisma/schema.prisma'], {
  input: `DELETE FROM "_prisma_migrations" WHERE migration_name = '${newDir}';\n`,
});
if (del.status !== 0) fail('清除旧 checksum 失败', del.status ?? 1);

log('用新 SQL 标记 migration 为已应用');
const resolve_ = runPrisma(['migrate', 'resolve', '--applied', newDir]);
if (resolve_.status !== 0) process.exit(resolve_.status ?? 1);

log('完成。请在 git add 前再扫一眼 migration.sql 内容');
