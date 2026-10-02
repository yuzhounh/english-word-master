import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const origin = 'https://english-word-master.vercel.app';
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在打开站点</title><body><p>正在打开站点… <a href="${origin}/">前往完整站点</a></p><script>
const origin = ${JSON.stringify(origin)};
const prefix = '/english-word-master';
let path = window.location.pathname;
if (window.location.hostname === 'yuzhounh.github.io' && (path === prefix || path.startsWith(prefix + '/'))) path = path.slice(prefix.length) || '/';
window.location.replace(origin + path + window.location.search + window.location.hash);
</script></body></html>`;
await mkdir(new URL('dist_pages/', root), { recursive: true });
for (const name of ['index.html', '404.html']) await writeFile(new URL('dist_pages/' + name, root), html);
await writeFile(new URL('dist_pages/.nojekyll', root), '');
await writeFile(new URL('dist_pages/deployment-manifest.json', root), JSON.stringify({
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  mode: 'entry-redirect', runtimeOrigin: origin,
}, null, 2) + '\n');
