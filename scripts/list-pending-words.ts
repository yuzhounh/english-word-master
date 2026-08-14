import * as fs from "fs";

const raw = JSON.parse(fs.readFileSync("data/word-dictionary.json", "utf8"));
const dict = raw.words || {};

function needs(e: any): boolean {
  const hasPhonetic = !!(e.phonetic || e.phoneticUk || e.phoneticUs);
  return !(hasPhonetic && e.chinese && e.exampleSentence);
}

const pending = Object.entries(dict)
  .filter(([, e]) => needs(e))
  .map(([k, e]: [string, any]) => ({ key: k, word: e.word, chinese: e.chinese?.slice(0, 40) }));

console.log(`Pending: ${pending.length}`);
pending.forEach((p) => console.log(`  ${p.word} | ${p.chinese || "(no chinese)"}`));
