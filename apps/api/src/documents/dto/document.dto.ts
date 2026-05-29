import { IsString, IsInt, Min, Max, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MB = 1024 * 1024;
const MAX_FILE_SIZE = 20 * MB;

export class PresignUploadDto {
  @ApiProperty({ description: '目标 KB ID' })
  @IsString()
  kbId!: string;

  @ApiProperty({ description: '文件名' })
  @IsString()
  @MaxLength(500, { message: '文件名最多 500 个字符' })
  fileName!: string;

  @ApiProperty({ description: 'MIME 类型' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: '文件大小（字节）', maximum: MAX_FILE_SIZE })
  @IsInt()
  @Min(1, { message: '文件大小不能为 0' })
  @Max(MAX_FILE_SIZE, { message: '文件超过 20MB 上限' })
  sizeBytes!: number;
}

export class CreateDocumentDto {
  @ApiProperty({ description: '目标 KB ID' })
  @IsString()
  kbId!: string;

  @ApiProperty({ description: '对象存储 key' })
  @IsString()
  objectKey!: string;

  @ApiProperty({ description: '上传签名 token' })
  @IsString()
  uploadToken!: string;

  @ApiProperty({ description: '原始文件名' })
  @IsString()
  @MaxLength(500, { message: '文件名最多 500 个字符' })
  originalName!: string;

  @ApiPropertyOptional({ description: 'MIME 类型' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: '文件大小（字节）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE, { message: '文件超过 20MB 上限' })
  sizeBytes?: number;
}

export class DocumentResponse {
  @ApiProperty({ description: 'Document ID' })
  id!: string;

  @ApiProperty({ description: '所属 KB ID' })
  kbId!: string;

  @ApiProperty({ description: '来源类型' })
  sourceType!: string;

  @ApiProperty({ description: '原始文件名' })
  originalName!: string;

  @ApiProperty({ description: '处理状态' })
  status!: string;

  @ApiPropertyOptional({ description: '错误码', type: String, nullable: true })
  errorCode?: string | null;

  @ApiPropertyOptional({ description: '错误信息', type: String, nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date;
}

export class DocumentListResponse {
  @ApiProperty({ description: 'Document 列表', type: [DocumentResponse] })
  items!: DocumentResponse[];
}

export class PresignUploadResponse {
  @ApiProperty({ description: '上传 URL' })
  uploadUrl!: string;

  @ApiProperty({ description: 'HTTP 方法' })
  uploadMethod!: string;

  @ApiProperty({ description: '对象存储 key' })
  objectKey!: string;

  @ApiProperty({ description: '签名过期时间' })
  expiresAt!: Date;

  @ApiProperty({ description: '创建 Document 所需 token' })
  uploadToken!: string;
}

export class ChunkResponse {
  @ApiProperty({ description: 'Chunk ID' })
  id!: string;

  @ApiProperty({ description: '所属 Document ID' })
  documentId!: string;

  @ApiProperty({ description: '所属 KB ID' })
  kbId!: string;

  @ApiProperty({ description: '来源类型' })
  sourceType!: string;

  @ApiProperty({ description: '文本内容' })
  content!: string;

  @ApiProperty({ description: '标题路径' })
  headingPath!: string[];

  @ApiProperty({ description: '定位锚点' })
  anchor!: string;

  @ApiProperty({ description: 'token 数量' })
  tokenCount!: number;

  @ApiProperty({ description: '元数据' })
  metadata!: Record<string, unknown>;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;
}

export class ChunkListResponse {
  @ApiProperty({ description: 'Chunk 列表', type: [ChunkResponse] })
  items!: ChunkResponse[];

  @ApiPropertyOptional({ description: '下一页 cursor', type: String, nullable: true })
  nextCursor?: string | null;
}
