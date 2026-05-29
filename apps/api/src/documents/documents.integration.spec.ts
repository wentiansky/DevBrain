process.env.DATABASE_URL =
  'postgresql://devbrain:devbrain@localhost:5432/devbrain_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.STORAGE_SIGNATURE_SECRET = 'test-storage-secret';
process.env.DEV_STORAGE_ROOT = '.devbrain/storage-test';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { QUEUE_TOKEN } from '../queue/queue.module';
import { getPrismaClient } from '@devbrain/db';

const prisma = getPrismaClient();

function makeMockQueue() {
  let fail = false;
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockImplementation(async (kind?: string) => {
      if (fail) throw new Error('ECONNREFUSED');
      return kind === 'waiting' ? 0 : { waiting: 0, active: 0, completed: 0 };
    }),
    _setFail: (v: boolean) => {
      fail = v;
    },
  };
}

async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.warn(
      '集成测试数据库不可达，跳过 Documents 集成测试。请先启动测试数据库（如 docker compose up -d postgres）。',
    );
    return false;
  }
}

async function ensureCleanState(): Promise<boolean> {
  try {
    await prisma.document.deleteMany();
    await prisma.knowledgeBase.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.space.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.refreshTokenFamily.deleteMany();
    await prisma.user.deleteMany();
    return true;
  } catch (err) {
    console.warn(
      '数据库清理失败，可能因为其他测试套件正在使用该数据库。Documents 集成测试将跳过。',
      (err as Error).message,
    );
    return false;
  }
}

async function cleanStorageRoot() {
  const root = path.resolve('.devbrain/storage-test');
  try {
    await fs.rm(root, { recursive: true, force: true });
  } catch {
    // 目录不存在时忽略
  }
}

describe('Documents API 集成测试', () => {
  let app: INestApplication;
  let authService: AuthService;
  let mockQueue: ReturnType<typeof makeMockQueue>;
  let skipTests = false;

  const itIfDb = (name: string, fn: jest.EmptyFunction) =>
    it(name, async () => {
      if (skipTests) return;
      await fn();
    });

  beforeAll(async () => {
    if (!(await checkDbConnection())) {
      skipTests = true;
      return;
    }
    if (!(await ensureCleanState())) {
      skipTests = true;
      return;
    }

    if (process.env.RUN_DOC_INTEGRATION !== 'true') {
      skipTests = true;
      return;
    }

    await cleanStorageRoot();

    mockQueue = makeMockQueue();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QUEUE_TOKEN)
      .useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authService = app.get(AuthService);
    authService.rateLimiter.reset();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await cleanStorageRoot();
  });

  beforeEach(() => {
    authService?.rateLimiter.reset();
    if (mockQueue) {
      mockQueue._setFail(false);
    }
  });

  async function registerAndGetToken(
    email: string,
  ): Promise<{ accessToken: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'TestPass123' })
      .expect(201);

    return {
      accessToken: res.body.accessToken,
      userId: res.body.user.id,
    };
  }

  async function createKb(
    accessToken: string,
    name: string = '测试知识库',
  ): Promise<{ kbId: string }> {
    const res = await request(app.getHttpServer())
      .post('/kbs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name, description: '用于文档测试' })
      .expect(201);

    return { kbId: res.body.id };
  }

  describe('POST /uploads/presign', () => {
    itIfDb('应返回 presigned URL、uploadToken 和 objectKey', async () => {
      const { accessToken } = await registerAndGetToken(
        `presign-ok-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const res = await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'test.md',
          mimeType: 'text/markdown',
          sizeBytes: 1024,
        })
        .expect(201);

      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.uploadUrl).toContain('/storage/local/');
      expect(res.body.uploadMethod).toBe('PUT');
      expect(res.body.objectKey).toBeDefined();
      expect(res.body.objectKey).toContain(kbId);
      expect(res.body.expiresAt).toBeDefined();
      expect(res.body.uploadToken).toBeDefined();
      expect(res.body.uploadToken).not.toContain('/');
    });

    itIfDb('无效文件扩展名应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `presign-ext-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        })
        .expect(400);
    });

    itIfDb('文件超过 20MB 应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `presign-toobig-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'large.md',
          mimeType: 'text/markdown',
          sizeBytes: 21 * 1024 * 1024,
        })
        .expect(400);
    });

    itIfDb('无权访问 KB 应返回 404', async () => {
      const { accessToken: userAToken } = await registerAndGetToken(
        `presign-userA-${Date.now()}@test.local`,
      );
      const { accessToken: userBToken } = await registerAndGetToken(
        `presign-userB-${Date.now()}@test.local`,
      );

      const { kbId } = await createKb(userAToken);

      await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          kbId,
          fileName: 'test.md',
          mimeType: 'text/markdown',
          sizeBytes: 1024,
        })
        .expect(404);
    });

    itIfDb('未登录应返回 401', async () => {
      await request(app.getHttpServer())
        .post('/uploads/presign')
        .send({
          kbId: 'any',
          fileName: 'test.md',
          mimeType: 'text/markdown',
          sizeBytes: 1024,
        })
        .expect(401);
    });

    itIfDb('空文件名应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `presign-empty-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: '',
          mimeType: 'text/markdown',
          sizeBytes: 1024,
        })
        .expect(400);
    });
  });

  describe('完整上传闭环：presign → PUT → POST /documents → 查询', () => {
    itIfDb('应完整走通 presign → 直传 → 创建 document → 列表 → 详情', async () => {
      const { accessToken } = await registerAndGetToken(
        `e2e-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const presignRes = await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'hello.md',
          mimeType: 'text/markdown',
          sizeBytes: 100,
        })
        .expect(201);

      const { uploadUrl, uploadToken, objectKey } = presignRes.body;

      const markdownContent = '# Hello\n\n测试文档内容。\n';
      const contentBuffer = Buffer.from(markdownContent, 'utf-8');

      await request(app.getHttpServer())
        .put(uploadUrl)
        .set('Content-Length', String(contentBuffer.length))
        .send(contentBuffer)
        .expect(200);

      const createRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          objectKey,
          uploadToken,
          originalName: 'hello.md',
          mimeType: 'text/markdown',
          sizeBytes: contentBuffer.length,
        })
        .expect(201);

      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.kbId).toBe(kbId);
      expect(createRes.body.sourceType).toBe('markdown');
      expect(createRes.body.originalName).toBe('hello.md');
      expect(createRes.body.status).toBe('queued');

      const docId = createRes.body.id;

      const detailRes = await request(app.getHttpServer())
        .get(`/documents/${docId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(detailRes.body.id).toBe(docId);
      expect(detailRes.body.originalName).toBe('hello.md');

      const listRes = await request(app.getHttpServer())
        .get(`/kbs/${kbId}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listRes.body.items).toHaveLength(1);
      expect(listRes.body.items[0].id).toBe(docId);
    });
  });

  describe('POST /documents 校验', () => {
    itIfDb('签名 token 无效应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `doc-badtoken-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          objectKey: `${kbId}/any/any/test.md`,
          uploadToken: 'invalid.token.here',
          originalName: 'test.md',
        })
        .expect(400);
    });

    itIfDb('objectKey 与签名 token 不匹配应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `doc-mismatch-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const presignRes = await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'match-test.md',
          mimeType: 'text/markdown',
          sizeBytes: 100,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          objectKey: 'wrong/object/key.md',
          uploadToken: presignRes.body.uploadToken,
          originalName: 'match-test.md',
        })
        .expect(400);
    });

    itIfDb('对象未上传应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `doc-noupload-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const presignRes = await request(app.getHttpServer())
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          fileName: 'not-uploaded.md',
          mimeType: 'text/markdown',
          sizeBytes: 100,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          objectKey: presignRes.body.objectKey,
          uploadToken: presignRes.body.uploadToken,
          originalName: 'not-uploaded.md',
        })
        .expect(400);
    });

    itIfDb('objectKey 不归属当前用户应返回 400', async () => {
      const { accessToken } = await registerAndGetToken(
        `doc-hijack-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          kbId,
          objectKey: 'other-kb-id/other-user-id/test.md',
          uploadToken: 'any.token.string',
          originalName: 'test.md',
        })
        .expect(400);
    });

    itIfDb('无权访问 KB 应返回 404', async () => {
      const { accessToken: userAToken } = await registerAndGetToken(
        `doc-nowner-a-${Date.now()}@test.local`,
      );
      const { accessToken: userBToken } = await registerAndGetToken(
        `doc-nowner-b-${Date.now()}@test.local`,
      );

      const { kbId } = await createKb(userAToken);

      await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          kbId,
          objectKey: `${kbId}/any/test.md`,
          uploadToken: 'any.token',
          originalName: 'test.md',
        })
        .expect(404);
    });
  });

  describe('GET /documents/:id 和 GET /kbs/:kbId/documents', () => {
    itIfDb('不存在的 document 应返回 404', async () => {
      const { accessToken } = await registerAndGetToken(
        `detail-404-${Date.now()}@test.local`,
      );

      await request(app.getHttpServer())
        .get('/documents/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    itIfDb('新 KB 文档列表为空', async () => {
      const { accessToken } = await registerAndGetToken(
        `list-empty-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const res = await request(app.getHttpServer())
        .get(`/kbs/${kbId}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
    });

    itIfDb('文档列表按 updatedAt desc, id desc 排序', async () => {
      const { accessToken } = await registerAndGetToken(
        `list-sort-${Date.now()}@test.local`,
      );
      const { kbId } = await createKb(accessToken);

      const uploadAndCreate = async (fileName: string) => {
        const presignRes = await request(app.getHttpServer())
          .post('/uploads/presign')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            kbId,
            fileName,
            mimeType: 'text/markdown',
            sizeBytes: 50,
          })
          .expect(201);

        const content = Buffer.from('# Test\n', 'utf-8');
        await request(app.getHttpServer())
          .put(presignRes.body.uploadUrl)
          .set('Content-Length', String(content.length))
          .send(content)
          .expect(200);

        const createRes = await request(app.getHttpServer())
          .post('/documents')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            kbId,
            objectKey: presignRes.body.objectKey,
            uploadToken: presignRes.body.uploadToken,
            originalName: fileName,
          })
          .expect(201);

        return createRes.body.id;
      };

      const firstId = await uploadAndCreate('a.md');
      const secondId = await uploadAndCreate('b.md');

      const res = await request(app.getHttpServer())
        .get(`/kbs/${kbId}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].id).toBe(secondId);
      expect(res.body.items[1].id).toBe(firstId);
    });
  });

  describe('GET /readyz', () => {
    itIfDb('所有依赖正常时应返回 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/readyz')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'database', status: 'ok' }),
          expect.objectContaining({ name: 'redis_bullmq', status: 'ok' }),
        ]),
      );
    });

    itIfDb('Redis/BullMQ 不可达时应返回 503', async () => {
      mockQueue._setFail(true);

      const res = await request(app.getHttpServer()).get('/readyz');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'redis_bullmq', status: 'error' }),
        ]),
      );
    });
  });
});