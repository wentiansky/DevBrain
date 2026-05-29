import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type { Prisma } from '@devbrain/db';

const prisma = getPrismaClient();

@Injectable()
export class PersonalSpaceService {
  private readonly logger = new Logger(PersonalSpaceService.name);

  async ensurePersonalSpace(userId: string): Promise<{ personalSpaceId: string }> {
    const existing = await prisma.space.findFirst({
      where: { createdById: userId, type: 'personal' },
    });

    if (existing) {
      return { personalSpaceId: existing.id };
    }

    try {
      const space = await prisma.$transaction(async (tx) => {
        const created = await tx.space.create({
          data: {
            type: 'personal',
            name: '个人空间',
            createdById: userId,
          },
        });

        await tx.membership.create({
          data: {
            userId,
            spaceId: created.id,
            role: 'owner',
          },
        });

        return created;
      });

      this.logger.log(`为用户 ${userId} 创建 personal space: ${space.id}`);
      return { personalSpaceId: space.id };
    } catch (err) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        const recovered = await prisma.space.findFirst({
          where: { createdById: userId, type: 'personal' },
        });

        if (!recovered) {
          throw new Error(
            `personal space 唯一约束冲突后无法恢复查询 userId=${userId}`,
          );
        }

        this.logger.log(
          `并发补建 personal space userId=${userId}，恢复已有: ${recovered.id}`,
        );
        return { personalSpaceId: recovered.id };
      }
      throw err;
    }
  }

  async createPersonalSpaceInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const space = await tx.space.create({
      data: {
        type: 'personal',
        name: '个人空间',
        createdById: userId,
      },
    });

    await tx.membership.create({
      data: {
        userId,
        spaceId: space.id,
        role: 'owner',
      },
    });

    return space.id;
  }
}