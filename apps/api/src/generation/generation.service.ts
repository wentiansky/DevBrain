import { Injectable, Inject, Logger } from '@nestjs/common';
import type { LlmProvider, StreamChunk } from '../providers/llm/llm-provider.interface';
import { LLM_PROVIDER } from '../providers/providers.module';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ProviderError, ProviderErrorCodes } from '../providers/embedding/embedding-provider.interface';
import { buildRagPrompt } from './prompt-builder';
import type { GenerationOutput } from '../retrieval/retrieval.types';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly retrievalService: RetrievalService,
  ) {}

  async generate(userId: string, kbId: string, query: string): Promise<GenerationOutput> {
    const retrievalResult = await this.retrievalService.retrieve(userId, kbId, query);

    if (retrievalResult.status === 'rejected') {
      return { status: 'rejected', reason: retrievalResult.reason };
    }

    if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
      return { status: 'rejected', reason: 'no_recall_hits' };
    }

    const { messages } = buildRagPrompt({
      query,
      chunks: retrievalResult.chunks,
    });

    let fullAnswer = '';
    const stream = this.llmProvider.stream({
      messages,
      maxTokens: 2048,
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'delta') {
        fullAnswer += chunk.delta;
      } else if (chunk.type === 'error') {
        this.logger.error(
          `LLM 生成失败 | provider: ${this.llmProvider.providerName} | errorCode: ${chunk.errorCode} | message: ${chunk.message}`,
        );
        throw new ProviderError(
          chunk.errorCode || ProviderErrorCodes.FAILED,
          `LLM 生成失败: ${chunk.message}`,
        );
      }
    }

    if (fullAnswer.trim() === 'INSUFFICIENT_CONTEXT') {
      return { status: 'rejected', reason: 'no_recall_hits' };
    }

    this.logger.log(
      `生成完成 | provider: ${this.llmProvider.providerName} | model: ${this.llmProvider.model} | answerLength: ${fullAnswer.length}`,
    );

    return { status: 'success', answer: fullAnswer };
  }

  async *streamGenerate(
    userId: string,
    kbId: string,
    query: string,
  ): AsyncIterable<StreamChunk> {
    const retrievalResult = await this.retrievalService.retrieve(userId, kbId, query);

    if (retrievalResult.status === 'rejected') {
      yield {
        type: 'error',
        errorCode: 'retrieval.rejected',
        message: `检索拒答: ${retrievalResult.reason}`,
      };
      return;
    }

    if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
      yield {
        type: 'error',
        errorCode: 'retrieval.no_chunks',
        message: '没有可用的检索结果',
      };
      return;
    }

    const { messages } = buildRagPrompt({
      query,
      chunks: retrievalResult.chunks,
    });

    yield* this.llmProvider.stream({
      messages,
      maxTokens: 2048,
      temperature: 0.3,
    });
  }
}