import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonalSpaceInterceptor } from '../spaces/personal-space.interceptor';
import { CurrentUser } from '../auth/current-user.decorator';
import { PersonalSpaceId } from '../spaces/personal-space-id.decorator';
import { CreateKbDto } from './dto/create-kb.dto';
import { KbResponse, KbListResponse } from './dto/kb-response.dto';
import type { User } from '@devbrain/db';

@ApiTags('KnowledgeBase')
@Controller('kbs')
@UseGuards(JwtAuthGuard)
@UseInterceptors(PersonalSpaceInterceptor)
export class KnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建个人 KB' })
  @ApiBody({ type: CreateKbDto })
  @ApiResponse({
    status: 201,
    description: 'KB 创建成功',
    type: KbResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({
    status: 400,
    description: '输入校验失败（含传入 spaceId 被拒绝的场景）',
  })
  async create(
    @CurrentUser() user: User,
    @PersonalSpaceId() personalSpaceId: string,
    @Body() dto: CreateKbDto,
  ): Promise<KbResponse> {
    const kb = await this.knowledgeBaseService.create(
      user.id,
      personalSpaceId,
      dto,
    );
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description ?? undefined,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '列出个人 KB' })
  @ApiResponse({
    status: 200,
    description: '个人 KB 列表（按 updatedAt desc, id desc 排序）',
    type: KbListResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  async list(
    @CurrentUser() user: User,
    @PersonalSpaceId() personalSpaceId: string,
  ): Promise<KbListResponse> {
    const items = await this.knowledgeBaseService.list(
      user.id,
      personalSpaceId,
    );
    return {
      items: items.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description ?? undefined,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
      })),
    };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 KB 详情' })
  @ApiParam({ name: 'id', description: 'KB ID' })
  @ApiResponse({
    status: 200,
    description: 'KB 详情',
    type: KbResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({
    status: 404,
    description: 'KB 不存在或无权访问',
  })
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<KbResponse> {
    const kb =
      await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
        user.id,
        id,
      );
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description ?? undefined,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    };
  }
}