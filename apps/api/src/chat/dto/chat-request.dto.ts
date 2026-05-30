import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    description: '用户消息内容',
    example: '这段代码的作用是什么？',
  })
  @IsString()
  message!: string;

  @ApiPropertyOptional({
    description: '会话 ID，不传则创建新会话',
    example: 'clx...',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    description: '客户端消息 ID，用于幂等去重',
    example: 'client-msg-001',
  })
  @IsOptional()
  @IsString()
  clientMessageId?: string;
}