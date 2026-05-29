import { hashPrefix } from './content-hash';

export function generateAnchor(
  headingPath: string[],
  ordinal: number,
  contentHash: string,
): string {
  const slugSource = headingPath.length > 0 ? headingPath[headingPath.length - 1] : 'root';
  const slug = slugify(slugSource);
  const shortHash = hashPrefix(contentHash, 8);
  return `h/${slug}/c${ordinal}-${shortHash}`;
}

function slugify(text: string): string {
  let slug = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug || slug.length === 0) {
    slug = 'root';
  }

  if (slug.length > 64) {
    slug = slug.slice(0, 64).replace(/-+$/, '');
    if (!slug) slug = 'root';
  }

  return slug;
}