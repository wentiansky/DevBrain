import { Controller, Post, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonalSpaceInterceptor } from '../spaces/personal-space.interceptor';
import { CurrentUser } from '../auth/current-user.decorator';
import { PresignUploadDto, PresignUploadResponse } from '../documents/dto/document.dto';
import type { User } from '@devbrain/db';

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@UseInterceptors(PersonalSpaceInterceptor)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Markdown 上传初始化' })
  @ApiBody({ type: PresignUploadDto })
  @ApiResponse({
    status: 201,
    description: '上传初始化成功，返回直传 URL',
    type: PresignUploadResponse,
  })
  @ApiResponse({ status: 400, description: '校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: 'KB 不存在或无权访问' })
  async presign(
    @CurrentUser() user: User,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    return this.uploadsService.presignUpload(user, dto);
  }
}