import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString } from 'mdast-util-to-string';
import type { Root, Content, Heading, Code, List, Blockquote, Paragraph, Parent } from 'mdast';

export interface MarkdownBlock {
  type: string;
  text: string;
  headingPath: string[];
  startLine?: number;
  endLine?: number;
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown) as Root;

  const blocks: MarkdownBlock[] = [];
  const headingStack: string[] = [];

  function visitChildren(children: Content[]) {
    for (const child of children) {
      visitNode(child);
    }
  }

  function visitNode(node: Content) {
    if (node.type === 'heading') {
      const headingNode = node as Heading;
      const headingText = toString(headingNode).trim();
      if (!headingText) return;
      const depth = headingNode.depth;
      while (headingStack.length < depth - 1) {
        headingStack.push('');
      }
      headingStack.length = depth - 1;
      headingStack.push(headingText);
      return;
    }

    if (node.type === 'code') {
      const codeNode = node as Code;
      if (codeNode.value.trim()) {
        blocks.push({
          type: 'code',
          text: codeNode.value,
          headingPath: [...headingStack],
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        });
      }
      return;
    }

    if (node.type === 'list') {
      const listNode = node as List;
      const listTexts: string[] = [];
      extractListText(listNode, listTexts);
      const joined = listTexts.join('\n').trim();
      if (joined) {
        blocks.push({
          type: 'list',
          text: joined,
          headingPath: [...headingStack],
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        });
      }
      return;
    }

    if (node.type === 'blockquote') {
      const quoteNode = node as Blockquote;
      const quoteChildren: string[] = [];
      for (const child of quoteNode.children) {
        quoteChildren.push(toString(child));
      }
      const text = quoteChildren.join('\n').trim();
      if (text) {
        blocks.push({
          type: 'blockquote',
          text,
          headingPath: [...headingStack],
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        });
      }
      return;
    }

    if (node.type === 'paragraph') {
      const text = toString(node as Paragraph).trim();
      if (text) {
        blocks.push({
          type: 'paragraph',
          text,
          headingPath: [...headingStack],
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        });
      }
      return;
    }

    if (node.type === 'table') {
      const text = toString(node).trim();
      if (text) {
        blocks.push({
          type: 'table',
          text,
          headingPath: [...headingStack],
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        });
      }
      return;
    }

    if ('children' in node && Array.isArray((node as Parent).children)) {
      visitChildren((node as Parent).children);
    }
  }

  function extractListText(listNode: List, results: string[]) {
    for (const item of listNode.children) {
      const itemText = toString(item).trim();
      if (itemText) {
        results.push(`- ${itemText}`);
      }
    }
  }

  visitChildren(tree.children);

  return blocks.filter((b) => b.text.length > 0);
}