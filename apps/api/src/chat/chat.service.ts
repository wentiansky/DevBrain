import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { getPrismaClient } from '@devbrain/db';
import type { $Enums } from '@devbrain/db';
import { LLM_PROVIDER } from '../providers/providers.module';
import type { LlmProvider } from '../providers/llm/llm-provider.interface';
import { RetrievalService } from '../retrieval/retrieval.service';
import { buildRagPrompt } from '../generation/prompt-builder';
import { parseCitationsFromAnswer } from './citation-parser';
import type { RetrievalChunk } from '../retrieval/retrieval.types';

const prisma = getPrismaClient();

const MAX_QUESTION_LENGTH = 5000;

export interface ChatStreamContext {
  conversationId: string;
  assistantMessageId: string;
  userId: string;
  kbId: string;
}

export interface ChatStreamEvent {
  type: 'delta' | 'done' | 'error' | 'rejection';
  content?: string;
  conversationId?: string;
  assistantMessageId?: string;
  code?: string;
  message?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly retrievalService: RetrievalService,
  ) {}

  private toPrismaProvider(name: string): $Enums.Provider | undefined {
    const validProviders: $Enums.Provider[] = ['qwen', 'deepseek', 'claude', 'gpt'];
    if (validProviders.includes(name as $Enums.Provider)) {
      return name as $Enums.Provider;
    }
    return undefined;
  }

  async prepareChat(
    userId: string,
    kbId: string,
    query: string,
    conversationId?: string,
  ): Promise<{ conversationId: string; assistantMessageId: string }> {
    await this.verifyKbAccess(userId, kbId);
    const convId = await this.resolveConversation(userId, kbId, conversationId);
    const assistantMsg = await this.createPlaceholderMessages(convId, query);
    return { conversationId: convId, assistantMessageId: assistantMsg.id };
  }

  async *streamChat(
    userId: string,
    kbId: string,
    query: string,
    conversationId: string,
    assistantMessageId: string,
  ): AsyncIterable<ChatStreamEvent> {
    const context: ChatStreamContext = {
      conversationId,
      assistantMessageId,
      userId,
      kbId,
    };

    yield {
      type: 'delta',
      conversationId,
      assistantMessageId,
    };

    try {
      const retrievalResult = await this.retrievalService.retrieve(userId, kbId, query);

      if (retrievalResult.status === 'rejected') {
        const reasonCode = `rejection.${retrievalResult.reason}`;
        await this.markAssistantRejected(assistantMessageId, reasonCode);
        yield {
          type: 'rejection',
          code: retrievalResult.reason || 'unknown',
          message: reasonCode,
          conversationId,
          assistantMessageId,
        };
        return;
      }

      if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
        await this.markAssistantRejected(assistantMessageId, 'rejection.no_recall_hits');
        yield {
          type: 'rejection',
          code: 'no_recall_hits',
          message: 'rejection.no_recall_hits',
          conversationId,
          assistantMessageId,
        };
        return;
      }

      const chunks = retrievalResult.chunks;
      const { messages, chunkMapping } = buildRagPrompt({ query, chunks });

      let fullAnswer = '';
      const llmStream = this.llmProvider.stream({
        messages,
        maxTokens: 2048,
        temperature: 0.3,
      });

      for await (const chunk of llmStream) {
        if (chunk.type === 'delta') {
          fullAnswer += chunk.delta;
          yield { type: 'delta', content: chunk.delta };
        } else if (chunk.type === 'error') {
          this.logger.error(
            `LLM 生成失败 | errorCode: ${chunk.errorCode} | message: ${chunk.message}`,
          );
          await this.markAssistantFailed(
            assistantMessageId,
            chunk.errorCode || 'provider.failed',
            `LLM 生成失败: ${chunk.message}`,
          );
          yield {
            type: 'error',
            code: chunk.errorCode || 'provider.failed',
            message: '生成回答时出错，请稍后重试',
          };
          return;
        }
      }

      if (fullAnswer.trim() === 'INSUFFICIENT_CONTEXT') {
        await this.markAssistantRejected(assistantMessageId, 'rejection.insufficient_context');
        yield {
          type: 'rejection',
          code: 'insufficient_context',
          message: 'rejection.insufficient_context',
          conversationId,
          assistantMessageId,
        };
        return;
      }

      const { cleanedAnswer, citations: parsedCitations } = parseCitationsFromAnswer(fullAnswer);

      const citationEntries = this.buildCitationEntries(
        parsedCitations,
        chunks,
        chunkMapping,
        assistantMessageId,
      );

      await this.finalizeAssistantMessage(
        assistantMessageId,
        cleanedAnswer,
        citationEntries,
      );

      this.logger.log(
        `Chat 完成 | conversationId: ${conversationId} | answerLength: ${cleanedAnswer.length} | citations: ${citationEntries.length}`,
      );

      yield {
        type: 'done',
        conversationId,
        assistantMessageId,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      this.logger.error(`Chat 生成异常 | error: ${errorMessage}`);
      await this.markAssistantFailed(
        assistantMessageId,
        'provider.failed',
        '生成回答时出错，请稍后重试',
      );
      yield {
        type: 'error',
        code: 'provider.failed',
        message: '生成回答时出错，请稍后重试',
        conversationId: context.conversationId,
        assistantMessageId: context.assistantMessageId,
      };
    }
  }

  private async verifyKbAccess(userId: string, kbId: string): Promise<void> {
    const kb = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        space: { type: 'personal', createdById: userId },
        archivedAt: null,
      },
    });

    if (!kb) {
      throw new NotFoundException('KB 不存在或无权访问');
    }
  }

  private async resolveConversation(
    userId: string,
    kbId: string,
    conversationId?: string,
  ): Promise<string> {
    if (conversationId) {
      const conv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          kbId,
          createdById: userId,
        },
      });

      if (!conv) {
        throw new NotFoundException('会话不存在或无权访问');
      }

      return conv.id;
    }

    const conv = await prisma.conversation.create({
      data: {
        kbId,
        createdById: userId,
      },
    });

    return conv.id;
  }

  private async createPlaceholderMessages(
    conversationId: string,
    query: string,
  ) {
    const assistantMsg = await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          status: 'completed',
        },
      });

      return tx.message.create({
        data: {
          conversationId,
          role: 'assistant',
          status: 'completed',
        },
      });
    });

    return assistantMsg;
  }

  private async markAssistantRejected(
    assistantMessageId: string,
    errorCode: string,
  ): Promise<void> {
    await prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        status: 'completed',
        errorCode,
        errorMessage: errorCode,
      },
    });
  }

  private async markAssistantFailed(
    assistantMessageId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        status: 'failed',
        errorCode,
        errorMessage,
      },
    });
  }

  private async finalizeAssistantMessage(
    assistantMessageId: string,
    content: string,
    citations: Array<{
      messageId: string;
      chunkId: string;
      documentId: string;
      sourceType: $Enums.SourceType;
      order: number;
      score: number;
      chunkText: string;
      headingPath: string[];
      anchor: string | null;
      page: number | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bbox?: any;
    }>,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: assistantMessageId },
        data: {
          status: 'completed',
          content,
          provider: this.toPrismaProvider(this.llmProvider.providerName),
          model: this.llmProvider.model,
          errorCode: null,
          errorMessage: null,
        },
      });

      if (citations.length > 0) {
        await tx.messageCitation.createMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: citations as any,
        });
      }
    });
  }

  private buildCitationEntries(
    parsedCitations: Array<{ chunkNumber: number; order: number }>,
    chunks: RetrievalChunk[],
    chunkMapping: Map<number, string>,
    assistantMessageId: string,
  ) {
    if (parsedCitations.length === 0) {
      const fallbackChunks = chunks.slice(0, 3);
      return fallbackChunks.map((chunk, index) => ({
        messageId: assistantMessageId,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        sourceType: chunk.sourceType as $Enums.SourceType,
        order: index,
        score: chunk.rerankScore ?? chunk.rrfScore ?? 0,
        chunkText: chunk.content.length > 1000 ? chunk.content.slice(0, 1000) : chunk.content,
        headingPath: chunk.headingPath ?? [],
        anchor: chunk.anchor,
        page: chunk.page,
        bbox: chunk.bbox,
      }));
    }

    const chunkByNumber = new Map<number, RetrievalChunk>();
    for (let i = 0; i < chunks.length; i++) {
      chunkByNumber.set(i + 1, chunks[i]);
    }

    return parsedCitations
      .filter((c) => chunkByNumber.has(c.chunkNumber))
      .map((c) => {
        const chunk = chunkByNumber.get(c.chunkNumber)!;
        return {
          messageId: assistantMessageId,
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          sourceType: chunk.sourceType as $Enums.SourceType,
          order: c.order,
          score: chunk.rerankScore ?? chunk.rrfScore ?? 0,
          chunkText: chunk.content.length > 1000 ? chunk.content.slice(0, 1000) : chunk.content,
          headingPath: chunk.headingPath ?? [],
          anchor: chunk.anchor,
          page: chunk.page,
          bbox: chunk.bbox,
        };
      });
  }

  async getConversations(userId: string, kbId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: {
        id: kbId,
        space: { type: 'personal', createdById: userId },
        archivedAt: null,
      },
    });

    if (!kb) {
      throw new NotFoundException('KB 不存在或无权访问');
    }

    const conversations = await prisma.conversation.findMany({
      where: { kbId, createdById: userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        kbId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return conversations;
  }

  async getConversationDetail(userId: string, kbId: string, conversationId: string) {
    const conv = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        kbId,
        createdById: userId,
      },
    });

    if (!conv) {
      throw new NotFoundException('会话不存在或无权访问');
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        OR: [
          { role: 'user' },
          { role: 'assistant', status: 'completed', content: { not: null } },
          { role: 'assistant', status: 'completed', errorCode: { startsWith: 'rejection.' } },
          { role: 'assistant', status: 'failed' },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        citations: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return {
      ...conv,
      messages: messages.map((m) => ({
        ...m,
        citations: m.citations.map((c) => ({
          id: c.id,
          chunkId: c.chunkId,
          documentId: c.documentId,
          sourceType: c.sourceType,
          order: c.order,
          score: c.score,
          chunkText: c.chunkText,
          headingPath: c.headingPath as string[],
          anchor: (c.anchor as string | null) ?? null,
          page: (c.page as number | null) ?? null,
          bbox: (c.bbox as Record<string, unknown> | null) ?? null,
        })),
      })),
    };
  }

  validateChatRequest(query: string): void {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length === 0) {
      throw new BadRequestException('问题不能为空');
    }
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(`问题长度不能超过 ${MAX_QUESTION_LENGTH} 个字符`);
    }
  }
}