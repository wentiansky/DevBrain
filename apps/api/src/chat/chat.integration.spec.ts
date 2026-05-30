process.env.DATABASE_URL =
  'postgresql://devbrain:devbrain@localhost:5432/devbrain_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../app.module';
import { QUEUE_TOKEN } from '../queue/queue.module';
import { getPrismaClient } from '@devbrain/db';

const prisma = getPrismaClient();

const mockQueue = {
  add: jest.fn().mockResolvedValue(undefined),
  getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0 }),
};

async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.warn('集成测试数据库不可达，跳过 chat 集成测试。');
    return false;
  }
}

function parseStream(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.replace('data: ', '')));
}

describe('Chat API 集成测试', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let kbWithChunks: string;
  let kbWithoutChunks: string;
  let skipTests = false;

  const itIfDb = (name: string, fn: jest.EmptyFunction) =>
    it(name, async () => {
      if (skipTests) return;
      await fn();
    });

  beforeAll(async () => {
    skipTests = !(await checkDbConnection());
    if (skipTests) return;

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

    const email = `chat-test-${Date.now()}@example.com`;
    const password = 'Test123456';

    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    accessToken = regRes.body.accessToken;
    userId = regRes.body.user.id;

    const kb1Res = await request(app.getHttpServer())
      .post('/kbs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '含 chunks 的测试 KB' })
      .expect(201);
    kbWithChunks = kb1Res.body.id;

    const kb2Res = await request(app.getHttpServer())
      .post('/kbs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '无 chunks 的测试 KB' })
      .expect(201);
    kbWithoutChunks = kb2Res.body.id;

    const doc = await prisma.document.create({
      data: {
        kbId: kbWithChunks,
        uploaderId: userId,
        sourceType: 'markdown',
        originalName: 'test.md',
        objectKey: `test-${kbWithChunks}.md`,
        mimeType: 'text/markdown',
        sizeBytes: 100,
        status: 'ready',
      },
    });

    await prisma.$queryRawUnsafe(
      `INSERT INTO "Chunk" (
        id, "documentId", "kbId", "sourceType", content,
        "contentHash", "headingPath", anchor, "tokenCount",
        embedding, metadata, "createdAt"
      )
      VALUES (
        gen_random_uuid()::text, $1::text, $2::text, $3::"SourceType",
        $4::text, $5::text, $6::text[], $7::text, $8::int,
        $9::vector, $10::jsonb, $11::timestamptz
      )`,
      doc.id,
      kbWithChunks,
      'markdown',
      '这是测试文档内容。用于验证 chat 集成测试。包含足够长度的文本来自动回答。',
      `hash-${kbWithChunks}`,
      ['测试文档'],
      'test-chunk',
      100,
      `[${Array(1024).fill(0.01).join(',')}]`,
      JSON.stringify({}),
      new Date(),
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  itIfDb('POST /kbs/:kbId/chat 有 ready chunks 时返回流式回答和 done 事件', async () => {
    const res = await request(app.getHttpServer())
      .post(`/kbs/${kbWithChunks}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '测试问题' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      })
      .expect(200);

    const events = parseStream(res.body as string);
    expect(events.length).toBeGreaterThan(0);

    const hasDelta = events.some((e) => e.type === 'delta' && e.content);
    const hasDone = events.some((e) => e.type === 'done');
    expect(hasDelta).toBe(true);
    expect(hasDone).toBe(true);

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent?.conversationId).toBeDefined();
    expect(doneEvent?.assistantMessageId).toBeDefined();
  });

  itIfDb('未登录请求被拒绝', async () => {
    await request(app.getHttpServer())
      .post(`/kbs/${kbWithChunks}/chat`)
      .send({ message: '测试' })
      .expect(401);
  });

  itIfDb('空问题返回 400', async () => {
    await request(app.getHttpServer())
      .post(`/kbs/${kbWithChunks}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '' })
      .expect(400);
  });

  itIfDb('不存在的 KB 返回 404 且不创建 Conversation/Message', async () => {
    const convoCountBefore = await prisma.conversation.count();
    const msgCountBefore = await prisma.message.count();

    await request(app.getHttpServer())
      .post('/kbs/non-existent-kb-id/chat')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '测试' })
      .expect(404);

    const convoCountAfter = await prisma.conversation.count();
    const msgCountAfter = await prisma.message.count();
    expect(convoCountAfter).toBe(convoCountBefore);
    expect(msgCountAfter).toBe(msgCountBefore);
  });

  itIfDb('查询会话列表', async () => {
    const res = await request(app.getHttpServer())
      .get(`/kbs/${kbWithChunks}/conversations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
  });

  itIfDb('消息和 citations 持久化', async () => {
    const res = await request(app.getHttpServer())
      .post(`/kbs/${kbWithChunks}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '持久化测试问题' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      })
      .expect(200);

    const events = parseStream(res.body as string);
    const doneEvent = events.find((e) => e.type === 'done');

    expect(doneEvent).toBeDefined();
    const convId = doneEvent!.conversationId as string;

    const detailRes = await request(app.getHttpServer())
      .get(`/kbs/${kbWithChunks}/conversations/${convId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const messages = detailRes.body.messages as Array<{
      role: string;
      status: string;
      content: string;
    }>;
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = messages.find((m) => m.role === 'user');
    const assistantMsg = messages.find((m) => m.role === 'assistant');

    expect(userMsg).toBeDefined();
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.status).toBe('completed');
    expect(assistantMsg!.content).toBeDefined();
    expect(assistantMsg!.content.length).toBeGreaterThan(0);
  });

  itIfDb('拒答态：无 ready chunks 时返回 rejection 事件', async () => {
    const res = await request(app.getHttpServer())
      .post(`/kbs/${kbWithoutChunks}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '测试' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      })
      .expect(200);

    const events = parseStream(res.body as string);
    const rejectionEvent = events.find((e) => e.type === 'rejection');
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent!.code).toBe('no_ready_chunks');
  });

  itIfDb('assistant 消息状态和 citations 关联', async () => {
    const res = await request(app.getHttpServer())
      .post(`/kbs/${kbWithChunks}/chat`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: '带上引用 [chunk-1]' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      })
      .expect(200);

    const events = parseStream(res.body as string);
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();

    const convId = doneEvent!.conversationId as string;
    const detailRes = await request(app.getHttpServer())
      .get(`/kbs/${kbWithChunks}/conversations/${convId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const messages = detailRes.body.messages as Array<{
      role: string;
      status: string;
      citations?: Array<{ chunkId: string }>;
    }>;
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.status).toBe('completed');
  });
});