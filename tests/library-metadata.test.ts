import test from 'node:test';
import assert from 'node:assert/strict';
import { withLibraryWordCounts } from '../src/lib/libraryMetadata';
import type { LibraryCategoryNode } from '../src/types';

test('word counts use enriched metadata without interpreting XLSX byte sizes as words', () => {
  const tree: LibraryCategoryNode[] = [{ name: '教材', path: '教材', type: 'folder', bookCount: 2, children: [
    { name: '教材 A', path: '教材/A', type: 'book', size: 41 },
    { name: '教材 B', path: '教材/B', type: 'book', size: 12000, wordCount: 0 },
  ] }];
  assert.deepEqual(withLibraryWordCounts(tree, true)[0].children?.map(node => node.wordCount), [41, 0]);
  assert.deepEqual(withLibraryWordCounts(tree, false)[0].children?.map(node => node.wordCount), [undefined, 0]);
  assert.equal(tree[0].children?.[0].wordCount, undefined);
  assert.equal(withLibraryWordCounts(tree, true)[0].bookCount, 2);
});
