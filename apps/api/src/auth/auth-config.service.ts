import { Injectable, Logger } from '@nestjs/common';

export interface AuthConfig {
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  refreshTokenPepper: string;
  cookieName: string;
  cookiePath: string;
  cookieSecure: boolean;
}

const DEV_DEFAULT_PEPPER = 'dev-pepper-do-not-use-in-production';
const DEV_DEFAULT_JWT_ACCESS_SECRET = 'change-me-access-secret';
const ACCESS_TOKEN_TTL_DEFAULT_SECONDS = 900;
const ACCESS_TOKEN_TTL_MAX_SECONDS = 900;
const REFRESH_TOKEN_TTL_DEFAULT_SECONDS = 604800;
const REFRESH_TOKEN_TTL_MAX_SECONDS = 604800;
const DEFAULT_COOKIE_NAME = 'devbrain_refresh';
const DEFAULT_COOKIE_PATH = '/';

@Injectable()
export class AuthConfigService {
  private readonly logger = new Logger(AuthConfigService.name);
  private readonly config: AuthConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const pepper = process.env.REFRESH_TOKEN_PEPPER;
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;

    if (isProduction && !pepper) {
      throw new Error(
        'NODE_ENV=production 但缺少 REFRESH_TOKEN_PEPPER 环境变量，API 拒绝启动',
      );
    }

    if (isProduction && (!jwtAccessSecret || jwtAccessSecret === DEV_DEFAULT_JWT_ACCESS_SECRET)) {
      throw new Error(
        'NODE_ENV=production 时 JWT_ACCESS_SECRET 不能使用默认值，API 拒绝启动',
      );
    }

    const accessTtlRaw = parseInt(
      process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? String(ACCESS_TOKEN_TTL_DEFAULT_SECONDS),
      10,
    );
    const refreshTtlRaw = parseInt(
      process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? String(REFRESH_TOKEN_TTL_DEFAULT_SECONDS),
      10,
    );

    const accessTtl = Math.min(accessTtlRaw, ACCESS_TOKEN_TTL_MAX_SECONDS);
    const refreshTtl = Math.min(refreshTtlRaw, REFRESH_TOKEN_TTL_MAX_SECONDS);

    if (accessTtlRaw > ACCESS_TOKEN_TTL_MAX_SECONDS) {
      this.logger.warn(
        `AUTH_ACCESS_TOKEN_TTL_SECONDS=${accessTtlRaw} 超过上限，已钳制为 ${ACCESS_TOKEN_TTL_MAX_SECONDS} 秒`,
      );
    }
    if (refreshTtlRaw > REFRESH_TOKEN_TTL_MAX_SECONDS) {
      this.logger.warn(
        `AUTH_REFRESH_TOKEN_TTL_SECONDS=${refreshTtlRaw} 超过上限，已钳制为 ${REFRESH_TOKEN_TTL_MAX_SECONDS} 秒`,
      );
    }

    this.config = {
      jwtAccessSecret:
        process.env.JWT_ACCESS_SECRET ?? DEV_DEFAULT_JWT_ACCESS_SECRET,
      accessTokenTtlSeconds: accessTtl,
      refreshTokenTtlSeconds: refreshTtl,
      refreshTokenPepper: pepper ?? DEV_DEFAULT_PEPPER,
      cookieName: process.env.AUTH_COOKIE_NAME ?? DEFAULT_COOKIE_NAME,
      cookiePath: process.env.AUTH_COOKIE_PATH ?? DEFAULT_COOKIE_PATH,
      cookieSecure:
        process.env.AUTH_COOKIE_SECURE === 'true'
          ? true
          : process.env.AUTH_COOKIE_SECURE === 'false'
            ? false
            : isProduction,
    };
  }

  get jwtAccessSecret(): string {
    return this.config.jwtAccessSecret;
  }

  get accessTokenTtlSeconds(): number {
    return this.config.accessTokenTtlSeconds;
  }

  get refreshTokenTtlSeconds(): number {
    return this.config.refreshTokenTtlSeconds;
  }

  get refreshTokenPepper(): string {
    return this.config.refreshTokenPepper;
  }

  get cookieName(): string {
    return this.config.cookieName;
  }

  get cookiePath(): string {
    return this.config.cookiePath;
  }

  get cookieSecure(): boolean {
    return this.config.cookieSecure;
  }

  get<T extends keyof AuthConfig>(key: T): AuthConfig[T] {
    return this.config[key];
  }
}