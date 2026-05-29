const mdastToString = {
  toString: (node: Record<string, unknown>): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (typeof (node as { value?: string }).value === 'string') {
      return (node as { value: string }).value;
    }
    const children = (node as { children?: Array<Record<string, unknown>> }).children;
    return children ? children.map((c) => mdastToString.toString(c)).join('') : '';
  },
};

function createMockProcessor() {
  return {
    use: () => createMockProcessor(),
    parse: (markdown: string) => {
      const lines = markdown.split('\n').filter(Boolean);
      const children: Array<Record<string, unknown>> = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
          children.push({
            type: 'heading',
            depth: headingMatch[1].length,
            children: [{ type: 'text', value: headingMatch[2] }],
            position: { start: { line: i + 1 }, end: { line: i + 1 } },
          });
          i++;
          continue;
        }

        const codeFenceMatch = line.match(/^```/);
        if (codeFenceMatch) {
          const codeLines: string[] = [];
          i++;
          while (i < lines.length && !lines[i].match(/^```/)) {
            codeLines.push(lines[i]);
            i++;
          }
          i++;
          children.push({
            type: 'code',
            value: codeLines.join('\n'),
            position: {
              start: { line: i - codeLines.length },
              end: { line: i },
            },
          });
          continue;
        }

        const listMatch = line.match(/^[-*+]\s+(.+)/);
        if (listMatch) {
          const listItems: Array<Record<string, unknown>> = [];
          while (i < lines.length) {
            const liMatch = lines[i].match(/^[-*+]\s+(.+)/);
            if (!liMatch) break;
            listItems.push({
              type: 'listItem',
              children: [{ type: 'paragraph', children: [{ type: 'text', value: liMatch[1] }] }],
            });
            i++;
          }
          children.push({
            type: 'list',
            children: listItems,
            position: {
              start: { line: i - listItems.length + 1 },
              end: { line: i },
            },
          });
          continue;
        }

        const quoteMatch = line.match(/^>\s*(.+)/);
        if (quoteMatch) {
          const quoteLines: string[] = [];
          while (i < lines.length) {
            const qMatch = lines[i].match(/^>\s*(.+)/);
            if (!qMatch) break;
            quoteLines.push(qMatch[1]);
            i++;
          }
          children.push({
            type: 'blockquote',
            children: [{ type: 'paragraph', children: [{ type: 'text', value: quoteLines.join('\n') }] }],
            position: {
              start: { line: i - quoteLines.length + 1 },
              end: { line: i },
            },
          });
          continue;
        }

        children.push({
          type: 'paragraph',
          children: [{ type: 'text', value: line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1') }],
          position: { start: { line: i + 1 }, end: { line: i + 1 } },
        });
        i++;
      }

      return { type: 'root', children };
    },
  };
}

export const unified = () => createMockProcessor();

module.exports = { unified };