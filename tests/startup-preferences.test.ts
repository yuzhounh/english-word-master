import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartupPreferences, startupVisit, resolveLocalBook, DEFAULT_BOOK_KEY } from '../src/lib/startupPreferences';
import type { WordListGroup, WrongWordItem, MasteredWordItem } from '../src/types';

const word = { id: 'one', word: 'one', chinese: '一', phonetic: '', exampleSentence: '', exampleSentenceCn: '' };
const list: WordListGroup = { id: 'book-b', name: 'B', words: [word], wordCount: 1, createdAt: 0, sourceType: 'built_in' };
test('startup opens a new quiz for the selected book, even after browsing', () => {
  const prefs = parseStartupPreferences(JSON.stringify({ rememberLast: true, defaultKey: 'wrong:all', lastVisit: { key: 'wrong:custom:book-b', mode: 'browse' } }));
  assert.deepEqual(startupVisit(prefs), { key: 'wrong:custom:book-b', mode: 'quiz' });
  assert.deepEqual(startupVisit({ ...prefs, rememberLast: false }), { key: 'wrong:all', mode: 'quiz' });
  assert.deepEqual(startupVisit(parseStartupPreferences(null)), { key: DEFAULT_BOOK_KEY, mode: 'quiz' });
});
test('invalid saved state uses safe defaults; remote book paths remain references', () => {
  assert.equal(parseStartupPreferences('{').defaultKey, DEFAULT_BOOK_KEY);
  assert.equal(parseStartupPreferences('null').rememberLast, true);
  const prefs = parseStartupPreferences(JSON.stringify({ defaultKey: 'library:test', lastVisit: { key: 'library:folder/book.json', name: '词书', mode: 'quiz' } }));
  assert.equal(prefs.defaultKey, DEFAULT_BOOK_KEY);
  assert.equal(prefs.lastVisit?.key, 'library:folder/book.json');
  assert.equal('words' in prefs.lastVisit!, false);
});
test('book IDs survive renaming; deleted books fall back and empty books stay valid', () => {
  const key = 'wrong:custom:book-b';
  assert.equal(resolveLocalBook(key, [{ ...list, name: '新名称' }], [], []).name, '新名称');
  assert.equal(resolveLocalBook(key, [], [], []).key, 'wrong:all');
  const empty = resolveLocalBook(key, [{ ...list, words: [], wordCount: 0 }], [], []);
  assert.equal(empty.key, key); assert.equal(empty.words.length, 0);
});
test('restored built-in quizzes exclude mastered words and use saved word enrichment', () => {
  const learned: WrongWordItem = { ...word, phonetic: 'saved', errorCount: 2, createdAt: 1, lastErrorAt: 1 };
  const key = 'wrong:custom:book-b';
  assert.equal(resolveLocalBook(key, [list], [learned], []).words[0].phonetic, 'saved');
  const mastered: MasteredWordItem = { ...word, masteredAt: 1 };
  assert.equal(resolveLocalBook(key, [list], [learned], [mastered]).words.length, 0);
  assert.equal(resolveLocalBook(key, [{ ...list, sourceType: 'custom' }], [learned], [mastered]).words.length, 1);
});
test('system filters restore their own source', () => {
  const words: WrongWordItem[] = [ { ...word, errorCount: 3, createdAt: 1, lastErrorAt: 1 }, { ...word, id: 'two', errorCount: 1, createdAt: 100, lastErrorAt: 100 } ];
  assert.deepEqual(resolveLocalBook('wrong:high_error', [], words, [], 100).words.map(w => w.id), ['one']);
  assert.equal(resolveLocalBook('mastered:recent', [], [], [{ ...word, masteredAt: 1 }], 9 * 86400000).words.length, 0);
});
