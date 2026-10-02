import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { createProxy } from '../deploy/cloudflare-proxy.mjs';

test('Pages entry preserves nested routes, query and fragment', () => {
  execFileSync(process.execPath, ['scripts/build-landing.mjs']);
  const script = readFileSync('dist_pages/404.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  let destination;
  runInNewContext(script, { window: { location: {
    hostname: 'yuzhounh.github.io', pathname: '/english-word-master/review', search: '?lang=zh', hash: '#words',
    replace: value => { destination = value; },
  } } });
  assert.equal(destination, 'https://english-word-master.vercel.app/review?lang=zh#words');
});

test('gateway preserves API method, token, body and status without buffering', async () => {
  const proxy = createProxy('https://english-word-master.vercel.app', async request => {
    assert.equal(request.url, 'https://english-word-master.vercel.app/api/enrich-words?batch=2');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('authorization'), 'Bearer fixture');
    assert.equal(request.headers.get('x-forwarded-host'), 'english-word-master.pages.dev');
    assert.equal(await request.text(), '{"words":["test"]}');
    return new Response('{"error":"fixture"}', { status: 429, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  });
  const response = await proxy.fetch(new Request('https://english-word-master.pages.dev/api/enrich-words?batch=2', {
    method: 'POST', headers: { authorization: 'Bearer fixture' }, body: '{"words":["test"]}',
  }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '{"error":"fixture"}');
});

test('gateway keeps external authorization destinations and rewrites internal redirects', async () => {
  for (const [location, expected] of [
    ['https://english-word-master.vercel.app/review?q=1', 'https://english-word-master.pages.dev/review?q=1'],
    ['https://accounts.google.com/fixture', 'https://accounts.google.com/fixture'],
  ]) {
    const proxy = createProxy('https://english-word-master.vercel.app', async () => new Response(null, { status: 302, headers: { location } }));
    const response = await proxy.fetch(new Request('https://english-word-master.pages.dev/'));
    assert.equal(response.headers.get('location'), expected);
  }
});
