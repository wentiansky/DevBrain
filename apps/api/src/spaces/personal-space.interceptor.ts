import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { PersonalSpaceService } from './personal-space.service';

@Injectable()
export class PersonalSpaceInterceptor implements NestInterceptor {
  constructor(
    private readonly personalSpaceService: PersonalSpaceService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new Error('PersonalSpaceInterceptor 要求 request.user 已认证');
    }

    const { personalSpaceId } =
      await this.personalSpaceService.ensurePersonalSpace(user.id);

    request.personalSpaceId = personalSpaceId;

    return next.handle();
  }
}