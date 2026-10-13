import type { WordListGroup } from '../types';

const wordKey = (word: { id: string; word: string }) => (word.id || word.word).trim().toLowerCase();

// Learning records are shared by word ID. Only remove records with no remaining book.
export function exclusiveDeletedWordIds(lists: WordListGroup[], deletedId: string): Set<string> {
  const target = lists.find(list => list.id === deletedId);
  if (!target) return new Set();
  const retained = new Set(lists.filter(list => list.id !== deletedId).flatMap(list => list.words.map(wordKey)));
  return new Set(target.words.map(wordKey).filter(id => !retained.has(id)));
}
