import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { auth } from '../src/lib/firebase';
import { AiClientError, postAiJson } from '../src/lib/aiApi';
import { enrichWordsWithAI, enrichWordsWithDictionaryFallback } from '../src/utils/wordParser';

const originalFetch = globalThis.fetch;
const originalUser = auth.currentUser;
let tokenCalls = 0;

beforeEach(() => {
  tokenCalls = 0;
  mock.method(auth, 'authStateReady', async () => {});
  (auth as any).currentUser = { getIdToken: async () => `token-${++tokenCalls}` };
  globalThis.fetch = (async () => { throw new Error('Unexpected network call'); }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  (auth as any).currentUser = originalUser;
  mock.restoreAll();
});

test('large imports use serial batches within 200 words, refresh identity and retain partial continuations', async () => {
  const sizes: number[] = [];
  let active = 0;
  let maximum = 0;
  globalThis.fetch = (async (url: any, options: any) => {
    assert.equal(url, '/api/enrich-words');
    const body = JSON.parse(options.body);
    sizes.push(body.words.length);
    assert.equal(options.headers.Authorization, `Bearer token-${sizes.length}`);
    maximum = Math.max(maximum, ++active);
    await new Promise<void>(resolve => setImmediate(resolve));
    active--;
    const count = sizes.length === 1 ? 100 : body.words.length;
    return Response.json({ success: true, done: count === body.words.length,
      words: body.words.slice(0, count).map((word: any) => ({ ...word, id: word.word })), pending: body.words.slice(count) });
  }) as typeof fetch;
  const input = Array.from({ length: 401 }, (_, i) => ({ word: `word${i}`, chinese: '' }));
  const result = await enrichWordsWithAI(input);
  assert.deepEqual(sizes, [200, 200, 101]);
  assert.equal(maximum, 1);
  assert.equal(tokenCalls, 3);
  assert.deepEqual(result.map(item => item.word), input.map(item => item.word));
});

test('anonymous client calls stop before sending an AI request', async () => {
  (auth as any).currentUser = null;
  await assert.rejects(postAiJson('/api/analyze-text', { text: 'test' }), AiClientError);
  await assert.rejects(enrichWordsWithAI([{ word: 'test', chinese: '' }]), /请先登录/);
  assert.equal(tokenCalls, 0);
});

test('quota errors reach the UI without an automatic retry loop', async () => {
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    return Response.json({ success: false, code: 'QUOTA_EXCEEDED', error: '今日 AI 配额已用完，请明日重试。' }, { status: 429 });
  }) as typeof fetch;
  await assert.rejects(enrichWordsWithAI([{ word: 'test', chinese: '' }]), /今日 AI 配额/);
  assert.equal(requests, 1);
});

test('dictionary-resolved vocabulary still works when the client is signed out', async () => {
  (auth as any).currentUser = null;
  globalThis.fetch = (async (url: any) => {
    assert.equal(url, '/api/word-dictionary/lookup');
    return Response.json({ success: true, words: [{ word: 'hello', enriched: true, chinese: '你好', phonetic: '/hello/' }] });
  }) as typeof fetch;
  const result = await enrichWordsWithDictionaryFallback([{ word: 'hello', chinese: '' }]);
  assert.equal(result[0].chinese, '你好');
  assert.equal(tokenCalls, 0);
});
