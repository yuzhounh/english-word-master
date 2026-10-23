import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { lazyModule } from '../src/lib/lazyModule';

test('concurrent module requests share one load and failures can be retried', async () => {
  let attempts = 0;
  const client = lazyModule(async () => {
    if (++attempts === 1) throw Error('synthetic download failure');
    return { ready: true };
  });
  const first = client.load();
  assert.equal(client.load(), first);
  await assert.rejects(first, /download failure/);
  const [a, b] = await Promise.all([client.load(), client.load()]);
  assert.equal(a, b);
  assert.equal(client.current, a);
  assert.equal(attempts, 2);
});

async function fixture() {
  const modules: Record<string, string> = {
    'firebase/app': `export const getApps=()=>[]; export const initializeApp=()=>({}); export const getApp=()=>({});`,
    'firebase/auth': `globalThis.authLoads++;
      export const getAuth=()=>globalThis.testAuth;
      export class GoogleAuthProvider {setCustomParameters(){} static credential(){return {};}}
      export const getRedirectResult=async()=>null, signInWithCredential=async()=>({user:null}),
        signInWithPopup=async()=>({user:null}), signInWithRedirect=async()=>{}, signOut=async()=>{},
        onAuthStateChanged=()=>()=>{};`,
    '@capacitor/core': `export const Capacitor={isNativePlatform:()=>false}; export const registerPlugin=()=>({});`,
    'firebase/firestore': `globalThis.storeLoads++;
      if (globalThis.switchAccountOnStoreLoad) globalThis.testAuth.currentUser={uid:'B'};
      export const getFirestore=()=>({}), doc=(_db,...path)=>path.join('/'), collection=()=>({}),
        query=()=>({}), orderBy=()=>({});
      export const getDocs=async()=>{globalThis.reads++;return {forEach(){}};};
      export const runTransaction=async(_db,callback)=>callback({
        get:async path=>({exists:()=>globalThis.documents.has(path),data:()=>globalThis.documents.get(path)}),
        set:(path,data)=>globalThis.documents.set(path,data),delete:path=>globalThis.documents.delete(path)
      });`,
  };
  const result = await build({
    entryPoints: ['src/lib/cloud.ts'], absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
    plugins: [{ name: 'isolated-sdk', setup(builder) {
      builder.onResolve({ filter: /^(firebase\/(app|auth|firestore)|@capacitor\/core)$/ }, args => ({ path: args.path, namespace: 'sdk' }));
      builder.onLoad({ filter: /.*/, namespace: 'sdk' }, args => ({ contents: modules[args.path], loader: 'js' }));
    } }],
  });
  const values = new Map<string, string>();
  const context = vm.createContext({ module: { exports: {} }, console, crypto: webcrypto, structuredClone,
    authLoads: 0, storeLoads: 0, reads: 0, documents: new Map(), testAuth: { currentUser: null },
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  });
  vm.runInContext(result.outputFiles[0].text, context);
  return { client: context.module.exports as typeof import('../src/lib/cloud'), context, values };
}

test('local queue and auth restoration do not initialize Firestore; actual reads share its first load', async () => {
  const { client, context } = await fixture();
  const unsubscribe = client.subscribeLearningSync(state => assert.equal(state.pending, 0));
  assert.equal(context.authLoads, 0);
  assert.equal(context.storeLoads, 0);
  await Promise.all([client.loadFirebaseAuth(), client.loadFirebaseAuth()]);
  assert.equal(context.authLoads, 1);
  assert.equal(context.storeLoads, 0);
  await Promise.all([client.fetchWrongWordsFromFirestore('A'), client.fetchMasteredWordsFromFirestore('A')]);
  assert.equal(context.storeLoads, 1);
  assert.equal(context.reads, 2);
  unsubscribe();
});

test('a learning edit is durably queued before asynchronous SDK loading and keeps its account', async () => {
  const { client, context, values } = await fixture();
  const { auth } = await client.loadFirebaseAuth();
  (auth as any).currentUser = { uid: 'A' };
  client.setLearningSyncUser('A');
  const write = client.syncWrongWordToFirestore('A', { word: 'hello', errorCount: 1 });
  const pending = JSON.parse(values.get('wordmaster_learning_pending_v1:A')!);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].word.word, 'hello');
  assert.equal(context.storeLoads, 0);
  await write;
  assert.equal(context.documents.get('users/A/wrongWords/hello').errorCount, 1);
  assert.equal(context.storeLoads, 1);
  assert.equal(JSON.parse(values.get('wordmaster_learning_pending_v1:A')!).length, 0);
});

test('an account change during SDK loading leaves the old operation queued without a cloud write', async () => {
  const { client, context, values } = await fixture();
  const { auth } = await client.loadFirebaseAuth();
  (auth as any).currentUser = { uid: 'A' };
  context.switchAccountOnStoreLoad = true;
  client.setLearningSyncUser('A');
  await assert.rejects(client.syncWrongWordToFirestore('A', { word: 'hello', errorCount: 1 }), /账户已经改变/);
  assert.equal(context.documents.size, 0);
  assert.equal(JSON.parse(values.get('wordmaster_learning_pending_v1:A')!).length, 1);
});
