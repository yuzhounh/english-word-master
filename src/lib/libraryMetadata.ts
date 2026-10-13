import type { LibraryCategoryNode } from '../types';

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function withLibraryWordCounts(nodes: LibraryCategoryNode[], enriched: boolean): LibraryCategoryNode[] {
  return nodes.map(node => ({
    ...node,
    ...(node.type === 'book' ? {
      // The enriched tree's legacy `size` is a word-ID count; XLSX trees use bytes.
      wordCount: isCount(node.wordCount) ? node.wordCount : enriched && isCount(node.size) ? node.size : undefined,
    } : {}),
    ...(node.children ? { children: withLibraryWordCounts(node.children, enriched) } : {}),
  }));
}
