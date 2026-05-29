import { Injectable, NotFoundException } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type { KnowledgeBase } from '@devbrain/db';
import { CreateKbDto } from './dto/create-kb.dto';

const prisma = getPrismaClient();

@Injectable()
export class KnowledgeBaseService {
  async create(
    userId: string,
    personalSpaceId: string,
    dto: CreateKbDto,
  ): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.create({
      data: {
        spaceId: personalSpaceId,
        name: dto.name,
        description: dto.description ?? null,
        createdById: userId,
      },
    });
  }

  async list(userId: string, personalSpaceId: string) {
    return prisma.knowledgeBase.findMany({
      where: {
        spaceId: personalSpaceId,
        createdById: userId,
        archivedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getAccessiblePersonalKbOrThrow(
    userId: string,
    kbId: string,
  ): Promise<KnowledgeBase> {
    const kb = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        space: {
          type: 'personal',
          createdById: userId,
        },
        archivedAt: null,
      },
    });

    if (!kb) {
      throw new NotFoundException(`KB ${kbId} 不存在或无权访问`);
    }

    return kb;
  }
}