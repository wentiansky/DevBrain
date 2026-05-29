import { createHash } from 'node:crypto';

export const CONTENT_HASH_VERSION = 1;

export function normalizeForHash(text: string): string {
  let normalized = text;

  normalized = normalized.replace(/^\uFEFF/, '');

  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  normalized = normalized.normalize('NFC');

  normalized = normalized.trim();

  normalized = normalized
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');

  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized;
}

export function computeContentHash(content: string, headingPath: string[]): string {
  const normalizedContent = normalizeForHash(content);
  const normalizedPath = headingPath.map((h) => normalizeForHash(h)).join('\n');
  const combined = `${normalizedContent}\n__HEADING_PATH__\n${normalizedPath}`;
  return createHash('sha256').update(combined, 'utf-8').digest('hex');
}

export function hashPrefix(fullHash: string, length = 8): string {
  return fullHash.slice(0, length);
}