import assert from 'node:assert/strict';
import test from 'node:test';
import { createListStore, LEGACY_LISTS_KEY, type ListDatabase } from '../src/lib/listStore';
import type { WordListGroup } from '../src/types';

const list = (id: string, words = 1): WordListGroup => ({
  id, name: id, sourceType: 'custom', createdAt: 0, wordCount: words,
  words: Array.from({ length: words }, (_, index) => ({ id: id + index, word: id + index, phonetic: '', chinese: '', exampleSentence: '', exampleSentenceCn: '' })),
});
function fixture() {
  const values = new Map<string, string>();
  const local = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  let stored: WordListGroup[] | undefined, failGet = false, failPut = false;
  const database: ListDatabase = {
    get: async () => { if (failGet) throw Error('closed'); return stored && structuredClone(stored); },
    put: async lists => { if (failPut) throw Error('quota'); stored = structuredClone(lists); },
  };
  return { values, local, database, get stored() { return stored; },
    set failGet(value: boolean) { failGet = value; }, set failPut(value: boolean) { failPut = value; } };
}

test('lists saved by earlier versions move into the database once', async () => {
  const backend = fixture();
  backend.values.set(LEGACY_LISTS_KEY, JSON.stringify([list('a')]));
  assert.deepEqual((await createListStore(backend.database, backend.local).load()).map(item => item.id), ['a']);
  assert.equal(backend.values.has(LEGACY_LISTS_KEY), false);
  assert.deepEqual(backend.stored?.map(item => item.id), ['a']);
  assert.deepEqual((await createListStore(backend.database, backend.local).load()).map(item => item.id), ['a']);
});
test('a book larger than localStorage can hold is saved and reloaded from the database', async () => {
  const backend = fixture(), store = createListStore(backend.database, backend.local);
  await store.load();
  await store.save([list('big', 13000)]);
  assert.equal(backend.values.has(LEGACY_LISTS_KEY), false);
  assert.equal((await createListStore(backend.database, backend.local).load())[0].words.length, 13000);
});
test('saves keep their order, so the last call wins', async () => {
  const backend = fixture(), store = createListStore(backend.database, backend.local);
  await store.load();
  void store.save([list('a')]); void store.save([list('a'), list('b')]);
  await store.save([list('c')]);
  assert.deepEqual(backend.stored?.map(item => item.id), ['c']);
});
test('a failed database write falls back to localStorage, and the next start moves that newer copy back', async () => {
  const backend = fixture(), store = createListStore(backend.database, backend.local);
  await store.load(); await store.save([list('old')]);
  backend.failPut = true;
  await store.save([list('old'), list('new')]);
  assert.deepEqual(JSON.parse(backend.values.get(LEGACY_LISTS_KEY)!).map((item: WordListGroup) => item.id), ['old', 'new']);
  backend.failPut = false;
  assert.deepEqual((await createListStore(backend.database, backend.local).load()).map(item => item.id), ['old', 'new']);
  assert.deepEqual(backend.stored?.map(item => item.id), ['old', 'new']);
  assert.equal(backend.values.has(LEGACY_LISTS_KEY), false);
});
test('without a working database the lists stay in localStorage', async () => {
  const backend = fixture(); backend.failGet = true;
  const store = createListStore(backend.database, backend.local);
  assert.deepEqual(await store.load(), []);
  await store.save([list('a')]);
  assert.ok(backend.values.has(LEGACY_LISTS_KEY));
  assert.deepEqual(await createListStore(null, backend.local).load().then(lists => lists.map(item => item.id)), ['a']);
});
test('an unreadable localStorage copy is kept rather than deleted', async () => {
  const backend = fixture();
  await backend.database.put([list('a')]);
  backend.values.set(LEGACY_LISTS_KEY, '{broken');
  assert.deepEqual((await createListStore(backend.database, backend.local).load()).map(item => item.id), ['a']);
  assert.equal(backend.values.get(LEGACY_LISTS_KEY), '{broken');
});
