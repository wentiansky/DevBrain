import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getPrismaClient } from '@devbrain/db';
import type { User } from '@devbrain/db';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { AuthConfigService } from './auth-config.service';
import { RegisterDto, LoginDto, AuthResponse, AuthUserResponse } from './dto/auth.dto';
import { MemoryRateLimiter } from '../common/rate-limit/memory-rate-limiter.adapter';

const prisma = getPrismaClient();

class ReplayDetectedError extends Error {
  constructor(public readonly familyId: string) {
    super('refresh_token_replay_detected');
    this.name = 'ReplayDetectedError';
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  readonly rateLimiter = new MemoryRateLimiter();

  private readonly REGISTER_WINDOW_MS = 60_000;
  private readonly LOGIN_WINDOW_MS = 60_000;
  private readonly REFRESH_WINDOW_MS = 60_000;
  private readonly REGISTER_MAX = 5;
  private readonly LOGIN_MAX_IP = 20;
  private readonly LOGIN_MAX_EMAIL = 5;
  private readonly REFRESH_MAX_IP = 30;
  private readonly REFRESH_MAX_TOKEN = 10;

  constructor(
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async register(dto: RegisterDto, req: Request, res: Response): Promise<void> {
    this.checkRateLimit(
      this.getClientIp(req),
      'register',
      this.REGISTER_MAX,
      this.REGISTER_WINDOW_MS,
    );

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          status: 'active',
        },
      });

      const { opaqueRefreshToken, tokenHash, accessToken } =
        this.tokenService.generateRefreshTokenWithUser({
          id: created.id,
          email: created.email,
          status: created.status,
        });

      const family = await tx.refreshTokenFamily.create({
        data: { userId: created.id },
      });

      const expiresAt = new Date(
        Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000,
      );

      await tx.refreshToken.create({
        data: {
          familyId: family.id,
          tokenHash,
          expiresAt,
        },
      });

      return { created, opaqueRefreshToken, accessToken };
    });

    this.setRefreshCookie(res, user.opaqueRefreshToken);

    const result: AuthResponse = {
      accessToken: user.accessToken,
      user: this.toUserResponse(user.created),
    };

    res.json(result);
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<void> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const clientIp = this.getClientIp(req);

    const ipStatus = this.rateLimiter.peek(
      clientIp, 'login', this.LOGIN_MAX_IP, this.LOGIN_WINDOW_MS,
    );
    const emailStatus = this.rateLimiter.peek(
      normalizedEmail, 'login', this.LOGIN_MAX_EMAIL, this.LOGIN_WINDOW_MS,
    );

    if (!ipStatus.allowed || !emailStatus.allowed) {
      throw new HttpException(
        '请求过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status !== 'active') {
      this.rateLimiter.record(clientIp, 'login', this.LOGIN_MAX_IP, this.LOGIN_WINDOW_MS);
      this.rateLimiter.record(normalizedEmail, 'login', this.LOGIN_MAX_EMAIL, this.LOGIN_WINDOW_MS);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const valid = await this.passwordHasher.verify(
      user.passwordHash,
      dto.password,
    );

    if (!valid) {
      this.rateLimiter.record(clientIp, 'login', this.LOGIN_MAX_IP, this.LOGIN_WINDOW_MS);
      this.rateLimiter.record(normalizedEmail, 'login', this.LOGIN_MAX_EMAIL, this.LOGIN_WINDOW_MS);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const { opaqueRefreshToken, tokenHash, accessToken } =
      this.tokenService.generateRefreshTokenWithUser({
        id: user.id,
        email: user.email,
        status: user.status,
      });

    await prisma.$transaction(async (tx) => {
      const family = await tx.refreshTokenFamily.create({
        data: { userId: user.id },
      });

      const expiresAt = new Date(
        Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000,
      );

      await tx.refreshToken.create({
        data: {
          familyId: family.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    this.setRefreshCookie(res, opaqueRefreshToken);

    const result: AuthResponse = {
      accessToken,
      user: this.toUserResponse(user),
    };

    res.json(result);
  }

  async getMe(user: User): Promise<AuthUserResponse> {
    return this.toUserResponse(user);
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const opaqueToken = req.cookies?.[this.authConfig.cookieName] as
      | string
      | undefined;

    if (!opaqueToken) {
      throw new UnauthorizedException('缺少 refresh token');
    }

    const tokenHash = this.tokenService.hashRefreshToken(opaqueToken);
    const clientIp = this.getClientIp(req);
    const derivedKey = this.tokenService.deriveRateLimitKey(tokenHash);

    if (
      !this.rateLimiter.check(
        clientIp,
        'refresh',
        this.REFRESH_MAX_IP,
        this.REFRESH_WINDOW_MS,
      ).allowed ||
      !this.rateLimiter.check(
        derivedKey,
        'refresh',
        this.REFRESH_MAX_TOKEN,
        this.REFRESH_WINDOW_MS,
      ).allowed
    ) {
      throw new HttpException(
        '请求过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { family: true },
    });

    if (!token) {
      throw new UnauthorizedException();
    }

    if (token.family.revokedAt) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('token family 已被撤销');
    }

    if (token.revokedAt) {
      throw new UnauthorizedException();
    }

    if (token.expiresAt < new Date()) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('refresh token 已过期');
    }

    const user = await prisma.user.findUnique({
      where: { id: token.family.userId },
    });

    if (!user || user.status !== 'active') {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException();
    }

    const newOpaqueToken =
      this.tokenService.generateRefreshTokenWithUser({
        id: user.id,
        email: user.email,
        status: user.status,
      }).opaqueRefreshToken;
    const newTokenHash =
      this.tokenService.hashRefreshToken(newOpaqueToken);

    const expiresAt = new Date(
      Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000,
    );

    try {
      const result = await prisma.$transaction(async (tx) => {
        const newToken = await tx.refreshToken.create({
          data: {
            familyId: token.familyId,
            tokenHash: newTokenHash,
            expiresAt,
          },
        });

        const updateResult = await tx.refreshToken.updateMany({
          where: { id: token.id, usedAt: null },
          data: {
            usedAt: new Date(),
            replacedById: newToken.id,
          },
        });

        if (updateResult.count === 0) {
          throw new ReplayDetectedError(token.familyId);
        }

        const accessToken = this.tokenService.generateAccessToken({
          sub: user.id,
          email: user.email,
          status: user.status,
        });

        return { accessToken, user, newOpaqueToken };
      });

      this.setRefreshCookie(res, result.newOpaqueToken);

      const response: AuthResponse = {
        accessToken: result.accessToken,
        user: this.toUserResponse(result.user),
      };

      res.json(response);
    } catch (err) {
      if (err instanceof ReplayDetectedError) {
        await prisma.refreshTokenFamily.update({
          where: { id: err.familyId },
          data: {
            revokedAt: new Date(),
            revokedReason: 'refresh_token_replay_detected',
          },
        });
        this.clearRefreshCookie(res);
        throw new UnauthorizedException('token family 已被撤销');
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw err;
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    const opaqueToken = req.cookies?.[this.authConfig.cookieName] as
      | string
      | undefined;

    if (opaqueToken) {
      const tokenHash = this.tokenService.hashRefreshToken(opaqueToken);

      try {
        const token = await prisma.refreshToken.findFirst({
          where: { tokenHash },
          include: { family: true },
        });

        if (token && !token.family.revokedAt) {
          await prisma.refreshTokenFamily.update({
            where: { id: token.familyId },
            data: {
              revokedAt: new Date(),
              revokedReason: 'user_logout',
            },
          });
        }
      } catch {
        this.logger.warn('注销时撤销 token family 失败，已清除 cookie');
      }
    }

    this.clearRefreshCookie(res);
    res.json({ message: '已退出' });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  private setRefreshCookie(res: Response, opaqueToken: string): void {
    res.cookie(
      this.authConfig.cookieName,
      opaqueToken,
      this.tokenService.getCookieOptions(),
    );
  }

  private clearRefreshCookie(res: Response): void {
    res.cookie(
      this.authConfig.cookieName,
      '',
      this.tokenService.getClearCookieOptions(),
    );
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }

  private checkRateLimit(
    key: string,
    action: string,
    max: number,
    windowMs: number,
  ): void {
    const result = this.rateLimiter.check(key, action, max, windowMs);
    if (!result.allowed) {
      throw new HttpException(
        '请求过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toUserResponse(user: User): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}