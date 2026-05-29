import { MarkdownBlock } from './markdown-parser';
import { tokenEstimator } from './token-estimator';

export interface ChunkCandidate {
  content: string;
  headingPath: string[];
  blockTypes: string[];
  startLine?: number;
  endLine?: number;
  tokenCount: number;
  ordinal: number;
  rawText: string;
}

export interface SplitterConfig {
  targetTokens: number;
  overlapTokens: number;
}

const DEFAULT_CONFIG: SplitterConfig = {
  targetTokens: 500,
  overlapTokens: 50,
};

export function splitBlocks(
  blocks: MarkdownBlock[],
  config: SplitterConfig = DEFAULT_CONFIG,
): ChunkCandidate[] {
  if (blocks.length === 0) return [];

  const flatBlocks = flattenLongBlocks(blocks, config.targetTokens);
  const chunks = combineBlocks(flatBlocks, config);

  return chunks.filter((c) => c.content.trim().length > 0);
}

function flattenLongBlocks(
  blocks: MarkdownBlock[],
  maxTokens: number,
): MarkdownBlock[] {
  const result: MarkdownBlock[] = [];

  for (const block of blocks) {
    const tokens = tokenEstimator.estimate(block.text);
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
    if (tokenEstimator.estimate(candidate) > maxTokens && current) {
      parts.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) {
    if (tokenEstimator.estimate(current) > maxTokens * 2) {
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
    if (tokenEstimator.estimate(candidate) > maxTokens && current) {
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
  blocks: MarkdownBlock[],
  headingPath: string[],
  rawText: string,
): string {
  const prefix = headingPath.length > 0 ? headingPath.join(' > ') + '\n\n' : '';
  return prefix + rawText;
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

      const blockTokens = tokenEstimator.estimate(blocks[j].text);
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
    const rawText = groupBlocks.map((b) => b.text).join('\n\n');
    const content = buildChunkContent(groupBlocks, headingPath, rawText);
    const startLine = groupBlocks[0].startLine;
    const endLine = groupBlocks[groupBlocks.length - 1].endLine;
    const tokenCount = tokenEstimator.estimate(content);

    chunks.push({
      content,
      headingPath,
      blockTypes: groupTypes,
      startLine,
      endLine,
      tokenCount,
      ordinal,
      rawText,
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