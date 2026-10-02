import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInWithPopupFallback, webAuthDomain } from '../src/lib/googleSignIn';

test('popup success returns the identity without redirecting', async () => {
  const user = { uid: 'test-user' };
  const result = await signInWithPopupFallback(async () => user, async () => { throw new Error('Unexpected redirect'); });
  assert.equal(result, user);
});

test('blocked popups switch to redirect once', async () => {
  let redirects = 0;
  const navigation = new Error('navigation started');
  await assert.rejects(signInWithPopupFallback(
    async () => { throw { code: 'auth/popup-blocked' }; },
    async () => { redirects++; throw navigation; }
  ), error => error === navigation);
  assert.equal(redirects, 1);
});

test('cancellation and configuration failures retain their error without a redirect loop', async () => {
  for (const code of ['auth/popup-closed-by-user', 'auth/unauthorized-domain', 'auth/network-request-failed']) {
    const failure = { code };
    await assert.rejects(signInWithPopupFallback(
      async () => { throw failure; },
      async () => { throw new Error('Unexpected redirect'); }
    ), error => error === failure);
  }
});

test('same-origin auth is restricted to the production web host', () => {
  const fallback = 'english-word-master-app.firebaseapp.com';
  assert.equal(webAuthDomain('english-word-master.vercel.app', false, fallback), 'english-word-master.vercel.app');
  for (const host of [undefined, 'localhost', 'preview.vercel.app', 'english-word-master.vercel.app.attacker.example']) {
    assert.equal(webAuthDomain(host, false, fallback), fallback);
  }
  assert.equal(webAuthDomain('english-word-master.vercel.app', true, fallback), fallback);
});
