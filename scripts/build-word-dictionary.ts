/**
 * Enrich unique library words via DeepSeek API with checkpoint/resume.
 * Reads data/library-word-index.json, writes data/word-dictionary.json
 *
 * Usage:
 *   npx tsx scripts/build-word-dictionary.ts
 *   npx tsx scripts/build-word-dictionary.ts --resume
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const INDEX_FILE = path.join(process.cwd(), "data", "library-word-index.json");
const DICT_FILE = path.join(process.cwd(), "data", "word-dictionary.json");
const CHECKPOINT_FILE = path.join(process.cwd(), "data", "build-checkpoint.json");
const CHUNK_SIZE = 20;
const CONCURRENCY = 3;
const CHUNK_TIMEOUT_MS = 90000;
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

interface DictEntry {
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  enrichedAt?: number;
}

function needsEnrichment(entry: DictEntry): boolean {
  const hasPhonetic = !!(entry.phonetic || entry.phoneticUk || entry.phoneticUs);
  return !(hasPhonetic && entry.chinese && entry.exampleSentence);
}

function buildPrompt(chunk: { word: string; chinese: string }[]): string {
  return `For EACH word, output JSON with: word, phonetic (IPA), chinese (with POS), exampleSentence (max 12 words), exampleSentenceCn.
{"words":[{"word":"...","phonetic":"...","chinese":"...","exampleSentence":"...","exampleSentenceCn":"..."}]}
Input: ${JSON.stringify(chunk)}`;
}

async function enrichChunk(chunk: { word: string; chinese: string }[]): Promise<DictEntry[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Output strictly valid JSON only." },
        { role: "user", content: buildPrompt(chunk) }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS)
  });

  if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
  const data: any = await response.json();
  let text = data?.choices?.[0]?.message?.content ?? "";
  text = text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1").trim();
  const parsed = JSON.parse(text);
  const now = Date.now();
  return (parsed.words || []).map((item: any) => ({
    word: item.word,
    phonetic: item.phonetic || "",
    chinese: item.chinese || "",
    exampleSentence: item.exampleSentence || "",
    exampleSentenceCn: item.exampleSentenceCn || "",
    enrichedAt: now
  }));
}

function saveDict(dict: Record<string, DictEntry>, meta: Record<string, unknown>) {
  fs.writeFileSync(
    DICT_FILE,
    JSON.stringify({ ...meta, words: dict }, null, 0)
  );
}

async function main() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error("Run collect-library-words.ts first.");
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY missing in .env");
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
  const sourceWords: Record<string, DictEntry> = index.words || {};

  let dict: Record<string, DictEntry> = {};
  if (fs.existsSync(DICT_FILE)) {
    dict = JSON.parse(fs.readFileSync(DICT_FILE, "utf8")).words || {};
  }

  // Seed dict from index (preserve existing xlsx data)
  for (const [key, entry] of Object.entries(sourceWords) as [string, DictEntry][]) {
    if (!dict[key]) {
      const phonetic = (entry as any).phoneticUs || (entry as any).phoneticUk || "";
      dict[key] = {
        word: entry.word,
        phonetic,
        phoneticUk: (entry as any).phoneticUk,
        phoneticUs: (entry as any).phoneticUs,
        chinese: entry.chinese || "",
        exampleSentence: entry.exampleSentence || "",
        exampleSentenceCn: entry.exampleSentenceCn || ""
      };
    }
  }

  const pending = Object.keys(dict).filter((k) => needsEnrichment(dict[k]));
  console.log(`Total: ${Object.keys(dict).length}, pending enrichment: ${pending.length}`);

  let processed = 0;
  const startTime = Date.now();

  for (let i = 0; i < pending.length; i += CHUNK_SIZE * CONCURRENCY) {
    const batchKeys = pending.slice(i, i + CHUNK_SIZE * CONCURRENCY);
    const chunks: string[][] = [];
    for (let j = 0; j < batchKeys.length; j += CHUNK_SIZE) {
      chunks.push(batchKeys.slice(j, j + CHUNK_SIZE));
    }

    const results = await Promise.all(
      chunks.map(async (keys) => {
        const input = keys.map((k) => ({ word: dict[k].word, chinese: dict[k].chinese }));
        try {
          return await enrichChunk(input);
        } catch (e: any) {
          console.warn("Chunk failed:", e.message);
          return [];
        }
      })
    );

    for (const items of results) {
      for (const item of items) {
        const key = item.word.toLowerCase().trim();
        if (!key) continue;
        dict[key] = {
          ...dict[key],
          ...item,
          phoneticUk: dict[key]?.phoneticUk || item.phonetic,
          phoneticUs: dict[key]?.phoneticUs || item.phonetic,
          enrichedAt: Date.now()
        };
      }
    }

    processed += batchKeys.length;
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const done = Object.values(dict).filter((w) => !needsEnrichment(w)).length;
    console.log(`Progress: ${processed}/${pending.length} batch processed, ${done}/${Object.keys(dict).length} complete (${elapsed} min)`);

    saveDict(dict, {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceRepo: index.sourceRepo,
      uniqueWords: Object.keys(dict).length,
      enrichedWords: done
    });
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: i + batchKeys.length, updatedAt: Date.now() }));
  }

  console.log(`\nDone. Dictionary saved to ${DICT_FILE}`);
}

main().catch(console.error);
