import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonalSpaceInterceptor } from '../spaces/personal-space.interceptor';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateDocumentDto,
  DocumentResponse,
  DocumentListResponse,
  ChunkListResponse,
} from './dto/document.dto';
import type { User } from '@devbrain/db';

@ApiTags('Documents')
@Controller()
@UseGuards(JwtAuthGuard)
@UseInterceptors(PersonalSpaceInterceptor)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('documents')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Document' })
  @ApiBody({ type: CreateDocumentDto })
  @ApiResponse({
    status: 201,
    description: 'Document 创建成功并入队',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 400, description: '校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: 'KB 不存在或无权访问' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponse> {
    return this.documentsService.create(user, dto);
  }

  @Get('documents/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Document 详情' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document 详情',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: 'Document 不存在或无权访问' })
  async detail(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<DocumentResponse> {
    return this.documentsService.getById(user, id);
  }

  @Get('kbs/:kbId/documents')
  @ApiBearerAuth()
  @ApiOperation({ summary: '列出 KB 下 Document' })
  @ApiParam({ name: 'kbId', description: 'KB ID' })
  @ApiResponse({
    status: 200,
    description: 'Document 列表',
    type: DocumentListResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: 'KB 不存在或无权访问' })
  async listByKb(
    @CurrentUser() user: User,
    @Param('kbId') kbId: string,
  ): Promise<DocumentListResponse> {
    const items = await this.documentsService.listByKb(user, kbId);
    return { items };
  }

  @Get('documents/:id/chunks')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询 Document 的 chunks' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认 100，最大 500' })
  @ApiQuery({ name: 'cursor', required: false, description: '分页 cursor' })
  @ApiResponse({
    status: 200,
    description: 'Chunk 列表',
    type: ChunkListResponse,
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: 'Document 不存在或无权访问' })
  async getChunks(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ChunkListResponse> {
    return this.documentsService.getChunks(
      user,
      id,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }
}