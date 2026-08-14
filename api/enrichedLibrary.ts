import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { gunzipSync } from "zlib";
import {
  DictionaryEntry,
  isDictionaryEntryComplete,
  loadWordDictionary,
  lookupWord,
  mergeWordWithDictionary,
  setDictionaryCache
} from "./wordDictionary";

export { mergeWordWithDictionary, isDictionaryEntryComplete, lookupWord, getDictionaryStats } from "./wordDictionary";

const LOCAL_ROOT =
  process.env.WORD_LIBRARY_LOCAL_PATH || path.join(process.cwd(), "data", "english-word-enriched");
const REMOTE_REPO = process.env.WORD_LIBRARY_REPO || "yuzhounh/english-word-enriched";
const REMOTE_BRANCH = process.env.WORD_LIBRARY_BRANCH || "main";
const FORMAT = process.env.WORD_LIBRARY_FORMAT || "auto";

let cachedTree: any = null;
let cachedTreeAt = 0;
const bookCache = new Map<string, any[]>();
let cachedEnrichedDict: Map<string, DictionaryEntry> | null = null;
let enrichedDictPromise: Promise<Map<string, DictionaryEntry>> | null = null;

function isEnrichedLocal(): boolean {
  return existsSync(path.join(LOCAL_ROOT, "tree.json"));
}

export function libraryFormat(): "enriched" | "xlsx" {
  if (FORMAT === "enriched") return "enriched";
  if (FORMAT === "xlsx") return "xlsx";
  if (isEnrichedLocal()) return "enriched";
  if (REMOTE_REPO.toLowerCase().includes("enriched")) return "enriched";
  return "xlsx";
}

function readLocalJson(rel: string): any {
  const p = path.join(LOCAL_ROOT, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function fetchRemoteJson(rel: string): Promise<any> {
  const url = `https://raw.githubusercontent.com/${REMOTE_REPO}/${REMOTE_BRANCH}/${rel.split("/").map(encodeURIComponent).join("/")}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "WordMaster-App" },
    signal: AbortSignal.timeout(30000)
  });
  if (!resp.ok) throw new Error(`Fetch ${rel} failed (${resp.status})`);
  return resp.json();
}

async function loadJson(rel: string): Promise<any> {
  if (isEnrichedLocal()) {
    const local = readLocalJson(rel);
    if (local) return local;
  }
  return fetchRemoteJson(rel);
}

/** Expand slim dictionary entry to full WordItem fields */
function expandSlim(key: string, slim: any): DictionaryEntry {
  if (!slim) return lookupWord(key) || { word: key, phonetic: "", chinese: "", exampleSentence: "", exampleSentenceCn: "" };
  if (slim.word || slim.chinese) return slim as DictionaryEntry;
  return {
    word: slim.w || key,
    phonetic: slim.p || slim.us || slim.uk || "",
    phoneticUk: slim.uk || "",
    phoneticUs: slim.us || slim.p || "",
    chinese: slim.c || "",
    exampleSentence: slim.e || "",
    exampleSentenceCn: slim.cn || ""
  };
}

async function fetchRemoteGzDict(): Promise<Map<string, DictionaryEntry>> {
  const url = `https://raw.githubusercontent.com/${REMOTE_REPO}/${REMOTE_BRANCH}/dictionary.json.gz`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "WordMaster-App" },
    signal: AbortSignal.timeout(120000)
  });
  if (!resp.ok) throw new Error(`Fetch dictionary.json.gz failed (${resp.status})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const slim = JSON.parse(gunzipSync(buf).toString("utf8"));
  return new Map(
    Object.entries(slim).map(([k, v]) => [k.toLowerCase(), expandSlim(k, v)])
  );
}

function loadLocalEnrichedDictionary(): Map<string, DictionaryEntry> {
  const gzPath = path.join(LOCAL_ROOT, "dictionary.json.gz");
  const jsonPath = path.join(LOCAL_ROOT, "dictionary.json");

  if (existsSync(gzPath)) {
    const raw = gunzipSync(readFileSync(gzPath)).toString("utf8");
    const slim = JSON.parse(raw);
    return new Map(
      Object.entries(slim).map(([k, v]) => [k.toLowerCase(), expandSlim(k, v)])
    );
  }
  if (existsSync(jsonPath)) {
    const slim = JSON.parse(readFileSync(jsonPath, "utf8"));
    return new Map(
      Object.entries(slim).map(([k, v]) => [k.toLowerCase(), expandSlim(k, v)])
    );
  }
  return new Map();
}

/** Load enriched dictionary (local, remote gzip, or fallback word-dictionary.json) */
export async function ensureEnrichedDictionary(): Promise<Map<string, DictionaryEntry>> {
  if (cachedEnrichedDict && cachedEnrichedDict.size > 0) return cachedEnrichedDict;
  if (enrichedDictPromise) return enrichedDictPromise;

  enrichedDictPromise = (async () => {
    const local = loadLocalEnrichedDictionary();
    if (local.size > 0) {
      cachedEnrichedDict = local;
      setDictionaryCache(local);
      return local;
    }
    if (libraryFormat() === "enriched" || REMOTE_REPO.toLowerCase().includes("enriched")) {
      try {
        const remote = await fetchRemoteGzDict();
        if (remote.size > 0) {
          cachedEnrichedDict = remote;
          setDictionaryCache(remote);
          return remote;
        }
      } catch (e) {
        console.warn("Remote enriched dictionary fetch failed:", e);
      }
    }
    const fallback = loadWordDictionary();
    cachedEnrichedDict = fallback;
    return fallback;
  })();

  return enrichedDictPromise;
}

/** Sync load — local enriched files only (legacy) */
export function loadEnrichedDictionary(): Map<string, DictionaryEntry> {
  if (cachedEnrichedDict && cachedEnrichedDict.size > 0) return cachedEnrichedDict;
  const local = loadLocalEnrichedDictionary();
  if (local.size > 0) return local;
  return loadWordDictionary();
}

export async function getEnrichedLibraryTree(): Promise<any[]> {
  const now = Date.now();
  if (cachedTree && now - cachedTreeAt < 3600000) return cachedTree;

  const data = await loadJson("tree.json");
  cachedTree = data.tree || data;
  cachedTreeAt = now;
  return cachedTree;
}

export async function getEnrichedBookWords(bookPath: string): Promise<any[]> {
  if (bookCache.has(bookPath)) return bookCache.get(bookPath)!;

  const dict = await ensureEnrichedDictionary();
  const rel = `books/${bookPath}.json`;
  const manifest = isEnrichedLocal() ? readLocalJson(rel) : await fetchRemoteJson(rel);

  const wordIds: string[] = manifest.wordIds || [];
  const words = wordIds.map((id) => {
    const key = id.toLowerCase();
    const entry = dict.get(key) || lookupWord(key);
    const merged = mergeWordWithDictionary({
      word: entry?.word || id,
      phonetic: entry?.phonetic,
      phoneticUk: entry?.phoneticUk,
      phoneticUs: entry?.phoneticUs,
      chinese: entry?.chinese,
      exampleSentence: entry?.exampleSentence,
      exampleSentenceCn: entry?.exampleSentenceCn
    });
    const { enriched, ...rest } = merged;
    return rest;
  });

  bookCache.set(bookPath, words);
  return words;
}

export async function getEnrichedMeta(): Promise<any> {
  return loadJson("meta.json");
}
