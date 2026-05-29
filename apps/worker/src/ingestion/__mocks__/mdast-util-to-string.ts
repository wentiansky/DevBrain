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

module.exports = { toString: mdastToString.toString };