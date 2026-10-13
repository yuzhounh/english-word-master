import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = path.join(root, 'data/english-word-enriched');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/offline/cet-source-rows.json'), 'utf8'));
const dictionary = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(library, 'dictionary.json.gz'))));
// The source dictionary omits these two basic words; supply complete local entries.
dictionary.a = { w: 'a', p: '/ə/', c: 'art. 一个（用于辅音音素开头的单词前）', e: 'I bought a book.', cn: '我买了一本书。' };
dictionary.i = { w: 'I', p: '/aɪ/', c: 'pron. 我', e: 'I like reading.', cn: '我喜欢阅读。' };
const compact = new Map(Object.keys(dictionary).map(key => [key.replace(/[\s’']/g, '').toLowerCase(), key]));
const cet4 = new Set(), cet6 = new Set();
const aliases = { instalation: 'installation', celcius: 'celsius', connecxion: 'connexion', sobre: 'sober' };
const unresolved = new Set();
for (const { line, advanced } of source.rows) {
  const tokens = line.split(/\s+/);
  if (line.startsWith("coup (d'état)")) tokens.push("coup d'état");
  for (const token of tokens) {
    const optional = token.match(/^(.*?)\((.*?)\)(.*?)$/);
    const expanded = optional ? [optional[1] + optional[3], optional[1] + optional[2] + optional[3]] : [token];
    const variants = expanded.flatMap(form => {
      const [base, ...alternates] = form.split('/');
      return [base, ...alternates.map(alt => alt.startsWith('-') ? base.slice(0, -(alt.length - 1)) + alt.slice(1) : alt)];
    }).filter(Boolean);
    for (let variant of variants) {
      if (variant === "d'état") continue;
      variant = variant.toLowerCase();
      variant = aliases[variant] || variant;
      const key = dictionary[variant] ? variant : compact.get(variant.replace(/[\s’']/g, ''));
      if (!key) { unresolved.add(variant); continue; }
      cet6.add(key);
      if (!advanced) cet4.add(key);
    }
  }
}
if (source.rows.length < 5300 || unresolved.size) throw new Error(`CET source incomplete: ${[...unresolved].join(', ')}`);

const pep = '1.全国各大教材版本中小学同步/人教版/';
const gradeBooks = [
  ['grade7', '初一', ['人教版初中英语七年级上册', '人教版初中英语七年级下册']],
  ['grade8', '初二', ['人教版初中英语八年级上册', '人教版初中英语八年级下册']],
  ['grade9', '初三', ['人教版初中英语九年级全册']],
  ['grade10', '高一', ['人教版高中英语必修第一册', '人教版高中英语必修第二册', '人教版高中英语必修第三册']],
  ['grade11', '高二', ['人教版高中英语选择性必修第一册', '人教版高中英语选择性必修第二册', '人教版高中英语选择性必修第三册']],
  ['grade12', '高三', ['人教版高中英语选择性必修第四册']],
];
const books = gradeBooks.map(([id, name, texts]) => ({
  id: `offline-${id}`, name,
  source: texts.join('、'),
  wordIds: [...new Set(texts.flatMap(text => JSON.parse(fs.readFileSync(path.join(library, 'books', pep + text + '.json'))).wordIds))],
}));
books.push(
  { id: 'offline-cet4', name: '大学四级', source: '全国大学英语四、六级考试大纲（2016年修订版）四级词目，含派生词和拼写变体', wordIds: [...cet4] },
  { id: 'offline-cet6', name: '大学六级', source: '全国大学英语四、六级考试大纲（2016年修订版）四、六级全部词目，含派生词和拼写变体', wordIds: [...cet6] },
);
const wordIds = [...new Set(books.flatMap(book => book.wordIds))];
const selected = Object.fromEntries(wordIds.map(id => {
  const entry = dictionary[id];
  if (!entry?.c || !entry?.e || !entry?.cn || !entry?.p && !entry?.us && !entry?.uk) throw new Error(`Incomplete offline word: ${id}`);
  return [id, entry];
}));
const payload = JSON.stringify({ version: 1, defaultBook: 'offline-cet4', books, dictionary: selected });
// AAPT transparently renames .gz assets; .bin preserves the compressed bytes/path.
const output = path.join(root, 'public/offline/vocabulary.bin');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, zlib.gzipSync(payload, { level: 9 }));
console.log(JSON.stringify({ books: books.map(book => ({ name: book.name, count: book.wordIds.length })), uniqueWords: wordIds.length, textBytes: Buffer.byteLength(payload), compressedBytes: fs.statSync(output).size }, null, 2));
