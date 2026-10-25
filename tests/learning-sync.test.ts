import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { LearningSync, type LearningOperation } from '../src/lib/learningSync';
import { writeLearningOperations } from '../src/lib/learningWrite';

function fixture() {
  const values = new Map<string, string>(), documents = new Map<string, Record<string, unknown>>();
  let fail = false, loseAcknowledgement = false;
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const apply = async (uid: string, operations: LearningOperation[]) => {
    const staged = new Map(documents);
    const path = (relative: string) => uid + '/' + relative;
    let wrote = false;
    const committed = await writeLearningOperations(operations, {
      get: async relative => { if (wrote) throw Error('reads must precede writes'); return staged.get(path(relative)) || null; },
      set: (relative, data) => { wrote = true; staged.set(path(relative), data); },
      delete: relative => { wrote = true; staged.delete(path(relative)); },
    });
    if (fail) throw Error('permission denied');
    documents.clear(); for (const [key, value] of staged) documents.set(key, value);
    if (loseAcknowledgement) { loseAcknowledgement = false; throw Error('lost acknowledgement'); }
    return committed;
  };
  return { storage, documents, values, apply,
    set fail(value: boolean) { fail = value; }, set loseAcknowledgement(value: boolean) { loseAcknowledgement = value; } };
}

test('failed move retains both the original cloud state and a durable operation; reload can retry', async () => {
  const backend = fixture(); backend.fail = true;
  backend.documents.set('A/wrongWords/example', { word: 'example', errorCount: 3 });
  const first = new LearningSync(backend.storage, backend.apply);
  first.setUser('A'); await first.flush();
  await assert.rejects(first.enqueue('A', 'move-mastered', { word: 'example' }), /permission denied/);
  assert.ok(backend.documents.has('A/wrongWords/example'));
  assert.equal(backend.documents.has('A/masteredWords/example'), false);
  assert.equal(first.getState().pending, 1);
  const reloaded = new LearningSync(backend.storage, backend.apply);
  backend.fail = false; reloaded.setUser('A'); await reloaded.flush();
  assert.equal(backend.documents.has('A/wrongWords/example'), false);
  assert.ok(backend.documents.has('A/masteredWords/example'));
  assert.equal(reloaded.getState().pending, 0);
  assert.equal(reloaded.getState().error, null);
  assert.equal(reloaded.getConfirmedChanges().get('example'), 'move-mastered');
});
test('a lost acknowledgement retries the same receipt and does not count an error twice', async () => {
  const backend = fixture(), queue = new LearningSync(backend.storage, backend.apply);
  queue.setUser('A'); await queue.flush(); backend.loseAcknowledgement = true;
  await assert.rejects(queue.enqueue('A', 'move-wrong', { word: 'example', errorCount: 1 }), /lost acknowledgement/);
  assert.equal(backend.documents.get('A/wrongWords/example')?.errorCount, 1);
  await queue.flush();
  assert.equal(backend.documents.get('A/wrongWords/example')?.errorCount, 1);
  assert.equal(queue.getState().pending, 0);
});
test('deletion errors propagate and both deletion kinds retry without leaving stale records', async () => {
  const backend = fixture(), queue = new LearningSync(backend.storage, backend.apply);
  backend.documents.set('A/wrongWords/example', { word: 'example' });
  backend.documents.set('A/masteredWords/example', { word: 'example' });
  queue.setUser('A'); await queue.flush(); backend.fail = true;
  await assert.rejects(queue.enqueue('A', 'delete-wrong', { word: 'example' }));
  await assert.rejects(queue.enqueue('A', 'delete-mastered', { word: 'example' }));
  assert.equal(queue.getState().pending, 2);
  backend.fail = false; await queue.flush();
  assert.equal(backend.documents.has('A/wrongWords/example'), false);
  assert.equal(backend.documents.has('A/masteredWords/example'), false);
  assert.equal(queue.getConfirmedChanges().get('example'), 'delete-mastered');
});
test('account switching during a write keeps its acknowledgement isolated and starts the new account', async () => {
  const backend = fixture(); let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const beginning = new Promise<void>(resolve => { started = resolve; });
  const queue = new LearningSync(backend.storage, async (uid, operations) => {
    if (uid === 'A') { started(); await gate; }
    return backend.apply(uid, operations);
  });
  queue.setUser('A'); await queue.flush();
  const old = queue.enqueue('A', 'wrong', { word: 'old', errorCount: 1 });
  await beginning; queue.setUser('B');
  await queue.enqueue('B', 'mastered', { word: 'new' });
  release(); await old;
  assert.ok(backend.documents.has('B/masteredWords/new'));
  assert.equal(backend.documents.has('B/wrongWords/old'), false);
  assert.equal(JSON.parse(backend.values.get('wordmaster_learning_pending_v1:A')!).length, 1);
  queue.setUser('A'); await queue.flush();
  assert.equal(backend.documents.get('A/wrongWords/old')?.errorCount, 1);
  assert.equal(queue.getState().pending, 0);
});
test('storage failures stay visible and do not send an unpersisted operation', async () => {
  const backend = fixture(); let deny = true;
  const queue = new LearningSync({ ...backend.storage, setItem: (key, value) => { if (deny) throw Error('quota'); backend.storage.setItem(key, value); } }, backend.apply);
  deny = false; queue.setUser('A'); await queue.flush(); deny = true;
  await assert.rejects(queue.enqueue('A', 'wrong', { word: 'example' }), /quota/);
  assert.equal(queue.getState().durable, false);
  assert.equal(queue.getState().pending, 1);
  assert.equal(backend.documents.size, 0);
  deny = false; await queue.flush();
  assert.equal(queue.getState().pending, 0);
  assert.equal(queue.getState().durable, true);
});
test('a burst of enqueues from one book stores the queue once and sends every word in order, in few transactions', async () => {
  const backend = fixture(); let writes = 0, transactions = 0; const sent: string[] = [];
  const queue = new LearningSync({ ...backend.storage, setItem: (key, value) => { writes++; backend.storage.setItem(key, value); } },
    async (uid, operations) => { transactions++; sent.push(...operations.map(operation => operation.word.word)); return backend.apply(uid, operations); });
  queue.setUser('A'); await queue.flush(); writes = 0;
  const words = Array.from({ length: 2000 }, (_, index) => 'word' + index);
  const done = Promise.all(words.map(word => queue.enqueue('A', 'wrong', { word })));
  assert.equal(queue.getState().pending, 2000);
  assert.equal(writes, 1);
  await Promise.resolve();
  assert.equal(writes, 2);
  assert.equal(JSON.parse(backend.values.get('wordmaster_learning_pending_v1:A')!).length, 2000);
  await done;
  assert.deepEqual(sent, words);
  assert.equal(transactions, 50);
  assert.equal(queue.getState().pending, 0);
  assert.ok(backend.documents.has('A/wrongWords/word1999'));
  assert.equal([...backend.documents.keys()].filter(key => key.startsWith('A/learningSyncReceipts/')).length, 50);
});
test('a batch gives the same cloud records as one transaction per operation', async () => {
  const operations: LearningOperation[] = ([
    ['wrong', { word: 'a', errorCount: 1, phonetic: '/a/' }], ['wrong', { word: 'a', errorCount: 2, chinese: '甲' }],
    ['move-mastered', { word: 'b' }], ['mastered', { word: 'c' }], ['move-wrong', { word: 'c', errorCount: 1 }],
    ['delete-wrong', { word: 'a' }], ['wrong', { word: 'a' }], ['delete-mastered', { word: 'b' }], ['move-wrong', { word: 'b', errorCount: 1 }],
  ] as const).map(([kind, word], index) => ({ id: 'op' + index, kind, word, createdAt: 1000 + index }));
  const run = async (batches: LearningOperation[][]) => {
    const backend = fixture();
    backend.documents.set('A/wrongWords/b', { word: 'b', errorCount: 4, createdAt: 1 });
    for (const batch of batches) assert.equal(await backend.apply('A', batch), batch.length);
    return new Map([...backend.documents].filter(([key]) => !key.includes('/learningSyncReceipts/')));
  };
  assert.deepEqual(await run([operations]), await run(operations.map(operation => [operation])));
});
test('a retried batch after a lost acknowledgement counts each word once', async () => {
  const backend = fixture(), queue = new LearningSync(backend.storage, backend.apply);
  queue.setUser('A'); await queue.flush(); backend.loseAcknowledgement = true;
  const writes = ['x', 'y', 'z'].map(word => queue.enqueue('A', 'move-wrong', { word, errorCount: 1 }));
  await Promise.allSettled(writes);
  assert.equal(queue.getState().pending, 3);
  await queue.flush();
  for (const word of ['x', 'y', 'z']) assert.equal(backend.documents.get('A/wrongWords/' + word)?.errorCount, 1);
  assert.equal(queue.getState().pending, 0);
});
test('a receipt from the former one-operation format releases only that operation', async () => {
  const backend = fixture();
  backend.values.set('wordmaster_learning_pending_v1:A', JSON.stringify([
    { id: 'old', kind: 'wrong', word: { word: 'x', errorCount: 1 }, createdAt: 1 },
    { id: 'new', kind: 'wrong', word: { word: 'y', errorCount: 1 }, createdAt: 2 },
  ]));
  backend.documents.set('A/learningSyncReceipts/old', { createdAt: 1, kind: 'wrong' });
  backend.documents.set('A/wrongWords/x', { word: 'x', errorCount: 1 });
  const queue = new LearningSync(backend.storage, backend.apply);
  queue.setUser('A'); await queue.flush();
  assert.equal(backend.documents.get('A/wrongWords/x')?.errorCount, 1);
  assert.equal(backend.documents.get('A/wrongWords/y')?.errorCount, 1);
  assert.equal(backend.documents.get('A/learningSyncReceipts/new')?.count, 1);
  assert.equal(queue.getState().pending, 0);
});
test('real cloud read helpers distinguish an empty collection from a read failure', async () => {
  const source = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
  const wrong = source.slice(source.indexOf('export const fetchWrongWordsFromFirestore'), source.indexOf('// Firestore helper functions'));
  const mastered = source.slice(source.indexOf('export const fetchMasteredWordsFromFirestore'));
  let fail = true;
  const context = vm.createContext({ console: { error() {} },
    getStore: async () => ({ db: {}, collection: () => ({}), query: () => ({}), orderBy: () => ({}),
      getDocs: async () => { if (fail) throw Error('offline'); return { forEach() {} }; },
    }),
  });
  vm.runInContext(ts.transpileModule((wrong + mastered).replace(/\bexport /g, '') + '\nglobalThis.helpers = [fetchWrongWordsFromFirestore, fetchMasteredWordsFromFirestore];', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  for (const helper of context.helpers) await assert.rejects(helper('A'), /offline/);
  fail = false;
  for (const helper of context.helpers) assert.equal((await helper('A')).length, 0);
});
