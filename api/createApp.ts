import express from "express";
import path from "path";
import { existsSync, statSync } from "fs";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import {
  getDictionaryStats,
  mergeWordWithDictionary,
  isDictionaryEntryComplete,
  loadWordDictionary
} from "./wordDictionary";
import {
  libraryFormat,
  getEnrichedLibraryTree,
  getEnrichedBookWords,
  getEnrichedMeta,
  ensureEnrichedDictionary
} from "./enrichedLibrary";

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const WORD_LIBRARY_REPO = process.env.WORD_LIBRARY_REPO || "yuzhounh/english-word-enriched";
const WORD_LIBRARY_BRANCH = process.env.WORD_LIBRARY_BRANCH || "main";

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "WordMaster-App",
    "Accept": "application/vnd.github+json"
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

// ---- DeepSeek API client (OpenAI-compatible chat completions) ----
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Calls DeepSeek chat completions in JSON mode and returns the raw JSON text.
async function deepseekChatJson(
  messages: DeepSeekMessage[],
  temperature = 0.7,
  timeoutMs = 55000
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured in environment.");
  }
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      response_format: { type: "json_object" },
      stream: false
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data: any = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("DeepSeek API returned an empty response.");
  }
  return content;
}

// Parses a DeepSeek JSON response, tolerating markdown code fences.
function parseDeepSeekJson(text: string): any {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

// ---- Resumable processing helpers ----
// Vercel serverless functions cap execution time (Hobby: 60s). To process
// arbitrarily large tasks we stop starting new AI calls once ~40s have elapsed,
// return partial results + a resume token, and let the client continue with
// the next function invocation until everything is done.
const FUNCTION_HARD_LIMIT_MS = 55000;
const NEW_CALL_CUTOFF_MS = 40000;

function timeBudgetRemaining(elapsedMs: number): number {
  // Leave enough headroom to write the response before the hard limit.
  return Math.max(12000, FUNCTION_HARD_LIMIT_MS - elapsedMs - 5000);
}

function encodeResume(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeResume<T>(token: any): T | null {
  if (typeof token !== "string" || !token) return null;
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

// Splits a long text into reasonably sized segments at sentence boundaries.
function splitTextSegments(text: string, maxChars = 1500): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];
  const sentences = trimmed.match(/[^.!?πÇé∩╝ü∩╝ƒ]+[.!?πÇé∩╝ü∩╝ƒ]*\s*/g) || [trimmed];
  const segments: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length > 0 && (current + sentence).length > maxChars) {
      segments.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments.length > 0 ? segments : [trimmed];
}

function buildAnalyzePrompt(text: string, limitNum: number): string {
  return `You are an expert English linguist and language learning assistant.
Analyze the following English text.
1. Extract distinct, meaningful English vocabulary words from the text (skip basic common stop words like a, an, the, is, are, was, were, to, of, in, and, I, you, he, she, it, this, that, etc.).
2. VERY IMPORTANT: Convert every extracted word into its lemmatized base dictionary form (σÄƒσ₧ï/Φ»ìσ╣▓). For example:
   - "running", "ran" -> "run"
   - "studies", "studied" -> "study"
   - "better", "best" -> "good"
   - "children" -> "child"
   - "analyses" -> "analysis"
   - "complained" -> "complain"
3. Deduplicate the base words so each unique base word appears only once.
4. Extract as many distinct vocabulary words as possible up to ${limitNum} items (aim to extract around ${limitNum} words if the text contains enough vocabulary).
5. For each extracted base word, provide:
   - "word": base form in lowercase (e.g. "abandon", "resilient")
   - "phonetic": accurate IPA phonetic transcription (e.g. "/r╔¬╦êz╔¬li╔Önt/")
   - "chinese": concise, accurate Chinese definition (e.g. "adj. ΘÇéσ║öσè¢σ╝║τÜä∩╝îµ£ëΘƒºµÇºτÜä")
   - "exampleSentence": a SHORT, concise English sentence (no longer than 12 words) using this base word
   - "exampleSentenceCn": natural Chinese translation of the example sentence
   - "options": an array of exactly 4 Chinese translation options for a quiz test. 1 option MUST be the exact correct Chinese definition of this word, and 3 options MUST be plausible but incorrect Chinese definitions (distractors of similar word type or theme). Shuffle the 4 options so the correct answer is not always in the same position!

You MUST respond with a single JSON object matching exactly this shape (and nothing else):
{
  "totalWordsCount": <number, estimated total words in input text>,
  "extractedWordsCount": <number, number of unique base words extracted>,
  "words": [
    {
      "word": "...",
      "phonetic": "...",
      "chinese": "...",
      "exampleSentence": "...",
      "exampleSentenceCn": "...",
      "options": ["...", "...", "...", "..."]
    }
  ]
}

Here is the input text:
"""
${text.slice(0, 30000)}
"""`;
}

function parseEnrichIntEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function needsEnrichment(w: any): boolean {
  const hasPhonetic = !!(w.phonetic && String(w.phonetic).trim());
  const hasExample = !!(w.exampleSentence && String(w.exampleSentence).trim());
  const hasChinese = !!(w.chinese && String(w.chinese).trim());
  return !(hasPhonetic && hasExample && hasChinese);
}

function buildEnrichPrompt(chunk: any[], includeOptions: boolean): string {
  const optionsInstruction = includeOptions
    ? `6. "options": an array of exactly 4 Chinese translation options for quiz testing. 1 option MUST be the exact correct Chinese definition of this word, and 3 options MUST be plausible but incorrect Chinese definitions (distractors).`
    : "";
  const optionsSchema = includeOptions ? ',\n      "options": ["...", "...", "...", "..."]' : "";

  return `You are an expert English language learning assistant and dictionary compiler.
You are provided with a list of English words. Some words may already have an existing Chinese translation provided.
For EACH word in the list, generate complete vocabulary details:

1. "word": the English word in lowercase
2. "phonetic": accurate IPA phonetic transcription (e.g. "/╔¬ks╦êt╩âe╔¬nd╩Æ/")
3. "chinese": accurate, concise Chinese definition including part-of-speech tags (e.g., "n. Σ║ñµìó∩╝¢Σ║ñµ╡ü vt. Σ║ñµìó∩╝¢Σ║ñµ╡ü∩╝¢σàæµìó"). If an existing Chinese definition was provided in input, preserve and refine it to ensure proper part-of-speech tags.
4. "exampleSentence": a SHORT, concise, natural English sentence (no longer than 12 words) demonstrating the word in context.
5. "exampleSentenceCn": natural Chinese translation of the example sentence.
${optionsInstruction}

You MUST respond with a single JSON object matching exactly this shape (and nothing else):
{
  "words": [
    {
      "word": "...",
      "phonetic": "...",
      "chinese": "...",
      "exampleSentence": "...",
      "exampleSentenceCn": "..."${optionsSchema}
    }
  ]
}

Input words:
${JSON.stringify(chunk, null, 2)}`;
}

async function enrichOneChunk(
  chunk: any[],
  includeOptions: boolean,
  timeoutMs: number
): Promise<any[]> {
  if (chunk.length === 0) return [];

  const prompt = buildEnrichPrompt(chunk, includeOptions);
  let responseText = "";
  try {
    responseText = await deepseekChatJson(
      [
        {
          role: "system",
          content:
            "You are an expert English language learning assistant and dictionary compiler. Always output strictly valid JSON matching the requested schema. Do not include any text outside the JSON object."
        },
        { role: "user", content: prompt }
      ],
      0.3,
      timeoutMs
    );
  } catch (err: any) {
    console.warn("Enrich chunk failed:", err.message);
    return [];
  }

  if (!responseText) return [];

  try {
    const parsed = parseDeepSeekJson(responseText);
    if (!Array.isArray(parsed.words)) return [];
    return parsed.words
      .filter((item: any) => item?.word)
      .map((item: any) => normalizeWordItem(item, includeOptions));
  } catch (e) {
    console.error("JSON parse error for enriched chunk:", e);
    return [];
  }
}

function normalizeWordItem(item: any, includeOptions = true): any {
  const baseWord = item.word ? item.word.toLowerCase().trim() : "";
  const base: any = {
    id: baseWord,
    word: baseWord,
    phonetic: item.phonetic || "",
    chinese: item.chinese || "",
    exampleSentence: item.exampleSentence || "",
    exampleSentenceCn: item.exampleSentenceCn || ""
  };

  if (!includeOptions) return base;

  let options = Array.isArray(item.options) ? item.options : [];
  if (!options.includes(item.chinese)) options.unshift(item.chinese);
  options = Array.from(new Set(options));
  while (options.length < 4) options.push(`σà╢Σ╗ûΘçèΣ╣ë ${options.length + 1}`);
  options = options.sort(() => Math.random() - 0.5);
  base.options = options.slice(0, 4);
  return base;
}

export function createApp(options: { production?: boolean } = {}) {
  const app = express();

  // Enable CORS for all origins (supports mobile clients & web frontends)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "10mb" }));

  // API: Analyze English text, perform lemmatization (restore base form), extract vocabulary, generate Chinese definition, example sentence, and 4 multiple-choice options.
  // Supports resumable processing: long texts are split into segments that are processed across
  // multiple function invocations before the Vercel timeout, each returning partial results.
  app.post("/api/analyze-text", async (req, res) => {
    try {
      if (!process.env.DEEPSEEK_API_KEY) {
        return res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY is not configured in environment." });
      }
      const { text, maxWords = 30, resume } = req.body;

      let segments: string[];
      let limitPerSegment: number;

      if (resume) {
        const state = decodeResume<{ segments: string[]; limitPerSegment: number }>(resume);
        if (!state || !Array.isArray(state.segments) || state.segments.length === 0) {
          return res.status(400).json({ success: false, error: "Invalid resume token." });
        }
        segments = state.segments;
        limitPerSegment = state.limitPerSegment;
      } else {
        if (!text || typeof text !== "string" || text.trim().length === 0) {
          return res.status(400).json({ success: false, error: "Please provide valid text content." });
        }
        const limitNum = typeof maxWords === "number" ? Math.min(Math.max(maxWords, 5), 50) : 30;
        segments = splitTextSegments(text);
        limitPerSegment = Math.max(5, Math.ceil(limitNum / Math.max(segments.length, 1)));
      }

      const startTime = Date.now();
      const cleanedWords: any[] = [];
      const seen = new Set<string>();
      let totalWordsCount = 0;
      let index = 0;

      while (index < segments.length) {
        const elapsed = Date.now() - startTime;
        if (index > 0 && elapsed >= NEW_CALL_CUTOFF_MS) break;
        const budget = timeBudgetRemaining(elapsed);
        if (budget < 12000) break;

        const prompt = buildAnalyzePrompt(segments[index], limitPerSegment);

        let responseText = "";
        try {
          responseText = await deepseekChatJson(
            [
              {
                role: "system",
                content:
                  "You are an expert English linguist and language learning assistant. Always output strictly valid JSON matching the requested schema. Do not include any text outside the JSON object."
              },
              { role: "user", content: prompt }
            ],
            0.7,
            budget
          );
        } catch (err: any) {
          console.warn(`Analyze segment ${index} failed:`, err.message);
        }

        if (responseText) {
          try {
            const resultJson = parseDeepSeekJson(responseText);
            if (typeof resultJson.totalWordsCount === "number") {
              totalWordsCount += resultJson.totalWordsCount;
            }
            (resultJson.words || []).forEach((item: any) => {
              const baseWord = item.word ? item.word.toLowerCase().trim() : "";
              if (!baseWord || seen.has(baseWord)) return;
              seen.add(baseWord);
              cleanedWords.push(normalizeWordItem(item));
            });
          } catch (e) {
            console.error("JSON parse error for analyze segment:", e);
          }
        }

        index++;
      }

      const pendingSegments = segments.slice(index);
      const done = pendingSegments.length === 0;

      return res.json({
        success: true,
        done,
        resume: done ? null : encodeResume({ segments: pendingSegments, limitPerSegment }),
        totalWordsCount: totalWordsCount || (text ? text.trim().split(/\s+/).length : 0),
        extractedWordsCount: cleanedWords.length,
        words: cleanedWords
      });

    } catch (error: any) {
      console.error("Error analyzing text:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to analyze text with AI."
      });
    }
  });

  // API: Batch enrich words with phonetics, part-of-speech Chinese definitions, example sentences & quiz options.
  // Supports resumable processing: only processes as many words as fit within the function time budget,
  // then returns partial results + the remaining words so the client can continue in the next invocation.
  // light=true skips quiz options (QuizView builds distractors locally) and uses larger parallel chunks.
  app.post("/api/enrich-words", async (req, res) => {
    try {
      if (!process.env.DEEPSEEK_API_KEY) {
        return res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY is not configured in environment." });
      }
      const { words, light: lightRequested } = req.body;
      if (!Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ success: false, error: "Please provide a valid list of words to enrich." });
      }

      const light = lightRequested === true || words.length > 20;
      const includeOptions = !light;
      const benchChunk = typeof req.body._benchChunkSize === "number" ? req.body._benchChunkSize : null;
      const benchConc = typeof req.body._benchConcurrency === "number" ? req.body._benchConcurrency : null;
      const CHUNK_SIZE = benchChunk && benchChunk > 0
        ? benchChunk
        : light
          ? parseEnrichIntEnv("ENRICH_CHUNK_SIZE_LIGHT", 35)
          : parseEnrichIntEnv("ENRICH_CHUNK_SIZE", 15);
      const CONCURRENCY = benchConc && benchConc > 0
        ? benchConc
        : parseEnrichIntEnv("ENRICH_CONCURRENCY", 3);

      const startTime = Date.now();
      const enrichedResults: any[] = [];
      let index = 0;
      let didAiWork = false;

      while (index < words.length) {
        while (index < words.length && !needsEnrichment(words[index])) {
          index += 1;
        }
        if (index >= words.length) break;

        const elapsed = Date.now() - startTime;
        if (didAiWork && elapsed >= NEW_CALL_CUTOFF_MS) break;
        const budget = timeBudgetRemaining(elapsed);
        if (budget < 12000) break;

        const batchChunks: any[][] = [];
        let scanIdx = index;
        while (batchChunks.length < CONCURRENCY && scanIdx < words.length) {
          const chunk: any[] = [];
          while (chunk.length < CHUNK_SIZE && scanIdx < words.length) {
            const w = words[scanIdx];
            scanIdx += 1;
            if (needsEnrichment(w)) chunk.push(w);
          }
          if (chunk.length > 0) batchChunks.push(chunk);
        }

        if (batchChunks.length === 0) {
          index = scanIdx;
          continue;
        }

        didAiWork = true;
        const batchResults = await Promise.all(
          batchChunks.map((chunk) => enrichOneChunk(chunk, includeOptions, budget))
        );
        batchResults.forEach((items) => enrichedResults.push(...items));
        index = scanIdx;
      }

      // Merge the processed prefix with any words that failed enrichment.
      const processedWords = words.slice(0, index);
      const pendingWords = words.slice(index);
      const done = pendingWords.length === 0;

      const enrichedMap = new Map(enrichedResults.map((item) => [item.word.toLowerCase(), item]));
      const finalWords = processedWords.map((w: any) => {
        const wName = (w.word || w.id || "").toLowerCase().trim();
        if (enrichedMap.has(wName)) {
          return enrichedMap.get(wName);
        }
        return {
          id: wName,
          word: wName,
          phonetic: w.phonetic || "",
          chinese: w.chinese || wName,
          exampleSentence: w.exampleSentence || "",
          exampleSentenceCn: w.exampleSentenceCn || ""
        };
      });

      return res.json({
        success: true,
        done,
        words: finalWords,
        pending: done ? [] : pendingWords
      });

    } catch (error: any) {
      console.error("Error enriching words:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to enrich words."
      });
    }
  });

  // Word Library (lilinji/English) Tree & Book Endpoints
  let cachedLibraryTree: any = null;
  let lastLibraryTreeFetch = 0;
  const libraryBookCache = new Map<string, any[]>();

  app.get("/api/wordlibrary/tree", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedLibraryTree && now - lastLibraryTreeFetch < 3600000) {
        return res.json({ success: true, tree: cachedLibraryTree, format: libraryFormat() });
      }

      if (libraryFormat() === "enriched") {
        const tree = await getEnrichedLibraryTree();
        cachedLibraryTree = tree;
        lastLibraryTreeFetch = now;
        const meta = await getEnrichedMeta();
        return res.json({ success: true, tree, format: "enriched", meta });
      }

      const response = await fetch(`https://api.github.com/repos/${WORD_LIBRARY_REPO}/git/trees/${WORD_LIBRARY_BRANCH}?recursive=1`, {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const data: any = await response.json();
      const items: any[] = data.tree || [];

      // Filter only .xlsx files
      const xlsxFiles = items.filter((item) => item.path && item.path.endsWith(".xlsx"));

      // Build hierarchical folder tree
      const rootFolders: Map<string, any> = new Map();

      xlsxFiles.forEach((item) => {
        const parts = item.path.split("/");
        if (parts.length < 2) return;

        const topCategoryName = parts[0];
        if (!rootFolders.has(topCategoryName)) {
          rootFolders.set(topCategoryName, {
            name: topCategoryName,
            path: topCategoryName,
            type: "folder",
            bookCount: 0,
            children: []
          });
        }

        const categoryNode = rootFolders.get(topCategoryName);
        categoryNode.bookCount++;

        if (parts.length === 3) {
          // Subcategory folder (e.g. 1.σà¿σ¢╜σÉäσñºµòÖµ¥Éτëêµ£¼Σ╕¡σ░Åσ¡ªσÉîµ¡Ñ/Σ║║µòÖτëê/Σ║║µòÖτëêΣ╕Çσ╣┤τ║º...xlsx)
          const subDirName = parts[1];
          let subDirNode = categoryNode.children.find((c: any) => c.name === subDirName);
          if (!subDirNode) {
            subDirNode = {
              name: subDirName,
              path: `${topCategoryName}/${subDirName}`,
              type: "folder",
              bookCount: 0,
              children: []
            };
            categoryNode.children.push(subDirNode);
          }
          subDirNode.bookCount++;

          const fileName = parts[2].replace(/\.xlsx$/i, "");
          subDirNode.children.push({
            name: fileName,
            path: item.path,
            type: "book",
            size: item.size || 0
          });
        } else {
          // Direct file under top category
          const fileName = parts[1].replace(/\.xlsx$/i, "");
          categoryNode.children.push({
            name: fileName,
            path: item.path,
            type: "book",
            size: item.size || 0
          });
        }
      });

      const sortedTree = Array.from(rootFolders.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

      cachedLibraryTree = sortedTree;
      lastLibraryTreeFetch = now;

      return res.json({ success: true, tree: sortedTree, format: "xlsx" });
    } catch (err: any) {
      console.error("Error fetching word library tree:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to load word library tree." });
    }
  });

  app.get("/api/wordlibrary/book", async (req, res) => {
    try {
      const bookPath = (req.query.path as string)?.replace(/\.xlsx$/i, "");
      if (!bookPath) {
        return res.status(400).json({ success: false, error: "Missing book path." });
      }

      if (libraryFormat() === "enriched") {
        const words = await getEnrichedBookWords(bookPath);
        return res.json({ success: true, words, format: "enriched" });
      }

      const xlsxPath = bookPath.endsWith(".xlsx") ? bookPath : `${bookPath}.xlsx`;
      if (libraryBookCache.has(xlsxPath)) {
        return res.json({ success: true, words: libraryBookCache.get(xlsxPath) });
      }

      // Download raw xlsx file from GitHub
      const encodedPath = xlsxPath.split('/').map(encodeURIComponent).join('/');
      const url = `https://raw.githubusercontent.com/${WORD_LIBRARY_REPO}/${WORD_LIBRARY_BRANCH}/${encodedPath}`;

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "WordMaster-App"
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!resp.ok) {
        throw new Error(`Failed to fetch book file (${resp.status})`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const words = rows.map((row) => {
        const word = (row["σìòΦ»ì"] || row["word"] || row["Word"] || "").toString().trim();
        const phoneticUk = (row["Φï▒Θƒ│"] || row["phonetic_uk"] || "").toString().trim();
        const phoneticUs = (row["τ╛ÄΘƒ│"] || row["phonetic_us"] || "").toString().trim();
        const chinese = (row["ΘçèΣ╣ë"] || row["τ┐╗Φ»æ"] || row["chinese"] || row["meaning"] || "").toString().trim();
        const example = (row["Σ╛ïσÅÑ"] || row["example"] || "").toString().trim();
        const exampleCn = (row["Σ╛ïσÅÑτ┐╗Φ»æ"] || row["example_cn"] || "").toString().trim();

        return mergeWordWithDictionary({
          word,
          phoneticUk,
          phoneticUs,
          chinese,
          exampleSentence: example,
          exampleSentenceCn: exampleCn
        });
      }).filter((w) => w.word.length > 0).map(({ enriched, ...w }) => w);

      libraryBookCache.set(xlsxPath, words);

      return res.json({ success: true, words, format: "xlsx" });
    } catch (err: any) {
      console.error("Error fetching wordbook:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to load wordbook content." });
    }
  });

  // Word dictionary lookup (pre-enriched library words)
  app.get("/api/word-dictionary/stats", async (_req, res) => {
    if (libraryFormat() === "enriched") await ensureEnrichedDictionary();
    return res.json({ success: true, ...getDictionaryStats(), format: libraryFormat() });
  });

  app.post("/api/word-dictionary/lookup", async (req, res) => {
    try {
      if (libraryFormat() === "enriched") await ensureEnrichedDictionary();
      const { words } = req.body;
      if (!Array.isArray(words)) {
        return res.status(400).json({ success: false, error: "words must be an array" });
      }
      const resolved: any[] = [];
      const missing: string[] = [];
      for (const raw of words) {
        const wordStr = typeof raw === "string" ? raw : (raw?.word || "");
        const key = wordStr.toLowerCase().trim();
        if (!key) continue;
        const merged = mergeWordWithDictionary(
          typeof raw === "string"
            ? { word: wordStr }
            : {
                word: raw.word,
                phonetic: raw.phonetic,
                phoneticUk: raw.phoneticUk,
                phoneticUs: raw.phoneticUs,
                chinese: raw.chinese,
                exampleSentence: raw.exampleSentence,
                exampleSentenceCn: raw.exampleSentenceCn
              }
        );
        const complete = isDictionaryEntryComplete(merged as any);
        resolved.push({ ...merged, enriched: complete });
        if (!complete) missing.push(key);
      }
      return res.json({ success: true, words: resolved, missing });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Production: serve built frontend from dist/ (if present) and SPA fallback
  if (options.production) {
    const distPath = path.join(process.cwd(), "dist");
    if (existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        res.sendFile(path.join(distPath, "index.html"), (err) => {
          if (err) next();
        });
      });
    }
  }

  return app;
}

export default createApp({ production: true });
