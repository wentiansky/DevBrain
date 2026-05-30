import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatRequestDto } from './dto/chat-request.dto';
import {
  ConversationListResponse,
  ConversationDetailResponse,
  ChatErrorResponse,
} from './dto/chat-response.dto';
import type { User } from '@devbrain/db';

@ApiTags('Chat')
@Controller('kbs')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':kbId/chat')
  @ApiBearerAuth()
  @ApiOperation({ summary: '在 KB 内发送消息（流式回答）' })
  @ApiParam({ name: 'kbId', description: 'KB ID' })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({
    status: 200,
    description: '流式回答（text/event-stream）',
  })
  @ApiResponse({
    status: 400,
    description: '输入校验失败',
    type: ChatErrorResponse,
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
    type: ChatErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'KB 或会话不存在/无权访问',
    type: ChatErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  async chat(
    @Param('kbId') kbId: string,
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    this.chatService.validateChatRequest(dto.message);

    const { conversationId, assistantMessageId } =
      await this.chatService.prepareChat(user.id, kbId, dto.message, dto.conversationId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.chatService.streamChat(
        user.id,
        kbId,
        dto.message,
        conversationId,
        assistantMessageId,
      );

      for await (const event of stream) {
        const data = JSON.stringify(event);
        res.write(`data: ${data}\n\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器内部错误';
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'server_error', message })}\n\n`);
    }

    res.end();
  }

  @Get(':kbId/conversations')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询 KB 下的会话列表' })
  @ApiParam({ name: 'kbId', description: 'KB ID' })
  @ApiResponse({
    status: 200,
    description: '会话列表',
    type: ConversationListResponse,
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
    type: ChatErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'KB 不存在或无权访问',
    type: ChatErrorResponse,
  })
  async listConversations(
    @Param('kbId') kbId: string,
    @CurrentUser() user: User,
  ): Promise<ConversationListResponse> {
    const items = await this.chatService.getConversations(user.id, kbId);
    return { items };
  }

  @Get(':kbId/conversations/:conversationId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询会话详情（含消息和 citations）' })
  @ApiParam({ name: 'kbId', description: 'KB ID' })
  @ApiParam({ name: 'conversationId', description: '会话 ID' })
  @ApiResponse({
    status: 200,
    description: '会话详情',
    type: ConversationDetailResponse,
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
    type: ChatErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: '会话不存在或无权访问',
    type: ChatErrorResponse,
  })
  async getConversation(
    @Param('kbId') kbId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: User,
  ): Promise<ConversationDetailResponse> {
    return this.chatService.getConversationDetail(user.id, kbId, conversationId);
  }
}