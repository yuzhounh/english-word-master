/**
 * Build book -> wordIds index from lilinji/English xlsx files.
 * Output: data/book-index.json
 * Usage: npx tsx scripts/build-book-index.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

const REPO = process.env.WORD_LIBRARY_REPO || "lilinji/English";
const BRANCH = process.env.WORD_LIBRARY_BRANCH || "main";
const OUT = path.join(process.cwd(), "data", "book-index.json");
const CONCURRENCY = 10;

function parseWord(row: Record<string, unknown>): string | null {
  const w = String(row["单词"] || row["word"] || row["Word"] || "").trim();
  return w.length >= 2 ? w.toLowerCase() : null;
}

async function fetchPaths(): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: { "User-Agent": "WordMaster-Build", Accept: "application/vnd.github+json" } }
  );
  const data: any = await res.json();
  return (data.tree || []).filter((i: any) => i.path?.endsWith(".xlsx")).map((i: any) => i.path);
}

async function fetchBookWords(bookPath: string): Promise<string[]> {
  const encoded = bookPath.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encoded}`;
  const resp = await fetch(url, { headers: { "User-Agent": "WordMaster-Build" } });
  if (!resp.ok) throw new Error(String(resp.status));
  const buf = new Uint8Array(await resp.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = parseWord(row);
    if (key && !seen.has(key)) {
      seen.add(key);
      ids.push(key);
    }
  }
  return ids;
}

async function runPool<T, R>(items: T[], fn: (item: T) => Promise<R>, n: number): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const j = i++;
        out[j] = await fn(items[j]);
      }
    })
  );
  return out;
}

async function main() {
  console.log(`Building book index from ${REPO}...`);
  const paths = await fetchPaths();
  const index: Record<string, { name: string; path: string; sourceXlsx: string; wordIds: string[] }> = {};

  await runPool(
    paths,
    async (xlsxPath) => {
      const basePath = xlsxPath.replace(/\.xlsx$/i, "");
      const name = basePath.split("/").pop() || basePath;
      try {
        const wordIds = await fetchBookWords(xlsxPath);
        index[basePath] = { name, path: basePath, sourceXlsx: xlsxPath, wordIds };
      } catch (e: any) {
        console.warn(`skip ${xlsxPath}: ${e.message}`);
      }
    },
    CONCURRENCY
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceRepo: REPO,
      bookCount: Object.keys(index).length,
      books: index
    })
  );
  console.log(`Saved ${Object.keys(index).length} books -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
