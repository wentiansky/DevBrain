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
import { RetrievalService } from './retrieval.service';
import { PostgresVectorStore } from './postgres-vector-store';
import { ProviderError, ProviderErrorCodes } from '../providers/embedding/embedding-provider.interface';
import { MockEmbeddingProvider } from '../providers/embedding/mock-embedding.provider';

const prisma = getPrismaClient();

async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.warn(
      '集成测试数据库不可达，跳过 Retrieval 集成测试。请先启动测试数据库。',
    );
    return false;
  }
}

async function createKbWithReadyChunks(
  userId: string,
  spaceId: string,
): Promise<{ kbId: string; docId: string; chunkIds: string[] }> {
  const kb = await prisma.knowledgeBase.create({
    data: {
      spaceId,
      name: '测试知识库',
      createdById: userId,
    },
  });

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
    '认证模块使用 Argon2id 哈希算法，配合 JWT 双 token 方案实现安全登录。',
    '检索使用 BM25 和 pgvector 混合召回，通过 RRF 融合后再经 rerank 精排。',
  ];

  const embeddings = await embeddingProvider.embedDocuments(texts);

  const chunkIds: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const chunkResult = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Chunk" (
        id, "documentId", "kbId", "sourceType", content,
        "contentHash", "headingPath", anchor, "tokenCount",
        embedding, metadata, "createdAt"
      )
      VALUES (
        gen_random_uuid()::text, $1::text, $2::text, $3::"SourceType",
        $4::text, $5::text, $6::text[], $7::text, $8::int,
        $9::vector, $10::jsonb, $11::timestamptz
      )
      RETURNING id`,
      doc.id,
      kb.id,
      'markdown',
      texts[i],
      `hash-${i}`,
      [`章节${i + 1}`],
      `anchor-${i}`,
      20,
      `[${embeddings[i].vector.join(',')}]`,
      JSON.stringify({ ordinal: i }),
      new Date(),
    );
    if (chunkResult[0]) {
      chunkIds.push(chunkResult[0].id);
    }
  }

  return { kbId: kb.id, docId: doc.id, chunkIds };
}

describe('RetrievalService 集成测试', () => {
  let app: INestApplication;
  let retrievalService: RetrievalService;
  let vectorStore: PostgresVectorStore;
  let dbAvailable = false;

  let userId: string;
  let spaceId: string;
  let kbId: string;
  let chunkIds: string[];
  let otherUserId: string;

  beforeAll(async () => {
    dbAvailable = await checkDbConnection();
    if (!dbAvailable) return;

    const user = await prisma.user.create({
      data: {
        email: 'retrieval-test@devbrain.local',
        passwordHash: 'test-hash',
        status: 'active',
      },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: {
        email: 'other@devbrain.local',
        passwordHash: 'test-hash',
        status: 'active',
      },
    });
    otherUserId = otherUser.id;

    const space = await prisma.space.create({
      data: {
        type: 'personal',
        name: '测试个人空间',
        createdById: userId,
      },
    });
    spaceId = space.id;

    const result = await createKbWithReadyChunks(userId, spaceId);
    kbId = result.kbId;
    chunkIds = result.chunkIds;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    retrievalService = app.get(RetrievalService);
    vectorStore = app.get(PostgresVectorStore);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('数据库可用', () => {
    if (!dbAvailable) return;
    expect(dbAvailable).toBe(true);
  });

  describe('VectorStore', () => {
    it('FTS 召回应命中包含关键字的 chunks', async () => {
      if (!dbAvailable) return;

      const candidates = await vectorStore.ftsRecall(kbId, 'RAG 知识库', 20);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toHaveProperty('chunkId');
      expect(candidates[0]).toHaveProperty('ftsRank');
      expect(candidates[0]).toHaveProperty('ftsScore');
    });

    it('FTS 召回应不超过 20 个候选', async () => {
      if (!dbAvailable) return;

      const candidates = await vectorStore.ftsRecall(kbId, '知识库', 20);

      expect(candidates.length).toBeLessThanOrEqual(20);
    });

    it('FTS 召回应过滤非 ready Document', async () => {
      if (!dbAvailable) return;

      // 创建一个非 ready document
      const draftDoc = await prisma.document.create({
        data: {
          kbId,
          uploaderId: userId,
          sourceType: 'markdown',
          originalName: 'draft.md',
          objectKey: 'test/draft.md',
          status: 'processing',
        },
      });

      // 为 draft document 创建一个 chunk
      await prisma.$queryRawUnsafe(
        `INSERT INTO "Chunk" (id, "documentId", "kbId", "sourceType", content, "contentHash", "headingPath", anchor, "tokenCount", embedding, metadata, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'markdown'::"SourceType", $3, $4, $5, $6, $7, $8::vector, $9::jsonb, $10)`,
        draftDoc.id,
        kbId,
        '这个文档不应该被检索到，因为它的状态不是 ready。',
        'draft-hash',
        ['草稿'],
        'draft-anchor',
        5,
        `[${Array(1024).fill(0).join(',')}]`,
        JSON.stringify({ ordinal: 0 }),
        new Date(),
      );

      const candidates = await vectorStore.ftsRecall(kbId, '不应被检索', 20);

      // 不应该包含 draft document 的 chunk
      const draftChunks = candidates.filter(
        (c) => c.documentId === draftDoc.id,
      );
      expect(draftChunks).toHaveLength(0);
    });

    it('Vector 召回应命中相似 chunks', async () => {
      if (!dbAvailable) return;

      const embeddingProvider = new MockEmbeddingProvider();
      const [queryEmb] = await embeddingProvider.embedDocuments(['RAG 知识库系统']);

      const candidates = await vectorStore.vectorRecall(kbId, queryEmb.vector, 20);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toHaveProperty('chunkId');
      expect(candidates[0]).toHaveProperty('vectorRank');
      expect(candidates[0]).toHaveProperty('vectorDistance');
    });

    it('Vector 召回应不超过 20 个候选', async () => {
      if (!dbAvailable) return;

      const embeddingProvider = new MockEmbeddingProvider();
      const [queryEmb] = await embeddingProvider.embedDocuments(['知识库']);

      const candidates = await vectorStore.vectorRecall(kbId, queryEmb.vector, 20);

      expect(candidates.length).toBeLessThanOrEqual(20);
    });

    it('Query embedding 维度不匹配时应抛错', async () => {
      if (!dbAvailable) return;

      await expect(
        vectorStore.vectorRecall(kbId, [1, 2, 3], 20),
      ).rejects.toThrow();
    });

    it('loadCitationFields 应返回所需字段并过滤权限', async () => {
      if (!dbAvailable) return;

      if (chunkIds.length === 0) return;

      const fields = await vectorStore.loadCitationFields(userId, kbId, chunkIds);

      expect(fields.length).toBe(chunkIds.length);
      expect(fields[0]).toHaveProperty('chunkId');
      expect(fields[0]).toHaveProperty('documentId');
      expect(fields[0]).toHaveProperty('content');
      expect(fields[0]).toHaveProperty('headingPath');
    });

    it('loadCitationFields 应过滤其他用户的 chunk', async () => {
      if (!dbAvailable) return;

      if (chunkIds.length === 0) return;

      const fields = await vectorStore.loadCitationFields(otherUserId, kbId, chunkIds);

      expect(fields).toHaveLength(0);
    });
  });

  describe('RetrievalService', () => {
    it('应成功返回 top chunks', async () => {
      if (!dbAvailable) return;

      const result = await retrievalService.retrieve(userId, kbId, '什么是 RAG？');

      expect(result.status).toBe('success');
      expect(result.chunks).toBeDefined();
      expect(result.chunks!.length).toBeGreaterThan(0);
    });

    it('应返回 citation 所需字段', async () => {
      if (!dbAvailable) return;

      const result = await retrievalService.retrieve(userId, kbId, '认证');

      expect(result.status).toBe('success');
      for (const chunk of result.chunks!) {
        expect(chunk.chunkId).toBeTruthy();
        expect(chunk.documentId).toBeTruthy();
        expect(chunk.kbId).toBe(kbId);
        expect(chunk.sourceType).toBeTruthy();
        expect(chunk.content).toBeTruthy();
        expect(Array.isArray(chunk.headingPath)).toBe(true);
      }
    });

    it('越权 KB 应返回 not_found 错误', async () => {
      if (!dbAvailable) return;

      await expect(
        retrievalService.retrieve(otherUserId, kbId, '问题'),
      ).rejects.toThrow('not_found');
    });

    it('不暴露 KB 是否存在——不存在和越权返回相同错误', async () => {
      if (!dbAvailable) return;

      const fakeKbErr = retrievalService
        .retrieve(otherUserId, 'nonexistent-kb-id', '问题')
        .catch((e) => e);

      const realKbErr = retrievalService
        .retrieve(otherUserId, kbId, '问题')
        .catch((e) => e);

      const [err1, err2] = await Promise.all([fakeKbErr, realKbErr]);

      expect((err1 as Error).message).toBe('not_found');
      expect((err2 as Error).message).toBe('not_found');
    });

    it('KB 没有 ready chunks 时应返回 no_ready_chunks 拒答', async () => {
      if (!dbAvailable) return;

      const emptyKb = await prisma.knowledgeBase.create({
        data: {
          spaceId,
          name: '空知识库',
          createdById: userId,
        },
      });

      const result = await retrievalService.retrieve(
        userId,
        emptyKb.id,
        '问题',
      );

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('no_ready_chunks');
    });

    it('与已索引内容部分相关的查询应仍返回结果', async () => {
      if (!dbAvailable) return;

      const result = await retrievalService.retrieve(
        userId,
        kbId,
        'Argon2id',
      );

      expect(result.status).toBe('success');
      expect(result.chunks!.length).toBeGreaterThan(0);
    });

    it('vectorRecall 维度不匹配时应降级为 FTS-only，返回成功结果', async () => {
      if (!dbAvailable) return;

      const vectorRecallSpy = jest
        .spyOn(vectorStore, 'vectorRecall')
        .mockRejectedValueOnce(
          new ProviderError(
            ProviderErrorCodes.DIMENSION_MISMATCH,
            '查询向量维度 768 与数据库 vector(1024) 不匹配',
          ),
        );

      try {
        const result = await retrievalService.retrieve(
          userId,
          kbId,
          'RAG 知识库',
        );

        expect(result.status).toBe('success');
        expect(result.chunks).toBeDefined();
        expect(result.chunks!.length).toBeGreaterThan(0);
      } finally {
        vectorRecallSpy.mockRestore();
      }
    });
  });
});