import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

export interface DictionaryEntry {
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  enrichedAt?: number;
}

let cachedDict: Map<string, DictionaryEntry> | null = null;
let cachedMtime = 0;

function dictPath(): string {
  return process.env.WORD_DICTIONARY_PATH || path.join(process.cwd(), "data", "word-dictionary.json");
}

export function setDictionaryCache(map: Map<string, DictionaryEntry>): void {
  cachedDict = map;
  cachedMtime = Date.now();
}

export function loadWordDictionary(): Map<string, DictionaryEntry> {
  const filePath = dictPath();
  if (!existsSync(filePath)) {
    cachedDict = new Map();
    return cachedDict;
  }

  try {
    const stat = statSync(filePath);
    if (cachedDict && stat.mtimeMs === cachedMtime) return cachedDict;

    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const words = raw.words || raw;
    cachedDict = new Map(
      Object.entries(words).map(([key, entry]) => [key.toLowerCase(), entry as DictionaryEntry])
    );
    cachedMtime = stat.mtimeMs;
    return cachedDict;
  } catch {
    cachedDict = new Map();
    return cachedDict;
  }
}

export function isDictionaryEntryComplete(entry: DictionaryEntry | undefined): boolean {
  if (!entry) return false;
  const hasPhonetic = !!(entry.phonetic || entry.phoneticUk || entry.phoneticUs);
  return !!(hasPhonetic && entry.chinese && entry.exampleSentence);
}

export function lookupWord(word: string): DictionaryEntry | undefined {
  return loadWordDictionary().get(word.toLowerCase().trim());
}

export function mergeWordWithDictionary(word: {
  id?: string;
  word: string;
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese?: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
}): {
  id: string;
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  enriched: boolean;
} {
  const key = word.word.toLowerCase().trim();
  const dict = lookupWord(key);
  const merged = {
    id: key,
    word: word.word,
    phonetic: word.phonetic || word.phoneticUs || word.phoneticUk || dict?.phonetic || dict?.phoneticUs || dict?.phoneticUk || "",
    phoneticUk: word.phoneticUk || dict?.phoneticUk || "",
    phoneticUs: word.phoneticUs || dict?.phoneticUs || "",
    chinese: word.chinese || dict?.chinese || "",
    exampleSentence: word.exampleSentence || dict?.exampleSentence || "",
    exampleSentenceCn: word.exampleSentenceCn || dict?.exampleSentenceCn || ""
  };
  return { ...merged, enriched: isDictionaryEntryComplete(dict) || isDictionaryEntryComplete(merged as DictionaryEntry) };
}

export function getDictionaryStats() {
  const dict = loadWordDictionary();
  let enriched = 0;
  dict.forEach((entry) => {
    if (isDictionaryEntryComplete(entry)) enriched++;
  });
  return { total: dict.size, enriched, available: dict.size > 0 };
}
