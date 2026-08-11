import express from "express";
import path from "path";
import { existsSync } from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

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

// Helper to get Gemini Client lazily
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment.");
  }
  return new GoogleGenAI({ apiKey });
}

export function createApp(options: { production?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // API: Analyze English text, perform lemmatization (restore base form), extract vocabulary, generate Chinese definition, example sentence, and 4 multiple-choice options.
  app.post("/api/analyze-text", async (req, res) => {
    try {
      const { text, maxWords = 50 } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Please provide valid text content." });
      }

      const ai = getGeminiClient();

      const limitNum = typeof maxWords === "number" ? Math.min(Math.max(maxWords, 10), 100) : 50;

      const prompt = `You are an expert English linguist and language learning assistant.
Analyze the following English text.
1. Extract distinct, meaningful English vocabulary words from the text (skip basic common stop words like a, an, the, is, are, was, were, to, of, in, and, I, you, he, she, it, this, that, etc.).
2. VERY IMPORTANT: Convert every extracted word into its lemmatized base dictionary form (原型/词干). For example:
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
   - "phonetic": accurate IPA phonetic transcription (e.g. "/rɪˈzɪliənt/")
   - "chinese": concise, accurate Chinese definition (e.g. "adj. 适应力强的，有韧性的")
   - "exampleSentence": an elegant, clear English sentence using this base word
   - "exampleSentenceCn": natural Chinese translation of the example sentence
   - "options": an array of 4 Chinese translation options for a quiz test. 1 option MUST be the exact correct Chinese definition of this word, and 3 options MUST be plausible but incorrect Chinese definitions (distractors of similar word type or theme). Shuffle the 4 options so the correct answer is not always in the same position!

Here is the input text:
"""
${text.slice(0, 30000)}
"""`;

      // Attempt generation with retry / fallback models in case of high demand 503
      let responseText = "";
      const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash"];
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  totalWordsCount: { type: Type.INTEGER, description: "Estimated total words in input text" },
                  extractedWordsCount: { type: Type.INTEGER, description: "Number of unique base words extracted" },
                  words: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        phonetic: { type: Type.STRING },
                        chinese: { type: Type.STRING },
                        exampleSentence: { type: Type.STRING },
                        exampleSentenceCn: { type: Type.STRING },
                        options: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        }
                      },
                      required: ["word", "phonetic", "chinese", "exampleSentence", "exampleSentenceCn", "options"]
                    }
                  }
                },
                required: ["extractedWordsCount", "words"]
              }
            }
          });
          responseText = response.text || "{}";
          break; // Success!
        } catch (err: any) {
          console.warn(`Model ${modelName} failed or busy:`, err.message);
          lastErr = err;
          // Wait 500ms before trying fallback model
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (!responseText) {
        throw lastErr || new Error("All AI models are currently busy. Please try again in a moment.");
      }

      const resultJson = JSON.parse(responseText);

      // Clean up data and assign unique IDs
      const cleanedWords = (resultJson.words || []).map((item: any) => {
        const baseWord = item.word ? item.word.toLowerCase().trim() : "";
        // Ensure options array has 4 items
        let options = Array.isArray(item.options) ? item.options : [];
        if (!options.includes(item.chinese)) {
          options.unshift(item.chinese);
        }
        // Ensure unique options up to 4
        options = Array.from(new Set(options));
        while (options.length < 4) {
          options.push(`其他释义 ${options.length + 1}`);
        }
        // Shuffle options
        options = options.sort(() => Math.random() - 0.5);

        return {
          id: baseWord,
          word: baseWord,
          phonetic: item.phonetic || "",
          chinese: item.chinese || "",
          exampleSentence: item.exampleSentence || "",
          exampleSentenceCn: item.exampleSentenceCn || "",
          options: options.slice(0, 4)
        };
      }).filter((w: any) => w.word.length > 0);

      return res.json({
        success: true,
        totalWordsCount: resultJson.totalWordsCount || text.trim().split(/\s+/).length,
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

  // API: Batch enrich words with phonetics, part-of-speech Chinese definitions, example sentences & quiz options
  app.post("/api/enrich-words", async (req, res) => {
    try {
      const { words } = req.body;
      if (!Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ success: false, error: "Please provide a valid list of words to enrich." });
      }

      const ai = getGeminiClient();

      // Chunk words into batches of 40 to avoid token limits or slow responses
      const CHUNK_SIZE = 40;
      const wordChunks: any[][] = [];
      for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        wordChunks.push(words.slice(i, i + CHUNK_SIZE));
      }

      const enrichedResults: any[] = [];

      for (const chunk of wordChunks) {
        const prompt = `You are an expert English language learning assistant and dictionary compiler.
You are provided with a list of English words. Some words may already have an existing Chinese translation provided.
For EACH word in the list, generate complete vocabulary details:

1. "word": the English word in lowercase
2. "phonetic": accurate IPA phonetic transcription (e.g. "/ɪksˈtʃeɪndʒ/")
3. "chinese": accurate, concise Chinese definition including part-of-speech tags (e.g., "n. 交换；交流 vt. 交换；交流；兑换"). If an existing Chinese definition was provided in input, preserve and refine it to ensure proper part-of-speech tags.
4. "exampleSentence": an elegant, clear, natural English sentence demonstrating the word in context.
5. "exampleSentenceCn": natural Chinese translation of the example sentence.
6. "options": an array of 4 Chinese translation options for quiz testing. 1 option MUST be the exact correct Chinese definition of this word, and 3 options MUST be plausible but incorrect Chinese definitions (distractors).

Input words:
${JSON.stringify(chunk, null, 2)}`;

        let responseText = "";
        const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash"];

        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    words: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          phonetic: { type: Type.STRING },
                          chinese: { type: Type.STRING },
                          exampleSentence: { type: Type.STRING },
                          exampleSentenceCn: { type: Type.STRING },
                          options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                          }
                        },
                        required: ["word", "phonetic", "chinese", "exampleSentence", "exampleSentenceCn", "options"]
                      }
                    }
                  },
                  required: ["words"]
                }
              }
            });
            responseText = response.text || "{}";
            break;
          } catch (err: any) {
            console.warn(`Enrich model ${modelName} error:`, err.message);
            await new Promise((r) => setTimeout(r, 400));
          }
        }

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed.words)) {
              parsed.words.forEach((item: any) => {
                const baseWord = item.word ? item.word.toLowerCase().trim() : "";
                let options = Array.isArray(item.options) ? item.options : [];
                if (!options.includes(item.chinese)) options.unshift(item.chinese);
                options = Array.from(new Set(options));
                while (options.length < 4) options.push(`其他释义 ${options.length + 1}`);

                enrichedResults.push({
                  id: baseWord,
                  word: baseWord,
                  phonetic: item.phonetic || "",
                  chinese: item.chinese || "",
                  exampleSentence: item.exampleSentence || "",
                  exampleSentenceCn: item.exampleSentenceCn || "",
                  options: options.slice(0, 4)
                });
              });
            }
          } catch (e) {
            console.error("JSON parse error for enriched chunk:", e);
          }
        }
      }

      // Merge with any words that failed enrichment
      const enrichedMap = new Map(enrichedResults.map((item) => [item.word.toLowerCase(), item]));
      const finalWords = words.map((w: any) => {
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
        words: finalWords
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
      // Cache tree for 1 hour
      if (cachedLibraryTree && now - lastLibraryTreeFetch < 3600000) {
        return res.json({ success: true, tree: cachedLibraryTree });
      }

      const response = await fetch("https://api.github.com/repos/lilinji/English/git/trees/main?recursive=1", {
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
          // Subcategory folder (e.g. 1.全国各大教材版本中小学同步/人教版/人教版一年级...xlsx)
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

      return res.json({ success: true, tree: sortedTree });
    } catch (err: any) {
      console.error("Error fetching word library tree:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to load word library tree." });
    }
  });

  app.get("/api/wordlibrary/book", async (req, res) => {
    try {
      const bookPath = req.query.path as string;
      if (!bookPath) {
        return res.status(400).json({ success: false, error: "Missing book path." });
      }

      if (libraryBookCache.has(bookPath)) {
        return res.json({ success: true, words: libraryBookCache.get(bookPath) });
      }

      // Download raw xlsx file from GitHub
      const encodedPath = bookPath.split('/').map(encodeURIComponent).join('/');
      const url = `https://raw.githubusercontent.com/lilinji/English/main/${encodedPath}`;

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
        const word = (row["单词"] || row["word"] || row["Word"] || "").toString().trim();
        const phoneticUk = (row["英音"] || row["phonetic_uk"] || "").toString().trim();
        const phoneticUs = (row["美音"] || row["phonetic_us"] || "").toString().trim();
        const chinese = (row["释义"] || row["翻译"] || row["chinese"] || row["meaning"] || "").toString().trim();
        const example = (row["例句"] || row["example"] || "").toString().trim();
        const exampleCn = (row["例句翻译"] || row["example_cn"] || "").toString().trim();

        const basePhonetic = phoneticUs || phoneticUk || "";

        return {
          id: word.toLowerCase(),
          word,
          phonetic: basePhonetic,
          phoneticUk,
          phoneticUs,
          chinese,
          exampleSentence: example,
          exampleSentenceCn: exampleCn
        };
      }).filter((w) => w.word.length > 0);

      libraryBookCache.set(bookPath, words);

      return res.json({ success: true, words });
    } catch (err: any) {
      console.error("Error fetching wordbook:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to load wordbook content." });
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
