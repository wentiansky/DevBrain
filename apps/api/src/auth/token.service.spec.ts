import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { AuthConfigService } from './auth-config.service';

type JwtPayload = {
  sub: string;
  email: string;
  status: string;
  iat: number;
  exp: number;
};

describe('TokenService', () => {
  let tokenService: TokenService;
  let authConfig: AuthConfigService;
  let jwtService: JwtService;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.REFRESH_TOKEN_PEPPER = 'test-pepper';
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = '900';
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = '604800';
    process.env.AUTH_COOKIE_SECURE = 'false';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [AuthConfigService, TokenService],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    authConfig = module.get<AuthConfigService>(AuthConfigService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('generateAccessToken', () => {
    it('应生成有效 JWT access token', () => {
      const token = tokenService.generateAccessToken({
        sub: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('应包含 sub、email、status payload', () => {
      const token = tokenService.generateAccessToken({
        sub: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      const payload = tokenService.verifyAccessToken(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('test@example.com');
      expect(payload.status).toBe('active');
    });

    it('access token 默认 TTL 应为 15 分钟（900 秒）', () => {
      const token = tokenService.generateAccessToken({
        sub: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      const payload = jwtService.decode(token) as JwtPayload;
      expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(900);
    });
  });

  describe('verifyAccessToken', () => {
    it('有效 token 应验证通过', () => {
      const token = tokenService.generateAccessToken({
        sub: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      const payload = tokenService.verifyAccessToken(token);
      expect(payload.sub).toBe('user-1');
    });

    it('无效 token 应抛出异常', () => {
      expect(() =>
        tokenService.verifyAccessToken('invalid.token.here'),
      ).toThrow();
    });
  });

  describe('hashRefreshToken', () => {
    it('应生成 SHA-256 hash', () => {
      const hash = tokenService.hashRefreshToken('test-opaque-token');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('相同 token 应产生相同 hash', () => {
      const token = 'same-opaque-token';
      const hash1 = tokenService.hashRefreshToken(token);
      const hash2 = tokenService.hashRefreshToken(token);
      expect(hash1).toEqual(hash2);
    });

    it('不同 token 应产生不同 hash', () => {
      const hash1 = tokenService.hashRefreshToken('token-a');
      const hash2 = tokenService.hashRefreshToken('token-b');
      expect(hash1).not.toEqual(hash2);
    });

    it('不同 pepper 应产生不同 hash', () => {
      const token = 'same-token-under-test';
      const hashA = tokenService.hashRefreshToken(token);

      const originalPepper = process.env.REFRESH_TOKEN_PEPPER;
      process.env.REFRESH_TOKEN_PEPPER = 'different-pepper';
      const altConfig = new AuthConfigService();
      const altTokenService = new TokenService(jwtService, altConfig);
      const hashB = altTokenService.hashRefreshToken(token);
      process.env.REFRESH_TOKEN_PEPPER = originalPepper;

      expect(hashA).not.toEqual(hashB);
    });

    it('DB 中只保存 SHA-256 hash，不保存原始 opaque token', () => {
      const opaqueToken = 'raw-refresh-token-value';
      const hash = tokenService.hashRefreshToken(opaqueToken);
      expect(hash).not.toEqual(opaqueToken);
      expect(hash).toHaveLength(64);
    });
  });

  describe('generateRefreshTokenWithUser', () => {
    it('应返回 opaque refresh token、hash 和 access token', () => {
      const result = tokenService.generateRefreshTokenWithUser({
        id: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });

      expect(result.opaqueRefreshToken).toBeDefined();
      expect(result.tokenHash).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.opaqueRefreshToken).toHaveLength(64);
      expect(result.tokenHash).toHaveLength(64);
    });

    it('opaque refresh token 不应等于其 hash', () => {
      const result = tokenService.generateRefreshTokenWithUser({
        id: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      expect(result.opaqueRefreshToken).not.toEqual(result.tokenHash);
    });

    it('refresh token hash 应等于手动计算值', () => {
      const result = tokenService.generateRefreshTokenWithUser({
        id: 'user-1',
        email: 'test@example.com',
        status: 'active',
      });
      const computed = tokenService.hashRefreshToken(result.opaqueRefreshToken);
      expect(result.tokenHash).toEqual(computed);
    });
  });

  describe('cookie 配置', () => {
    it('应返回正确的 cookie options', () => {
      const options = tokenService.getCookieOptions();
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.path).toBe('/auth');
      expect(options.maxAge).toBe(604800 * 1000);
    });

    it('清除 cookie 的 maxAge 应为 0', () => {
      const options = tokenService.getClearCookieOptions();
      expect(options.maxAge).toBe(0);
    });
  });

  describe('deriveRateLimitKey', () => {
    it('应从 token hash 派生限流 key', () => {
      const hash =
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const key = tokenService.deriveRateLimitKey(hash);
      expect(key).toBe('abcdef123456');
      expect(key).toHaveLength(12);
    });
  });

  describe('TTL 上限', () => {
    it('access token TTL 不超过 900 秒', () => {
      expect(authConfig.accessTokenTtlSeconds).toBeLessThanOrEqual(900);
    });

    it('refresh token TTL 不超过 604800 秒（7 天）', () => {
      expect(authConfig.refreshTokenTtlSeconds).toBeLessThanOrEqual(604800);
    });
  });
});