import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CitationResponse {
  @ApiProperty({ description: 'citation ID' })
  id!: string;

  @ApiProperty({ description: 'chunk ID' })
  chunkId!: string;

  @ApiProperty({ description: '文档 ID' })
  documentId!: string;

  @ApiProperty({ description: '来源类型', example: 'markdown' })
  sourceType!: string;

  @ApiProperty({ description: '引用排序', example: 0 })
  order!: number;

  @ApiProperty({ description: '相关性分数', example: 0.85 })
  score!: number;

  @ApiProperty({ description: 'chunk 文本预览' })
  chunkText!: string;

  @ApiProperty({ description: '标题路径', type: [String] })
  headingPath!: string[];

  @ApiPropertyOptional({ description: 'chunk 锚点', type: 'string', nullable: true })
  anchor?: string | null;

  @ApiPropertyOptional({ description: '页码', type: 'number', nullable: true })
  page?: number | null;

  @ApiPropertyOptional({ description: '边界框坐标', nullable: true })
  bbox?: Record<string, unknown> | null;
}

export class MessageResponse {
  @ApiProperty({ description: '消息 ID' })
  id!: string;

  @ApiProperty({ description: '会话 ID' })
  conversationId!: string;

  @ApiProperty({ description: '角色', example: 'user' })
  role!: string;

  @ApiPropertyOptional({ description: '消息内容', type: 'string', nullable: true })
  content?: string | null;

  @ApiProperty({ description: '消息状态', example: 'completed' })
  status!: string;

  @ApiPropertyOptional({ description: 'provider 名称', type: 'string', nullable: true, example: 'qwen' })
  provider?: string | null;

  @ApiPropertyOptional({ description: '模型名称', type: 'string', nullable: true, example: 'qwen-plus' })
  model?: string | null;

  @ApiPropertyOptional({ description: '错误码', type: 'string', nullable: true })
  errorCode?: string | null;

  @ApiPropertyOptional({ description: '错误信息（脱敏）', type: 'string', nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'assistant 消息的 citations',
    type: [CitationResponse],
  })
  citations?: CitationResponse[];
}

export class ConversationResponse {
  @ApiProperty({ description: '会话 ID' })
  id!: string;

  @ApiProperty({ description: 'KB ID' })
  kbId!: string;

  @ApiPropertyOptional({ description: '会话标题', type: 'string', nullable: true })
  title?: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date;
}

export class ConversationDetailResponse extends ConversationResponse {
  @ApiProperty({
    description: '会话消息列表',
    type: [MessageResponse],
  })
  messages!: MessageResponse[];
}

export class ConversationListResponse {
  @ApiProperty({
    description: '会话列表',
    type: [ConversationResponse],
  })
  items!: ConversationResponse[];
}

export class ChatErrorResponse {
  @ApiProperty({ description: '错误状态码', example: 404 })
  statusCode!: number;

  @ApiProperty({ description: '错误信息', example: 'KB 不存在或无权访问' })
  message!: string;

  @ApiPropertyOptional({ description: '错误码', type: 'string', nullable: true, example: 'not_found' })
  error?: string;
}