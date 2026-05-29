import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKbDto {
  @ApiProperty({
    description: 'KB 名称（1-200 个字符）',
    example: '我的知识库',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1, { message: 'KB 名称不能为空' })
  @MaxLength(200, { message: 'KB 名称最多 200 个字符' })
  name!: string;

  @ApiPropertyOptional({
    description: 'KB 描述（最多 500 个字符）',
    example: '存放项目文档和笔记',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'KB 描述最多 500 个字符' })
  description?: string;
}