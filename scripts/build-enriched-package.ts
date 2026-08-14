/**
 * Build english-word-enriched package (Scheme A: dictionary + tree + book manifests).
 *
 * Usage: npx tsx scripts/build-enriched-package.ts
 * Output: data/english-word-enriched/
 */
import * as fs from "fs";
import * as path from "path";
import { gzipSync } from "zlib";
import dotenv from "dotenv";

dotenv.config();

const DICT_FILE = path.join(process.cwd(), "data", "word-dictionary.json");
const BOOK_INDEX = path.join(process.cwd(), "data", "book-index.json");
const OUT_ROOT = path.join(process.cwd(), "data", "english-word-enriched");
const SOURCE_REPO = process.env.WORD_LIBRARY_REPO || "lilinji/English";

interface LibraryNode {
  name: string;
  path: string;
  type: "folder" | "book";
  size?: number;
  bookCount?: number;
  children?: LibraryNode[];
}

function bookPathToJsonRel(bookPath: string): string {
  return `books/${bookPath}.json`;
}

function buildTreeFromBooks(books: Record<string, { name: string; path: string; wordIds: string[] }>): LibraryNode[] {
  const rootFolders = new Map<string, LibraryNode>();

  for (const book of Object.values(books)) {
    const parts = book.path.split("/");
    if (parts.length < 2) continue;

    const top = parts[0];
    if (!rootFolders.has(top)) {
      rootFolders.set(top, {
        name: top,
        path: top,
        type: "folder",
        bookCount: 0,
        children: []
      });
    }
    const category = rootFolders.get(top)!;
    category.bookCount!++;

    const bookNode: LibraryNode = {
      name: book.name,
      path: book.path,
      type: "book",
      size: book.wordIds.length
    };

    if (parts.length === 3) {
      const subName = parts[1];
      let sub = category.children!.find((c) => c.name === subName);
      if (!sub) {
        sub = { name: subName, path: `${top}/${subName}`, type: "folder", bookCount: 0, children: [] };
        category.children!.push(sub);
      }
      sub.bookCount!++;
      sub.children!.push(bookNode);
    } else {
      category.children!.push(bookNode);
    }
  }

  return Array.from(rootFolders.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function slimDictionaryEntry(entry: any) {
  return {
    w: entry.word,
    p: entry.phonetic || entry.phoneticUs || entry.phoneticUk || "",
    uk: entry.phoneticUk || "",
    us: entry.phoneticUs || "",
    c: entry.chinese || "",
    e: entry.exampleSentence || "",
    cn: entry.exampleSentenceCn || ""
  };
}

async function main() {
  if (!fs.existsSync(DICT_FILE)) {
    console.error("Missing word-dictionary.json — run build-word-dictionary.ts first.");
    process.exit(1);
  }
  if (!fs.existsSync(BOOK_INDEX)) {
    console.error("Missing book-index.json — run build-book-index.ts first.");
    process.exit(1);
  }

  const dictRaw = JSON.parse(fs.readFileSync(DICT_FILE, "utf8"));
  const dict: Record<string, any> = dictRaw.words || {};
  const bookIndexRaw = JSON.parse(fs.readFileSync(BOOK_INDEX, "utf8"));
  const books: Record<string, { name: string; path: string; sourceXlsx?: string; wordIds: string[] }> =
    bookIndexRaw.books || {};

  let enriched = 0;
  const slimDict: Record<string, ReturnType<typeof slimDictionaryEntry>> = {};
  for (const [key, entry] of Object.entries(dict)) {
    const hasAll = entry.phonetic && entry.chinese && entry.exampleSentence;
    if (hasAll) enriched++;
    slimDict[key] = slimDictionaryEntry(entry);
  }

  fs.mkdirSync(path.join(OUT_ROOT, "books"), { recursive: true });

  // Write per-book manifests
  let bookFiles = 0;
  for (const book of Object.values(books)) {
    const rel = bookPathToJsonRel(book.path);
    const outPath = path.join(OUT_ROOT, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify({
        name: book.name,
        path: book.path,
        sourceXlsx: book.sourceXlsx,
        wordCount: book.wordIds.length,
        wordIds: book.wordIds
      })
    );
    bookFiles++;
  }

  const tree = buildTreeFromBooks(books);

  const dictJson = JSON.stringify(slimDict);
  fs.writeFileSync(path.join(OUT_ROOT, "dictionary.json"), dictJson);
  fs.writeFileSync(path.join(OUT_ROOT, "dictionary.json.gz"), gzipSync(dictJson));

  const meta = {
    name: "english-word-enriched",
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRepo: SOURCE_REPO,
    description: "Pre-enriched English word library for WordMaster (dictionary + book manifests)",
    format: "wordmaster-enriched-v1",
    stats: {
      uniqueWords: Object.keys(dict).length,
      enrichedWords: enriched,
      bookCount: bookFiles,
      dictionaryBytes: dictJson.length,
      dictionaryGzipBytes: gzipSync(dictJson).length
    }
  };

  fs.writeFileSync(path.join(OUT_ROOT, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(OUT_ROOT, "tree.json"), JSON.stringify({ success: true, tree }, null, 2));

  console.log("\n=== english-word-enriched package built ===");
  console.log(`Output:     ${OUT_ROOT}`);
  console.log(`Dictionary: ${Object.keys(dict).length} words (${enriched} enriched)`);
  console.log(`Books:      ${bookFiles}`);
  console.log(`Dict size:  ${(dictJson.length / 1024 / 1024).toFixed(2)} MB → gzip ${(gzipSync(dictJson).length / 1024 / 1024).toFixed(2)} MB`);
  console.log("\nPush data/english-word-enriched/ to GitHub repo: english-word-enriched");
}

main().catch(console.error);
