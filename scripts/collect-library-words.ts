/**
 * Collect all unique words from lilinji/English GitHub library.
 * Usage: npx tsx scripts/collect-library-words.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

const REPO = process.env.WORD_LIBRARY_REPO || "lilinji/English";
const BRANCH = process.env.WORD_LIBRARY_BRANCH || "main";
const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "library-word-index.json");
const CONCURRENCY = 8;

interface WordEntry {
  word: string;
  chinese: string;
  phoneticUk: string;
  phoneticUs: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  books: string[];
}

function parseRow(row: Record<string, unknown>) {
  const word = String(row["单词"] || row["word"] || row["Word"] || "").trim();
  if (!word || word.length < 2) return null;
  return {
    word,
    chinese: String(row["释义"] || row["翻译"] || row["chinese"] || row["meaning"] || "").trim(),
    phoneticUk: String(row["英音"] || row["phonetic_uk"] || "").trim(),
    phoneticUs: String(row["美音"] || row["phonetic_us"] || "").trim(),
    exampleSentence: String(row["例句"] || row["example"] || "").trim(),
    exampleSentenceCn: String(row["例句翻译"] || row["example_cn"] || "").trim()
  };
}

function isComplete(entry: WordEntry): boolean {
  return !!(entry.phoneticUk || entry.phoneticUs) && !!entry.chinese && !!entry.exampleSentence;
}

async function fetchXlsxPaths(): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: { "User-Agent": "WordMaster-Build", Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error(`GitHub tree failed: ${res.status}`);
  const data: any = await res.json();
  return (data.tree || [])
    .filter((item: any) => item.path?.endsWith(".xlsx"))
    .map((item: any) => item.path as string);
}

async function fetchBook(pathStr: string): Promise<ReturnType<typeof parseRow>[]> {
  const encoded = pathStr.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encoded}`;
  const resp = await fetch(url, { headers: { "User-Agent": "WordMaster-Build" } });
  if (!resp.ok) throw new Error(`Failed ${pathStr}: ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
  return rows.map(parseRow).filter(Boolean) as NonNullable<ReturnType<typeof parseRow>>[];
}

async function runPool<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  console.log(`Fetching tree from ${REPO}...`);
  const paths = await fetchXlsxPaths();
  console.log(`Found ${paths.length} xlsx books`);

  const index = new Map<string, WordEntry>();
  let totalRows = 0;
  let processed = 0;

  await runPool(
    paths,
    async (bookPath) => {
      try {
        const rows = await fetchBook(bookPath);
        totalRows += rows.length;
        for (const row of rows) {
          const key = row.word.toLowerCase().trim();
          if (!key) continue;
          const existing = index.get(key);
          if (!existing) {
            index.set(key, {
              word: row.word,
              chinese: row.chinese,
              phoneticUk: row.phoneticUk,
              phoneticUs: row.phoneticUs,
              exampleSentence: row.exampleSentence,
              exampleSentenceCn: row.exampleSentenceCn,
              books: [bookPath]
            });
          } else {
            if (!existing.books.includes(bookPath)) existing.books.push(bookPath);
            if (!existing.chinese && row.chinese) existing.chinese = row.chinese;
            if (!existing.phoneticUk && row.phoneticUk) existing.phoneticUk = row.phoneticUk;
            if (!existing.phoneticUs && row.phoneticUs) existing.phoneticUs = row.phoneticUs;
            if (!existing.exampleSentence && row.exampleSentence) existing.exampleSentence = row.exampleSentence;
            if (!existing.exampleSentenceCn && row.exampleSentenceCn) existing.exampleSentenceCn = row.exampleSentenceCn;
          }
        }
      } catch (e: any) {
        console.warn(`  skip ${bookPath}: ${e.message}`);
      }
      processed++;
      if (processed % 50 === 0 || processed === paths.length) {
        console.log(`  processed ${processed}/${paths.length} books, unique words so far: ${index.size}`);
      }
    },
    CONCURRENCY
  );

  const words = Array.from(index.values());
  const complete = words.filter(isComplete);
  const needsEnrich = words.filter((w) => !isComplete(w));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    sourceRepo: REPO,
    bookCount: paths.length,
    totalRows,
    uniqueWords: words.length,
    completeWords: complete.length,
    needsEnrichment: needsEnrich.length,
    words: Object.fromEntries(
      words.map((w) => [
        w.word.toLowerCase(),
        {
          word: w.word,
          chinese: w.chinese,
          phoneticUk: w.phoneticUk,
          phoneticUs: w.phoneticUs,
          exampleSentence: w.exampleSentence,
          exampleSentenceCn: w.exampleSentenceCn
        }
      ])
    )
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const mb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);

  console.log("\n=== Summary ===");
  console.log(`Books:              ${paths.length}`);
  console.log(`Total word rows:    ${totalRows}`);
  console.log(`Unique words:       ${words.length}`);
  console.log(`Already complete:   ${complete.length}`);
  console.log(`Need AI enrichment: ${needsEnrich.length}`);
  console.log(`Saved to:           ${OUT_FILE} (${mb} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
