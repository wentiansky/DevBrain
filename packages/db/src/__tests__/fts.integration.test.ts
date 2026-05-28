import { getPrismaClient } from '../index';

const prisma = getPrismaClient();

let counter = 0;
function uniqueEmail(): string {
  return `fts-${++counter}-${Date.now()}@example.com`;
}

describe('中文全文检索测试', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('中文 tsquery 命中文 chunk', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'FTS Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'FTS KB', createdById: user.id },
    });
    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'guide.md',
        objectKey: 'r2/guide.md',
        status: 'ready',
      },
    });

    const embedding = Array(1024).fill(0);
    const vec = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['Kubernetes']::text[], $6::vector, NOW())`,
      `chunk-zh-${uniqueEmail()}`,
      doc.id,
      kb.id,
      'Kubernetes 是一个开源的容器编排平台，用于自动化部署、扩展和管理容器化应用程序。',
      `hash-zh-${uniqueEmail()}`,
      vec,
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['Docker']::text[], $6::vector, NOW())`,
      `chunk-doc-${uniqueEmail()}`,
      doc.id,
      kb.id,
      'Docker 是一个容器运行环境，可以打包应用及其依赖。',
      `hash-doc-${uniqueEmail()}`,
      vec,
    );

    const results = await prisma.$queryRawUnsafe<
      Array<{ id: string; content: string; rank: number }>
    >(
      `SELECT id, content, ts_rank("ftsVector", query) AS rank
       FROM "Chunk", to_tsquery('zhcfg', $1) query
       WHERE "kbId" = $2 AND "ftsVector" @@ query
       ORDER BY rank DESC`,
      '容器编排',
      kb.id,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes('Kubernetes'))).toBe(true);
  });

  it('KB 边界过滤：两个 KB 中有相似中文 chunk 时只返回目标 KB', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'Boundary Space', createdById: user.id },
    });
    const kb1 = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'KB 1', createdById: user.id },
    });
    const kb2 = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'KB 2', createdById: user.id },
    });

    const doc1 = await prisma.document.create({
      data: {
        kbId: kb1.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'k8s1.md',
        objectKey: 'r2/k8s1.md',
        status: 'ready',
      },
    });
    const doc2 = await prisma.document.create({
      data: {
        kbId: kb2.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'k8s2.md',
        objectKey: 'r2/k8s2.md',
        status: 'ready',
      },
    });

    const embedding = Array(1024).fill(0);
    const vec = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['Pod']::text[], $6::vector, NOW())`,
      `chunk-b1-${uniqueEmail()}`,
      doc1.id,
      kb1.id,
      'Pod 是 Kubernetes 中最小的部署单元，它包含一个或多个容器。',
      `hash-b1-${uniqueEmail()}`,
      vec,
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['Pod']::text[], $6::vector, NOW())`,
      `chunk-b2-${uniqueEmail()}`,
      doc2.id,
      kb2.id,
      'Pod 在 Kubernetes 中代表一组共享网络和存储的容器集合。',
      `hash-b2-${uniqueEmail()}`,
      vec,
    );

    const results = await prisma.$queryRawUnsafe<Array<{ id: string; kbId: string }>>(
      `SELECT id, "kbId" FROM "Chunk", to_tsquery('zhcfg', $1) query
       WHERE "kbId" = $2 AND "ftsVector" @@ query`,
      'Pod',
      kb1.id,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kbId === kb1.id)).toBe(true);
  });

  it('简体中文分词: "你好" 可命中', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'Tokenize Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'Tokenize KB', createdById: user.id },
    });
    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'hello.md',
        objectKey: 'r2/hello.md',
        status: 'ready',
      },
    });

    const embedding = Array(1024).fill(0);
    const vec = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['Hello']::text[], $6::vector, NOW())`,
      `chunk-hello-${uniqueEmail()}`,
      doc.id,
      kb.id,
      '你好世界，这是一个测试。',
      `hash-hello-${uniqueEmail()}`,
      vec,
    );

    const results = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Chunk", to_tsquery('zhcfg', $1) query
       WHERE "kbId" = $2 AND "ftsVector" @@ query`,
      '你好',
      kb.id,
    );

    expect(results.length).toBeGreaterThan(0);
  });

  it('不相关内容不命中', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'NoMatch Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'NoMatch KB', createdById: user.id },
    });
    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'k8s.md',
        objectKey: 'r2/k8s.md',
        status: 'ready',
      },
    });

    const embedding = Array(1024).fill(0);
    const vec = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['K8s']::text[], $6::vector, NOW())`,
      `chunk-nm-${uniqueEmail()}`,
      doc.id,
      kb.id,
      'Kubernetes 是一个容器编排平台。',
      `hash-nm-${uniqueEmail()}`,
      vec,
    );

    const results = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Chunk", to_tsquery('zhcfg', $1) query
       WHERE "kbId" = $2 AND "ftsVector" @@ query`,
      '区块链',
      kb.id,
    );

    expect(results.length).toBe(0);
  });
});
