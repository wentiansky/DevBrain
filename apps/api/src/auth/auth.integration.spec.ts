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
import { AuthService } from './auth.service';
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
    console.warn('集成测试数据库不可达，跳过 auth 集成测试。请先启动测试数据库（如 docker compose up -d postgres）。');
    return false;
  }
}

describe('Auth API 集成测试', () => {
  let app: INestApplication;
  let authService: AuthService;
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

    authService = app.get(AuthService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const testUser = {
    email: 'test@devbrain.local',
    password: 'TestPassword123!',
  };

  async function cleanDb() {
    if (skipTests) return;
    await prisma.refreshToken.deleteMany();
    await prisma.refreshTokenFamily.deleteMany();
    await prisma.knowledgeBase.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.space.deleteMany();
    await prisma.user.deleteMany();
    authService.rateLimiter.reset();
  }

  describe('POST /auth/register', () => {
    beforeEach(cleanDb);

    itIfDb('应成功注册新用户并返回 access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.status).toBe('active');
      expect(res.body.refreshToken).toBeUndefined();
    });

    itIfDb('重复邮箱注册应失败', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    itIfDb('密码不足 8 位应失败', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@test.local', password: '1234567' })
        .expect(400);
    });

    itIfDb('无效邮箱应失败', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'ValidPass123' })
        .expect(400);
    });

    itIfDb('响应体不包含 refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'no-refresh@test.local', password: 'ValidPass123' })
        .expect(201);

      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.accessToken).toBeDefined();
    });

    itIfDb('注册应设置 refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'cookie@test.local', password: 'ValidPass123' })
        .expect(201);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
      expect(cookieStr).toContain('devbrain_refresh=');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=Strict');
      expect(cookieStr).toContain('Path=/auth');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      if (skipTests) return;
      await cleanDb();
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);
    });

    itIfDb('应成功登录并返回 access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.refreshToken).toBeUndefined();
    });

    itIfDb('错误密码应失败', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })
        .expect(401);
    });

    itIfDb('不存在的邮箱应失败', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.local', password: 'SomePass123' })
        .expect(401);
    });

    itIfDb('登录应设置 refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
      expect(cookieStr).toContain('devbrain_refresh=');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=Strict');
      expect(cookieStr).toContain('Path=/auth');
    });

    itIfDb('disabled 用户应拒绝登录', async () => {
      const user = await prisma.user.findFirst({
        where: { email: testUser.email },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'disabled' },
        });
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      if (skipTests) return;
      await cleanDb();
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);
      accessToken = res.body.accessToken;
    });

    itIfDb('应返回当前用户信息', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body.id).toBeDefined();
    });

    itIfDb('无 token 应返回 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    itIfDb('无效 token 应返回 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    itIfDb('disabled 用户 token 应返回 401', async () => {
      const user = await prisma.user.findFirst({
        where: { email: testUser.email },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'disabled' },
        });
      }

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    async function registerAndGetCookie(email: string) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'ValidPass123' })
        .expect(201);

      const cookies = res.headers['set-cookie'];
      return Array.isArray(cookies) ? cookies[0] : cookies;
    }

    beforeEach(async () => {
      await cleanDb();
    });

    itIfDb('应成功刷新 token', async () => {
      const cookie = await registerAndGetCookie('refresh1@test.local');

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie ?? '')
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('refresh1@test.local');
    });

    itIfDb('无 refresh cookie 应返回 401', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    itIfDb('旧 refresh token 重放应 revoke family', async () => {
      const originalCookie = await registerAndGetCookie(
        'replay@test.local',
      );

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', originalCookie ?? '')
        .expect(200);

      const newCookies = refreshRes.headers['set-cookie'];
      const newCookie = Array.isArray(newCookies)
        ? newCookies[0]
        : newCookies;

      expect(newCookie).toBeDefined();
      expect(newCookie).not.toEqual(originalCookie);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', originalCookie ?? '')
        .expect(401);
    });

    itIfDb('family revoke 后新 token 也失效', async () => {
      const originalCookie = await registerAndGetCookie(
        'revoke@test.local',
      );

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', originalCookie ?? '')
        .expect(200);

      const newCookies = refreshRes.headers['set-cookie'];
      const newCookie = Array.isArray(newCookies)
        ? newCookies[0]
        : newCookies;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', originalCookie ?? '')
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', newCookie ?? '')
        .expect(401);
    });

    itIfDb('refresh 应返回新 cookie', async () => {
      const cookie = await registerAndGetCookie('newcookie@test.local');

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie ?? '')
        .expect(200);

      const newCookies = res.headers['set-cookie'];
      expect(newCookies).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    beforeEach(cleanDb);

    itIfDb('应成功退出', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'logout1@test.local', password: 'ValidPass123' })
        .expect(201);

      const cookies = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieStr ?? '')
        .expect(200);
    });

    itIfDb('退出后 refresh 应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'logout2@test.local', password: 'ValidPass123' })
        .expect(201);

      const cookies = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieStr ?? '')
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieStr ?? '')
        .expect(401);
    });

    itIfDb('无 cookie 退出也应成功', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(200);
    });
  });

  describe('限流', () => {
    beforeEach(cleanDb);

    itIfDb('注册频繁应触发限流', async () => {
      let rateLimited = false;
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: `rate${i}@test.local`, password: 'ValidPass123' });

        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });

    itIfDb('登录频繁应触发限流', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'loginlimit@test.local', password: 'ValidPass123' });

      let rateLimited = false;
      for (let i = 0; i < 25; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'loginlimit@test.local', password: 'WrongPass1' });

        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });
  });

  describe('生产环境 REFRESH_TOKEN_PEPPER 校验', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalPepper = process.env.REFRESH_TOKEN_PEPPER;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.REFRESH_TOKEN_PEPPER = originalPepper;
    });

    itIfDb('生产环境缺少 REFRESH_TOKEN_PEPPER 时应 fail fast', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REFRESH_TOKEN_PEPPER;

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AuthConfigService } = require('./auth-config.service');
        new AuthConfigService();
      }).toThrow(/REFRESH_TOKEN_PEPPER/);
    });
  });
});