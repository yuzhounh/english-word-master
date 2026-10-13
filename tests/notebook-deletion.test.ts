import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exclusiveDeletedWordIds } from '../src/lib/notebookDeletion';
import type { WordListGroup, WordItem } from '../src/types';

const book = (id: string, ids: string[], sourceType: WordListGroup['sourceType'] = 'custom'): WordListGroup => ({
  id, name: id, createdAt: 0, wordCount: ids.length, sourceType,
  words: ids.map(id => ({ id, word: id } as WordItem)),
});
test('deleting a book removes exclusive words and preserves all overlapping books and records', () => {
  const lists = [book('A', [' Shared ', 'unique-a']), book('B', ['shared', 'unique-b']), book('C', ['shared'])];
  const before = JSON.stringify(lists);
  const deleted = exclusiveDeletedWordIds(lists, 'A');
  assert.deepEqual([...deleted], ['unique-a']);
  for (const records of [['shared', 'unique-a'], ['unique-b', 'shared', 'unique-a']]) {
    assert.deepEqual(records.filter(id => !deleted.has(id)), records.filter(id => id !== 'unique-a'));
  }
  assert.equal(JSON.stringify(lists), before);
});
test('bundled books also protect shared words; deleting the final membership removes the word', () => {
  const lists = [book('offline', ['shared', 'built-in-only'], 'built_in'), book('custom', ['shared'])];
  assert.equal(exclusiveDeletedWordIds(lists, 'custom').size, 0);
  assert.deepEqual([...exclusiveDeletedWordIds(lists, 'offline')], ['built-in-only']);
  assert.deepEqual([...exclusiveDeletedWordIds([lists[0]], 'offline')], ['shared', 'built-in-only']);
  assert.equal(exclusiveDeletedWordIds(lists, 'missing').size, 0);
});
