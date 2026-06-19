import { MarkdownBlock } from './markdown-parser';
import { tokenCounter } from './token-estimator';

export interface ChunkCandidate {
  content: string;
  headingPath: string[];
  blockTypes: string[];
  startLine?: number;
  endLine?: number;
  tokenCount: number;
  ordinal: number;
  rawText: string;
  overlapText: string;
  overlapTokenCount: number;
}

export interface SplitterConfig {
  targetTokens: number;
  overlapTokens: number;
}

export const DEFAULT_SPLITTER_CONFIG: SplitterConfig = {
  targetTokens: 500,
  overlapTokens: 50,
};

export function splitBlocks(
  blocks: MarkdownBlock[],
  config: SplitterConfig = DEFAULT_SPLITTER_CONFIG,
): ChunkCandidate[] {
  if (blocks.length === 0) return [];

  const flatBlocks = flattenLongBlocks(blocks, config.targetTokens);
  const chunks = combineBlocks(flatBlocks, config);

  return chunks.filter(
    (c) => c.rawText.trim().length > 0 && c.content.trim().length > 0,
  );
}

function flattenLongBlocks(
  blocks: MarkdownBlock[],
  maxTokens: number,
): MarkdownBlock[] {
  const result: MarkdownBlock[] = [];

  for (const block of blocks) {
    const tokens = tokenCounter.count(block.text);
    if (tokens <= maxTokens) {
      result.push(block);
      continue;
    }

    const subBlocks = splitLongText(block.text, block.headingPath, maxTokens);
    for (let i = 0; i < subBlocks.length; i++) {
      result.push({
        ...block,
        text: subBlocks[i],
        startLine: i === 0 ? block.startLine : undefined,
        endLine: i === subBlocks.length - 1 ? block.endLine : undefined,
      });
    }
  }

  return result;
}

function splitLongText(
  text: string,
  _headingPath: string[],
  maxTokens: number,
): string[] {
  const parts: string[] = [];
  const paragraphs = text.split('\n');
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n${para}` : para;
    if (tokenCounter.count(candidate) > maxTokens && current) {
      parts.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) {
    if (tokenCounter.count(current) > maxTokens * 2) {
      const subParts = forceSplitBySentence(current, maxTokens);
      parts.push(...subParts);
    } else {
      parts.push(current);
    }
  }

  return parts;
}

function forceSplitBySentence(text: string, maxTokens: number): string[] {
  const sentences = text.replace(/([。！？.!?\n])\s*/g, '$1\u0000').split('\u0000');
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    const candidate = current ? `${current}${sentence}` : sentence;
    if (tokenCounter.count(candidate) > maxTokens && current) {
      parts.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) parts.push(current);
  return parts.length > 0 ? parts : [text];
}

function buildChunkContent(
  headingPath: string[],
  rawText: string,
  overlapText: string,
): string {
  const prefix = headingPath.length > 0 ? headingPath.join(' > ') + '\n\n' : '';
  if (!overlapText.trim()) return prefix + rawText;

  return `${prefix}[上文]\n${overlapText}\n\n[正文]\n${rawText}`;
}

function combineBlocks(
  blocks: MarkdownBlock[],
  config: SplitterConfig,
): ChunkCandidate[] {
  const chunks: ChunkCandidate[] = [];
  let ordinal = 0;
  let i = 0;

  while (i < blocks.length) {
    const groupBlocks: MarkdownBlock[] = [];
    const groupTypes: string[] = [];
    let tokenSum = 0;

    const currentHeadingKey = blocks[i].headingPath.join('/');
    let j = i;

    while (j < blocks.length) {
      const blockHeadingKey = blocks[j].headingPath.join('/');

      if (groupBlocks.length > 0 && blockHeadingKey !== currentHeadingKey) {
        break;
      }

      const blockTokens = tokenCounter.count(blocks[j].text);
      if (tokenSum + blockTokens > config.targetTokens && groupBlocks.length > 0) {
        break;
      }

      groupBlocks.push(blocks[j]);
      if (!groupTypes.includes(blocks[j].type)) {
        groupTypes.push(blocks[j].type);
      }
      tokenSum += blockTokens;
      j++;
    }

    const headingPath = groupBlocks[0].headingPath;
    const headingKey = headingPath.join('/');
    const rawText = groupBlocks.map((b) => b.text).join('\n\n');
    const previousChunk = chunks[chunks.length - 1];
    const overlapText =
      previousChunk && previousChunk.headingPath.join('/') === headingKey
        ? tokenCounter.takeTail(previousChunk.rawText, config.overlapTokens)
        : '';
    const overlapTokenCount = tokenCounter.count(overlapText);
    const content = buildChunkContent(headingPath, rawText, overlapText);
    const startLine = groupBlocks[0].startLine;
    const endLine = groupBlocks[groupBlocks.length - 1].endLine;
    const tokenCount = tokenCounter.count(content);

    chunks.push({
      content,
      headingPath,
      blockTypes: groupTypes,
      startLine,
      endLine,
      tokenCount,
      ordinal,
      rawText,
      overlapText,
      overlapTokenCount,
    });

    ordinal++;

    if (j <= i) {
      i++;
    } else {
      i = j;
    }
  }

  return chunks;
}
