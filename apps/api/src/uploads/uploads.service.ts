import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { generateObjectKey } from '../storage/object-key';
import { OBJECT_STORAGE } from '../storage/storage.module';
import { PresignUploadDto, PresignUploadResponse } from '../documents/dto/document.dto';
import { KnowledgeBaseService } from '../kbs/knowledge-base.service';
import type { User, ObjectStorage } from '@devbrain/db';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  async presignUpload(
    user: User,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    await this.knowledgeBaseService.getAccessiblePersonalKbOrThrow(
      user.id,
      dto.kbId,
    );

    if (dto.sizeBytes <= 0 || dto.sizeBytes > 20 * 1024 * 1024) {
      throw new BadRequestException('文件大小必须在 1 字节到 20MB 之间');
    }

    const allowedExts = ['.md', '.markdown', '.mdown', '.mkdn', '.mkd', '.mdwn'];
    const cleanName = dto.fileName.trim();
    const ext = cleanName.slice(cleanName.lastIndexOf('.')).toLowerCase();
    if (!ext || !allowedExts.includes(ext)) {
      throw new BadRequestException('不支持的文件类型，仅支持 Markdown 文件');
    }

    const objectKey = generateObjectKey({
      kbId: dto.kbId,
      userId: user.id,
      fileName: dto.fileName,
    });

    const result = await this.storage.createPresignedPut({
      objectKey,
      sizeBytes: dto.sizeBytes,
      contentType: dto.mimeType || 'application/octet-stream',
    });

    return {
      uploadUrl: result.uploadUrl,
      uploadMethod: result.uploadMethod,
      objectKey: result.objectKey,
      expiresAt: result.expiresAt,
      uploadToken: result.uploadUrl.split('/').pop() ?? '',
    };
  }
}