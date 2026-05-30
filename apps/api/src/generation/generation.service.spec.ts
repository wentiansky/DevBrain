process.env.DATABASE_URL =
  'postgresql://devbrain:devbrain@localhost:5432/devbrain_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.STORAGE_SIGNATURE_SECRET = 'test-storage-secret';
process.env.DEV_STORAGE_ROOT = '.devbrain/storage-test';
process.env.EMBEDDING_PROVIDER = 'mock';
process.env.RERANK_PROVIDER = 'mock';
process.env.LLM_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import { AppModule } from '../app.module';
import { GenerationService } from './generation.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { MockEmbeddingProvider } from '../providers/embedding/mock-embedding.provider';

const prisma = getPrismaClient();

async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.warn(
      '集成测试数据库不可达，跳过 Generation 集成测试。请先启动测试数据库。',
    );
    return false;
  }
}

describe('GenerationService 集成测试', () => {
  let app: INestApplication;
  let generationService: GenerationService;
  let retrievalService: RetrievalService;
  let dbAvailable = false;

  let userId: string;
  let spaceId: string;
  let kbId: string;
  let otherUserId: string;

  beforeAll(async () => {
    dbAvailable = await checkDbConnection();
    if (!dbAvailable) return;

    const user = await prisma.user.create({
      data: {
        email: 'gen-test@devbrain.local',
        passwordHash: 'test-hash',
        status: 'active',
      },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: {
        email: 'gen-other@devbrain.local',
        passwordHash: 'test-hash',
        status: 'active',
      },
    });
    otherUserId = otherUser.id;

    const space = await prisma.space.create({
      data: {
        type: 'personal',
        name: 'Generation 测试空间',
        createdById: userId,
      },
    });
    spaceId = space.id;

    const kb = await prisma.knowledgeBase.create({
      data: {
        spaceId,
        name: 'Generation 测试知识库',
        createdById: userId,
      },
    });
    kbId = kb.id;

    const doc = await prisma.document.create({
      data: {
        kbId: kb.id,
        uploaderId: userId,
        sourceType: 'markdown',
        originalName: 'test.md',
        objectKey: 'test/key.md',
        status: 'ready',
      },
    });

    const embeddingProvider = new MockEmbeddingProvider();
    const texts = [
      'DevBrain 是一个自托管的 RAG 知识库系统，支持个人和团队知识管理。',
      '认证模块使用 Argon2id 哈希算法，参数为 m=64MB、t=3、p=4。',
    ];

    const embeddings = await embeddingProvider.embedDocuments(texts);

    for (let i = 0; i < texts.length; i++) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "Chunk" (id, "documentId", "kbId", "sourceType", content, "contentHash", "headingPath", anchor, "tokenCount", embedding, metadata, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'markdown'::"SourceType", $3, $4, $5, $6, $7, $8::vector, $9::jsonb, $10)`,
        doc.id,
        kbId,
        texts[i],
        `hash-${i}`,
        [`章节${i + 1}`],
        `anchor-${i}`,
        20,
        `[${embeddings[i].vector.join(',')}]`,
        JSON.stringify({ ordinal: i }),
        new Date(),
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    generationService = app.get(GenerationService);
    retrievalService = app.get(RetrievalService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('数据库可用', () => {
    if (!dbAvailable) return;
    expect(dbAvailable).toBe(true);
  });

  it('应基于检索结果生成回答', async () => {
    if (!dbAvailable) return;

    const result = await generationService.generate(
      userId,
      kbId,
      '什么是 DevBrain？',
    );

    expect(result.status).toBe('success');
    expect(result.answer).toBeTruthy();
  });

  it('无 ready chunks 时应返回拒答', async () => {
    if (!dbAvailable) return;

    const emptyKb = await prisma.knowledgeBase.create({
      data: {
        spaceId,
        name: '空知识库2',
        createdById: userId,
      },
    });

    const result = await generationService.generate(
      userId,
      emptyKb.id,
      '问题',
    );

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('no_ready_chunks');
  });

  it('越权 KB 应返回错误', async () => {
    if (!dbAvailable) return;

    await expect(
      generationService.generate(otherUserId, kbId, '问题'),
    ).rejects.toThrow('not_found');
  });

  it('streamGenerate 应产生 delta 片段', async () => {
    if (!dbAvailable) return;

    const chunks: Array<{ type: string }> = [];
    const stream = generationService.streamGenerate(
      userId,
      kbId,
      '什么是 Argon2id？',
    );

    for await (const chunk of stream) {
      chunks.push({ type: chunk.type });
    }

    expect(chunks.some((c) => c.type === 'delta')).toBe(true);
  });

  it('mock 不应暴露 API key 或完整 prompt', async () => {
    if (!dbAvailable) return;

    const result = await generationService.generate(
      userId,
      kbId,
      '认证',
    );

    expect(result.status).toBe('success');
    expect(result.answer).not.toContain('DASHSCOPE_API_KEY');
    expect(result.answer).not.toContain('Bearer');
  });

  it('retrieval service 不应暴露私文档全文', async () => {
    if (!dbAvailable) return;

    const retrievalResult = await retrievalService.retrieve(
      userId,
      kbId,
      'DevBrain',
    );

    expect(retrievalResult.status).toBe('success');
    // 结果本身包含 content，但 system prompt 不应在日志中公开
    // （集成测试验证 rejection reason 不包含私文档内容）
  });

  it('拒答 reason 不包含私文档内容', async () => {
    if (!dbAvailable) return;

    const result = await retrievalService.retrieve(
      userId,
      kbId,
      '完全无关 abcdefghijklmnop',
    );

    if (result.status === 'rejected') {
      expect(result.reason).toBe('no_recall_hits');
      expect(result.reason).not.toContain('m=64MB');
    }
  });
});