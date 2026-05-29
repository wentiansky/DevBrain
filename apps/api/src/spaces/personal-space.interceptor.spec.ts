import { Test, TestingModule } from '@nestjs/testing';
import { PersonalSpaceInterceptor } from './personal-space.interceptor';
import { PersonalSpaceService } from './personal-space.service';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('PersonalSpaceInterceptor', () => {
  let interceptor: PersonalSpaceInterceptor;
  let personalSpaceService: jest.Mocked<PersonalSpaceService>;

  beforeEach(async () => {
    personalSpaceService = {
      ensurePersonalSpace: jest.fn(),
      createPersonalSpaceInTx: jest.fn(),
    } as unknown as jest.Mocked<PersonalSpaceService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalSpaceInterceptor,
        { provide: PersonalSpaceService, useValue: personalSpaceService },
      ],
    }).compile();

    interceptor = module.get<PersonalSpaceInterceptor>(PersonalSpaceInterceptor);
  });

  function createMockContext(user: { id: string } | null): ExecutionContext {
    const request = { user, personalSpaceId: undefined as string | undefined };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('已存在 personal space 时应读取并挂载 personalSpaceId', async () => {
    personalSpaceService.ensurePersonalSpace.mockResolvedValue({
      personalSpaceId: 'space-existing-1',
    });

    const ctx = createMockContext({ id: 'user-1' });
    const next: CallHandler = { handle: () => of('ok') };

    await interceptor.intercept(ctx, next);

    expect(personalSpaceService.ensurePersonalSpace).toHaveBeenCalledWith(
      'user-1',
    );
    const request = ctx.switchToHttp().getRequest<{ personalSpaceId?: string }>();
    expect(request.personalSpaceId).toBe('space-existing-1');
  });

  it('补建 personal space 后应挂载 personalSpaceId', async () => {
    personalSpaceService.ensurePersonalSpace.mockResolvedValue({
      personalSpaceId: 'space-new-1',
    });

    const ctx = createMockContext({ id: 'user-2' });
    const next: CallHandler = { handle: () => of('ok') };

    await interceptor.intercept(ctx, next);

    const request = ctx.switchToHttp().getRequest<{ personalSpaceId?: string }>();
    expect(request.personalSpaceId).toBe('space-new-1');
  });

  it('ensurePersonalSpace 抛错时应传播异常', async () => {
    personalSpaceService.ensurePersonalSpace.mockRejectedValue(
      new Error('DB 错误'),
    );

    const ctx = createMockContext({ id: 'user-3' });
    const next: CallHandler = { handle: () => of('ok') };

    await expect(
      interceptor.intercept(ctx, next),
    ).rejects.toThrow('DB 错误');
  });

  it('request.user 为空时应抛错', async () => {
    const ctx = createMockContext(null);
    const next: CallHandler = { handle: () => of('ok') };

    await expect(
      interceptor.intercept(ctx, next),
    ).rejects.toThrow('PersonalSpaceInterceptor 要求 request.user 已认证');
  });
});