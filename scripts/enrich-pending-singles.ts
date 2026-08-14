/**
 * Enrich remaining words one at a time (for stubborn failures).
 */
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const DICT_FILE = "data/word-dictionary.json";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

function needs(e: any): boolean {
  const hasPhonetic = !!(e.phonetic || e.phoneticUk || e.phoneticUs);
  return !(hasPhonetic && e.chinese && e.exampleSentence);
}

async function enrichOne(word: string, chinese: string): Promise<any | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Output strictly valid JSON only." },
        {
          role: "user",
          content: `For word "${word}" (Chinese hint: ${chinese || "none"}), output:
{"word":"...","phonetic":"...","chinese":"...","exampleSentence":"...","exampleSentenceCn":"..."}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: any = await response.json();
  let text = (data?.choices?.[0]?.message?.content ?? "").trim();
  text = text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1").trim();
  return JSON.parse(text);
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(DICT_FILE, "utf8"));
  const dict = raw.words || {};
  const pending = Object.entries(dict).filter(([, e]) => needs(e)) as [string, any][];

  console.log(`Processing ${pending.length} words one-by-one...`);

  for (const [key, entry] of pending) {
    try {
      const result = await enrichOne(entry.word, entry.chinese);
      dict[key] = {
        ...entry,
        phonetic: result.phonetic || entry.phonetic || "",
        phoneticUk: entry.phoneticUk || result.phonetic || "",
        phoneticUs: entry.phoneticUs || result.phonetic || "",
        chinese: result.chinese || entry.chinese || "",
        exampleSentence: result.exampleSentence || "",
        exampleSentenceCn: result.exampleSentenceCn || "",
        enrichedAt: Date.now()
      };
      console.log(`  OK: ${entry.word}`);
    } catch (e: any) {
      console.warn(`  FAIL: ${entry.word} — ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const done = Object.values(dict).filter((e) => !needs(e)).length;
  fs.writeFileSync(
    DICT_FILE,
    JSON.stringify({ ...raw, words: dict, enrichedWords: done, generatedAt: new Date().toISOString() })
  );
  console.log(`\nDone. ${done}/${Object.keys(dict).length} enriched.`);
}

main().catch(console.error);
