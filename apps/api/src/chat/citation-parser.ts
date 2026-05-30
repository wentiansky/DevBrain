export interface ParsedCitation {
  chunkNumber: number;
  order: number;
}

export interface CitationParseResult {
  cleanedAnswer: string;
  citations: ParsedCitation[];
}

const CHUNK_MARKER_REGEX = /\[chunk-(\d+)\]/gi;

export function parseCitationsFromAnswer(answer: string): CitationParseResult {
  const citations: ParsedCitation[] = [];
  const seen = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = CHUNK_MARKER_REGEX.exec(answer)) !== null) {
    const num = parseInt(match[1], 10);
    if (!seen.has(num)) {
      seen.add(num);
      citations.push({ chunkNumber: num, order: citations.length });
    }
  }

  const cleanedAnswer = answer.replace(CHUNK_MARKER_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();

  return { cleanedAnswer, citations };
}