import { getPrismaClient } from '../index';

const prisma = getPrismaClient();

let counter = 0;
function uniqueEmail(): string {
  return `test-${++counter}-${Date.now()}@example.com`;
}

describe('核心关系约束测试', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Prisma Client 可生成并消费', async () => {
    const result = await prisma.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`;
    expect(result[0].one).toBe(1);
  });

  it('membership 唯一约束：同一 user+space 重复 membership 必须失败', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'team', name: 'Test Space', createdById: user.id },
    });

    await prisma.membership.create({
      data: { userId: user.id, spaceId: space.id, role: 'owner' },
    });

    await expect(
      prisma.membership.create({
        data: { userId: user.id, spaceId: space.id, role: 'member' },
      }),
    ).rejects.toThrow();
  });

  it('KB -> Document -> Chunk 关系可创建和查询', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'Personal Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'Test KB', createdById: user.id },
    });
    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'test.md',
        objectKey: 'r2/test.md',
        status: 'ready',
        mimeType: 'text/markdown',
        sizeBytes: 1024,
      },
    });

    const embedding = Array(1024).fill(0);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 100, ARRAY['H1']::text[], $6::vector, NOW())`,
      `chunk-${uniqueEmail()}`,
      doc.id,
      kb.id,
      '# Hello',
      'hash-1',
      `[${embedding.join(',')}]`,
    );

    const docs = await prisma.document.findMany({ where: { kbId: kb.id } });
    expect(docs).toHaveLength(1);

    const chunks = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Chunk" WHERE "kbId" = $1`,
      kb.id,
    );
    expect(chunks).toHaveLength(1);
  });

  it('Conversation -> Message -> MessageCitation 关系可创建和查询', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'Chat Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'Chat KB', createdById: user.id },
    });
    const conversation = await prisma.conversation.create({
      data: { kbId: kb.id, createdById: user.id, title: '测试会话' },
    });
    const userMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: '什么是 Kubernetes？',
        status: 'completed',
      },
    });
    expect(userMsg.content).toBe('什么是 Kubernetes？');

    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Kubernetes 是容器编排平台。',
        status: 'completed',
        provider: 'qwen',
        model: 'qwen-plus',
      },
    });

    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'markdown',
        originalName: 'k8s.md',
        objectKey: 'r2/k8s.md',
        status: 'ready',
        mimeType: 'text/markdown',
        sizeBytes: 512,
      },
    });

    const embedding = Array(1024).fill(0);
    const chunkId = `chunk-${uniqueEmail()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Chunk" ("id", "documentId", "kbId", "sourceType", "content", "contentHash", "tokenCount", "headingPath", "embedding", "createdAt")
       VALUES ($1, $2, $3, 'markdown', $4, $5, 50, ARRAY['Kubernetes']::text[], $6::vector, NOW())`,
      chunkId,
      doc.id,
      kb.id,
      'Kubernetes 是容器编排平台',
      'hash-k8s',
      `[${embedding.join(',')}]`,
    );

    const citation = await prisma.messageCitation.create({
      data: {
        messageId: assistantMsg.id,
        chunkId,
        documentId: doc.id,
        sourceType: 'markdown',
        order: 1,
        score: 0.95,
        chunkText: 'Kubernetes 是容器编排平台',
        headingPath: ['Kubernetes'],
        anchor: `chunk-${chunkId}`,
      },
    });
    expect(citation.order).toBe(1);

    const citations = await prisma.messageCitation.findMany({
      where: { messageId: assistantMsg.id },
    });
    expect(citations).toHaveLength(1);
    expect(citations[0].score).toBe(0.95);
    expect(citations[0].chunkId).toBe(chunkId);
  });

  it('KB archivedAt 和 Document deletedAt 字段可设置', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), passwordHash: 'hash' },
    });
    const space = await prisma.space.create({
      data: { type: 'personal', name: 'Delete Space', createdById: user.id },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { spaceId: space.id, name: 'Archivable KB', createdById: user.id },
    });

    const now = new Date();
    const archived = await prisma.knowledgeBase.update({
      where: { id: kb.id },
      data: { archivedAt: now },
    });
    expect(archived.archivedAt).toEqual(now);

    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: user.id,
        sourceType: 'txt',
        originalName: 'test.txt',
        objectKey: 'r2/test.txt',
        status: 'ready',
      },
    });

    const deleted = await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'deleted', deletedAt: now },
    });
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toEqual(now);
  });
});
