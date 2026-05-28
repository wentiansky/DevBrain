import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { AuthConfigService } from './auth-config.service';
import type { CookieOptions } from 'express';

export interface TokenPair {
  accessToken: string;
  opaqueRefreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  status: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authConfig: AuthConfigService,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.authConfig.jwtAccessSecret,
      expiresIn: this.authConfig.accessTokenTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.authConfig.jwtAccessSecret,
    });
  }

  generateRefreshToken(): TokenPair {
    const opaqueRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(opaqueRefreshToken);

    const accessPayload: AccessTokenPayload = {
      sub: '',
      email: '',
      status: '',
    };
    const accessToken = this.generateAccessToken(accessPayload);

    return {
      accessToken,
      opaqueRefreshToken: tokenHash,
    };
  }

  generateRefreshTokenWithUser(user: {
    id: string;
    email: string;
    status: string;
  }): { opaqueRefreshToken: string; tokenHash: string; accessToken: string } {
    const opaqueRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(opaqueRefreshToken);
    const accessToken = this.generateAccessToken({
      sub: user.id,
      email: user.email,
      status: user.status,
    });

    return { opaqueRefreshToken, tokenHash, accessToken };
  }

  hashRefreshToken(opaqueToken: string): string {
    return createHash('sha256')
      .update(this.authConfig.refreshTokenPepper + opaqueToken)
      .digest('hex');
  }

  deriveRateLimitKey(refreshTokenHash: string): string {
    return refreshTokenHash.substring(0, 12);
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.authConfig.cookieSecure,
      sameSite: 'strict',
      path: this.authConfig.cookiePath,
      maxAge: this.authConfig.refreshTokenTtlSeconds * 1000,
    };
  }

  getClearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.authConfig.cookieSecure,
      sameSite: 'strict',
      path: this.authConfig.cookiePath,
      maxAge: 0,
    };
  }
}