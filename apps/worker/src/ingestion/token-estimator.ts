import { getEncoding } from 'js-tiktoken';

export interface TokenCounter {
  count(text: string): number;
  takeTail(text: string, maxTokens: number): string;
}

export const tokenCounterMetadata = {
  tokenCounter: 'js-tiktoken/cl100k_base',
  tokenCounterKind: 'approximate',
  encoding: 'cl100k_base',
  version: '1',
} as const;

export class TiktokenCounter implements TokenCounter {
  private readonly encoding = getEncoding('cl100k_base');

  count(text: string): number {
    if (!text) return 0;
    return this.encoding.encode(text).length;
  }

  takeTail(text: string, maxTokens: number): string {
    if (!text || maxTokens <= 0) return '';

    if (this.count(text) <= maxTokens) return text;

    const chars = Array.from(text);
    let best = '';

    for (let i = chars.length - 1; i >= 0; i--) {
      const candidate = `${chars[i]}${best}`;
      if (this.count(candidate) > maxTokens) break;
      best = candidate;
    }

    return best.trim();
  }
}

export const tokenCounter = new TiktokenCounter();
