import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createApp } from '../api/createApp';
import { AI_LEASE_MS, AiAccessError, createAiAccess, type AiAccess, type Usage, type UsageStore } from '../api/aiAccess';

// Serialized transactions shared by independent app instances; no Firebase or paid network calls.
class MemoryStore implements UsageStore {
  users = new Map<string, Usage>();
  global?: Usage;
  queue = Promise.resolve();
  update(uid: string, change: (user?: Usage, global?: Usage) => [Usage, Usage]) {
    const result = this.queue.then(() => {
      const [user, global] = change(structuredClone(this.users.get(uid)), structuredClone(this.global));
      this.users.set(uid, user);
      this.global = global;
    });
    this.queue = result.catch(() => {});
    return result;
  }
}

function access(store: UsageStore = new MemoryStore(), now?: () => number) {
  return createAiAccess({ store, now, verifyToken: async token => {
    if (['forged', 'expired', 'revoked', 'disabled', 'wrong-project'].includes(token)) {
      const code = { expired: 'auth/id-token-expired', revoked: 'auth/id-token-revoked', disabled: 'auth/user-disabled' }[token];
      throw Object.assign(new Error('Invalid token'), { code: code || 'auth/invalid-id-token' });
    }
    if (token === 'auth-outage') throw new Error('Auth unavailable');
    return { uid: token, firebase: { sign_in_provider: token === 'anonymous' ? 'anonymous' : 'google.com' } } as DecodedIdToken;
  }});
}

const realFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let modelBodies: any[];
let modelHandler: (body: any) => Promise<Response>;

function modelResponse(body: any) {
  const prompt = body.messages[1].content;
  const source = prompt.includes('Input words:\n') ? JSON.parse(prompt.split('Input words:\n')[1]) : [{ word: 'example' }];
  const words = source.map((word: any) => ({ ...word, phonetic: '/test/', chinese: '测试', exampleSentence: 'A test.', exampleSentenceCn: '测试。' }));
  return Response.json({ choices: [{ message: { content: JSON.stringify({ totalWordsCount: 10, words }) } }] });
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'mock-key';
  delete process.env.AI_USER_DAILY_CALLS;
  delete process.env.AI_GLOBAL_DAILY_CALLS;
  delete process.env.ENRICH_CONCURRENCY;
  delete process.env.ENRICH_CHUNK_SIZE;
  delete process.env.ENRICH_CHUNK_SIZE_LIGHT;
  modelBodies = [];
  modelHandler = async body => modelResponse(body);
  globalThis.fetch = (async (url: any, options: any) => {
    if (String(url).startsWith('https://api.deepseek.com/')) {
      const body = JSON.parse(options.body);
      modelBodies.push(body);
      return modelHandler(body);
    }
    assert.ok(String(url).startsWith('http://127.0.0.1:'), `Unexpected external request: ${url}`);
    return realFetch(url, options);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

async function withServer(aiAccess: AiAccess, run: (base: string) => Promise<void>) {
  const server: Server = createApp({ aiAccess }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

async function post(base: string, route: string, body: unknown, token = 'user') {
  return fetch(`${base}/api/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
}

const sample = (count: number) => Array.from({ length: count }, (_, i) => ({ word: `word${i}`, chinese: '' }));
const resume = (segments: unknown, limitPerSegment: unknown = 5) => Buffer.from(JSON.stringify({ segments, limitPerSegment })).toString('base64');

test('both paid routes reject missing, forged, expired, revoked, disabled and anonymous identities before any model call', async () => {
  await withServer(access(), async base => {
    for (const route of ['analyze-text', 'enrich-words']) {
      const body = route === 'analyze-text' ? { text: 'A test.' } : { words: sample(1) };
      for (const token of ['', 'forged', 'expired', 'revoked', 'disabled', 'wrong-project', 'anonymous', 'auth-outage']) {
        const response = await post(base, route, body, token);
        assert.equal(response.status, token === 'anonymous' ? 403 : token === 'auth-outage' ? 503 : 401);
      }
    }
  });
  assert.equal(modelBodies.length, 0);
});

test('benchmark overrides, oversized inputs and forged resume fields are rejected without reserving budget', async () => {
  const store = new MemoryStore();
  await withServer(access(store), async base => {
    for (const body of [{ words: sample(1), _benchConcurrency: 999 }, { words: sample(1), _benchChunkSize: 999 },
      { words: sample(201) }, { words: [null] }, { words: [{ word: 'a'.repeat(81) }] },
      { words: [{ word: 'test', chinese: {} }] }]) {
      assert.equal((await post(base, 'enrich-words', body)).status, 400);
    }
    for (const body of [{ text: 'a'.repeat(30001) }, { text: 'test', maxWords: 51 },
      { resume: resume([42]) }, { resume: resume(['a'.repeat(1501)]) },
      { resume: resume(['test'], 100000) }, { resume: resume(['a'.repeat(1500)].concat(Array(20).fill('b'.repeat(1500)))) },
      { text: 'test', _benchConcurrency: 9 }]) {
      assert.equal((await post(base, 'analyze-text', body)).status, 400);
    }
    const oversized = await post(base, 'enrich-words', { padding: 'x'.repeat(270000) });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'INVALID_INPUT');
  });
  assert.equal(modelBodies.length, 0);
  assert.equal(store.global, undefined);
});

test('server clamps chunk size, concurrency and output tokens even with oversized environment settings', async () => {
  process.env.ENRICH_CONCURRENCY = '999';
  process.env.ENRICH_CHUNK_SIZE_LIGHT = '999';
  let active = 0;
  let maximum = 0;
  modelHandler = async body => {
    maximum = Math.max(maximum, ++active);
    await new Promise<void>(resolve => setImmediate(resolve));
    active--;
    return modelResponse(body);
  };
  const store = new MemoryStore();
  await withServer(access(store), async base => {
    const response = await post(base, 'enrich-words', { words: sample(200), light: true });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.done, true);
    assert.equal(data.words.length, 200);
  });
  assert.equal(maximum, 3);
  assert.equal(modelBodies.length, 6);
  for (const body of modelBodies) {
    assert.equal(body.max_tokens, 4096);
    assert.ok(JSON.parse(body.messages[1].content.split('Input words:\n')[1]).length <= 35);
  }
  assert.equal(store.global?.calls, 6);
  assert.equal(store.global?.leases.length, 0);
});

test('analysis and enrichment retain bounded continuations and charge every invocation', async () => {
  process.env.ENRICH_CHUNK_SIZE_LIGHT = '10';
  const store = new MemoryStore();
  await withServer(access(store), async base => {
    const first = await (await post(base, 'analyze-text', { text: 'a'.repeat(10500) })).json();
    assert.equal(first.done, false);
    assert.equal(modelBodies.length, 6);
    const second = await (await post(base, 'analyze-text', { resume: first.resume })).json();
    assert.equal(second.done, true);
    const enrich = await (await post(base, 'enrich-words', { words: sample(80), light: true })).json();
    assert.equal(enrich.done, false);
    assert.equal(enrich.words.length, 60);
    assert.equal(enrich.pending.length, 20);
    const finish = await (await post(base, 'enrich-words', { words: enrich.pending, light: true })).json();
    assert.equal(finish.done, true);
    assert.equal(finish.words.length, 20);
  });
  assert.equal(store.global?.calls, 15);
});

test('two app instances share active-user and global concurrency limits', async () => {
  const store = new MemoryStore();
  const pending: (() => void)[] = [];
  let started!: () => void;
  modelHandler = async body => {
    started();
    await new Promise<void>(resolve => pending.push(resolve));
    return modelResponse(body);
  };
  await withServer(access(store), async first => withServer(access(store), async second => {
    let ready = new Promise<void>(resolve => { started = resolve; });
    const a = post(first, 'enrich-words', { words: sample(1) }, 'a');
    await ready;
    const duplicate = await post(second, 'analyze-text', { text: 'test' }, 'a');
    assert.equal(duplicate.status, 429);
    assert.equal((await duplicate.json()).code, 'CONCURRENCY_LIMIT');
    assert.ok(Number(duplicate.headers.get('Retry-After')) > 0);
    ready = new Promise<void>(resolve => { started = resolve; });
    const b = post(second, 'enrich-words', { words: sample(1) }, 'b');
    await ready;
    assert.equal((await post(first, 'enrich-words', { words: sample(1) }, 'c')).status, 429);
    pending.forEach(resolve => resolve());
    assert.equal((await a).status, 200);
    assert.equal((await b).status, 200);
  }));
  assert.equal(modelBodies.length, 2);
});

test('daily user and global budgets are atomic across instances and reset at UTC midnight', async () => {
  process.env.AI_USER_DAILY_CALLS = '3';
  process.env.AI_GLOBAL_DAILY_CALLS = '4';
  let now = Date.UTC(2026, 9, 2, 23, 59, 0);
  const store = new MemoryStore();
  const a = access(store, () => now);
  const b = access(store, () => now);
  await (await a.reserve('a', 3))();
  await assert.rejects(b.reserve('a', 1), { code: 'QUOTA_EXCEEDED' });
  await assert.rejects(b.reserve('b', 2), { code: 'QUOTA_EXCEEDED' });
  await (await b.reserve('b', 1))();
  assert.equal(store.global?.calls, 4);
  now += 60000;
  await (await a.reserve('a', 3))();
  assert.equal(store.global?.calls, 3);
});

test('per-user and global minute limits reset independently of daily quotas', async () => {
  let now = Date.UTC(2026, 9, 2, 12);
  const store = new MemoryStore();
  const guard = access(store, () => now);
  for (let i = 0; i < 10; i++) await (await guard.reserve('a', 1))();
  await assert.rejects(guard.reserve('a', 1), { code: 'RATE_LIMIT' });
  for (let i = 0; i < 50; i++) await (await guard.reserve(`user${i}`, 1))();
  await assert.rejects(guard.reserve('new-user', 1), { code: 'RATE_LIMIT' });
  now += 60000;
  await (await guard.reserve('a', 1))();
  assert.equal(store.users.get('a')?.calls, 11);
});

test('expired leases recover after crashes and an old release cannot clear a new request', async () => {
  let now = Date.UTC(2026, 9, 2);
  const store = new MemoryStore();
  const guard = access(store, () => now);
  const oldRelease = await guard.reserve('a', 1);
  now += AI_LEASE_MS + 1;
  const newRelease = await guard.reserve('a', 1);
  await oldRelease();
  assert.equal(store.global?.leases.length, 1);
  await newRelease();
  assert.equal(store.global?.leases.length, 0);
});

test('quota outage and quota rejection prevent all paid calls; failed upstream calls keep reserved quota', async () => {
  await withServer(access({ update: async () => { throw new Error('Firestore unavailable'); } }), async base => {
    assert.equal((await post(base, 'enrich-words', { words: sample(1) })).status, 503);
  });
  process.env.AI_USER_DAILY_CALLS = '0';
  await withServer(access(), async base => {
    for (const route of ['analyze-text', 'enrich-words']) {
      const response = await post(base, route, { words: sample(1), text: 'test' });
      assert.equal(response.status, 429);
      assert.equal((await response.json()).code, 'QUOTA_EXCEEDED');
    }
  });
  assert.equal(modelBodies.length, 0);
  process.env.AI_USER_DAILY_CALLS = '1';
  modelHandler = async () => new Response('mock upstream failure', { status: 500 });
  const store = new MemoryStore();
  await withServer(access(store), async base => {
    await post(base, 'enrich-words', { words: sample(1) });
    assert.equal((await post(base, 'enrich-words', { words: sample(1) })).status, 429);
  });
  assert.equal(modelBodies.length, 1);
  assert.equal(store.global?.calls, 1);
  assert.equal(store.global?.leases.length, 0);
});

test('public dictionary lookup remains available without AI identity or quota', async () => {
  await withServer(access(), async base => {
    const response = await post(base, 'word-dictionary/lookup', { words: [{ word: 'hello' }] }, '');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  });
  assert.equal(modelBodies.length, 0);
});
