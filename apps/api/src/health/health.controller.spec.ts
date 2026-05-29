import { Test, TestingModule } from '@nestjs/testing';
import { HealthController, ReadyzController } from './health.controller';
import { QUEUE_TOKEN } from '../queue/queue.module';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('应返回 ok 状态', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });
});

describe('ReadyzController', () => {
  it('Redis/BullMQ 不可达时应返回 503', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadyzController],
      providers: [
        {
          provide: QUEUE_TOKEN,
          useValue: {
            getJobCounts: async () => {
              throw new Error('ECONNREFUSED');
            },
          },
        },
      ],
    }).compile();

    const controller = module.get<ReadyzController>(ReadyzController);

    await expect(controller.check()).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        status: 'error',
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'redis_bullmq',
            status: 'error',
          }),
        ]),
      }),
    });
  });

  it('QUEUE_TOKEN 为 null 时应返回 503', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadyzController],
      providers: [
        {
          provide: QUEUE_TOKEN,
          useFactory: () => null,
        },
      ],
    }).compile();

    const controller = module.get<ReadyzController>(ReadyzController);

    await expect(controller.check()).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        status: 'error',
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'redis_bullmq',
            status: 'error',
          }),
        ]),
      }),
    });
  });
});