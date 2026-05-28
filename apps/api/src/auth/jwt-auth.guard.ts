import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少认证 token');
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const user = await this.authService.findUserById(payload.sub);

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('用户不存在或已禁用');
      }

      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('token 无效或已过期');
    }
  }
}