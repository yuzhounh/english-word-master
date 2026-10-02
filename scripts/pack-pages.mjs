import { copyFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('.pages/', root), { recursive: true });
await copyFile(new URL('deploy/cloudflare-proxy.mjs', root), new URL('.pages/proxy.mjs', root));
await writeFile(new URL('.pages/_worker.js', root), "import { createProxy } from './proxy.mjs';\nexport default createProxy('https://english-word-master.vercel.app');\n");
