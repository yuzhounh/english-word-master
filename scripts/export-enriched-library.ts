/**
 * Export enriched xlsx library mirroring lilinji/English structure.
 * Requires: data/word-dictionary.json, data/library-word-index.json (optional)
 *
 * Usage: npx tsx scripts/export-enriched-library.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

const REPO = process.env.WORD_LIBRARY_REPO || "lilinji/English";
const BRANCH = process.env.WORD_LIBRARY_BRANCH || "main";
const DICT_FILE = path.join(process.cwd(), "data", "word-dictionary.json");
const OUT_ROOT = path.join(process.cwd(), "data", "enriched-library");
const CONCURRENCY = 6;

function loadDict(): Record<string, any> {
  if (!fs.existsSync(DICT_FILE)) throw new Error("word-dictionary.json not found");
  return JSON.parse(fs.readFileSync(DICT_FILE, "utf8")).words || {};
}

async function fetchXlsxPaths(): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    { headers: { "User-Agent": "WordMaster-Export", Accept: "application/vnd.github+json" } }
  );
  const data: any = await res.json();
  return (data.tree || []).filter((i: any) => i.path?.endsWith(".xlsx")).map((i: any) => i.path);
}

async function fetchBook(pathStr: string) {
  const encoded = pathStr.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encoded}`;
  const resp = await fetch(url, { headers: { "User-Agent": "WordMaster-Export" } });
  if (!resp.ok) throw new Error(`${pathStr}: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

function enrichRows(rows: Record<string, unknown>[], dict: Record<string, any>) {
  return rows.map((row) => {
    const word = String(row["单词"] || row["word"] || row["Word"] || "").trim();
    const key = word.toLowerCase();
    const d = dict[key];
    if (!d) return row;
    return {
      ...row,
      单词: word || d.word,
      word: word || d.word,
      英音: d.phoneticUk || row["英音"] || d.phonetic || "",
      美音: d.phoneticUs || row["美音"] || d.phonetic || "",
      释义: d.chinese || row["释义"] || row["chinese"] || "",
      例句: d.exampleSentence || row["例句"] || "",
      例句翻译: d.exampleSentenceCn || row["例句翻译"] || ""
    };
  });
}

async function main() {
  const dict = loadDict();
  const enriched = Object.values(dict).filter((e: any) => e.phonetic && e.chinese && e.exampleSentence).length;
  console.log(`Dictionary: ${Object.keys(dict).length} words, ${enriched} fully enriched`);
  if (enriched < Object.keys(dict).length * 0.9) {
    console.warn("Warning: dictionary not fully enriched yet. Continue anyway? (<90%)");
  }

  const paths = await fetchXlsxPaths();
  console.log(`Exporting ${paths.length} books to ${OUT_ROOT}`);

  let done = 0;
  for (const bookPath of paths) {
    try {
      const buf = await fetchBook(bookPath);
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      const enrichedRows = enrichRows(rows, dict);
      const newSheet = XLSX.utils.json_to_sheet(enrichedRows);
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);
      const outPath = path.join(OUT_ROOT, bookPath);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      XLSX.writeFile(newWb, outPath);
    } catch (e: any) {
      console.warn(`Skip ${bookPath}: ${e.message}`);
    }
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${paths.length}`);
  }
  console.log(`Done. Output: ${OUT_ROOT}`);
  console.log("Push this folder to a new GitHub repo and set WORD_LIBRARY_REPO to use it.");
}

main().catch(console.error);
