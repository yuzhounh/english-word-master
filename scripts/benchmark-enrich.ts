/**
 * Benchmark ENRICH_CHUNK_SIZE_LIGHT × ENRICH_CONCURRENCY against DeepSeek.
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-... npx tsx scripts/benchmark-enrich.ts
 *   DEEPSEEK_API_KEY=sk-... npx tsx scripts/benchmark-enrich.ts --rounds 2
 */

import dotenv from "dotenv";
dotenv.config();

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const NEW_CALL_CUTOFF_MS = 40000;
const FUNCTION_HARD_LIMIT_MS = 55000;

const SAMPLE_WORDS = [
  "abandon", "resilient", "meticulous", "pragmatic", "scrutinize", "foster", "elucidate", "lucid",
  "subtle", "thrive", "coherent", "ambiguous", "versatile", "imperative", "mitigate", "adversity",
  "culminate", "tangible", "indispensable", "empirical", "profound", "persevere", "paramount", "eloquent",
  "compliment", "autonomous", "exemplary", "innovative", "pivotal", "comprehensive", "exchange", "curriculum",
  "extracurricular", "biology", "confident", "exchange", "volunteer", "debate", "graduate", "recommend",
  "significant", "responsible", "determine", "contribute", "establish", "investigate", "interpret", "persuade",
  "negotiate", "anticipate", "compromise", "distinguish", "emphasize", "facilitate", "implement", "maintain",
  "obtain", "participate", "recognize", "substitute", "transform", "undertake", "withdraw", "accumulate",
  "allocate", "compensate", "demonstrate", "eliminate", "generate", "illustrate", "justify", "manipulate",
  "observe", "prioritize", "qualify", "reflect", "speculate", "tolerate", "validate", "accelerate",
  "calculate", "circulate", "concentrate", "decorate", "evaluate", "fluctuate", "guarantee", "hesitate",
  "integrate", "liberate", "motivate", "navigate", "operate", "penetrate", "question", "regulate",
  "simulate", "terminate", "utilize", "visualize", "wander", "yield", "absorb", "capture",
  "deliver", "expand", "feature", "govern", "handle", "impact", "launch", "monitor",
  "notice", "occur", "perform", "require", "suggest", "trigger", "update", "witness"
];

function buildEnrichPrompt(chunk: { word: string; chinese: string }[]): string {
  return `You are an expert English language learning assistant and dictionary compiler.
For EACH word in the list, generate:
1. "word": lowercase English word
2. "phonetic": IPA transcription
3. "chinese": concise Chinese definition with part-of-speech
4. "exampleSentence": short English sentence (max 12 words)
5. "exampleSentenceCn": Chinese translation

Respond with JSON only:
{"words":[{"word":"...","phonetic":"...","chinese":"...","exampleSentence":"...","exampleSentenceCn":"..."}]}

Input words:
${JSON.stringify(chunk, null, 2)}`;
}

function parseJson(text: string): any {
  let cleaned = text.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();
  return JSON.parse(cleaned);
}

async function enrichOneChunk(
  chunk: { word: string; chinese: string }[],
  timeoutMs: number
): Promise<{ ms: number; ok: boolean; count: number; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const start = Date.now();
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Output strictly valid JSON matching the requested schema. No text outside JSON."
          },
          { role: "user", content: buildEnrichPrompt(chunk) }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        stream: false
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const ms = Date.now() - start;
    if (!response.ok) {
      const err = await response.text();
      return { ms, ok: false, count: 0, error: `HTTP ${response.status}: ${err.slice(0, 120)}` };
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseJson(content);
    const words = Array.isArray(parsed.words) ? parsed.words : [];
    const valid = words.filter(
      (w: any) => w?.word && w?.phonetic && w?.chinese && w?.exampleSentence
    ).length;
    return { ms, ok: valid >= Math.ceil(chunk.length * 0.8), count: valid, error: valid < chunk.length ? `partial ${valid}/${chunk.length}` : undefined };
  } catch (e: any) {
    return { ms: Date.now() - start, ok: false, count: 0, error: e?.message || String(e) };
  }
}

function timeBudgetRemaining(elapsedMs: number): number {
  return Math.max(12000, FUNCTION_HARD_LIMIT_MS - elapsedMs - 5000);
}

async function simulateVercelRound(
  chunkSize: number,
  concurrency: number,
  totalWords: number
): Promise<{
  wordsProcessed: number;
  rounds: number;
  maxChunkMs: number;
  failures: number;
  wallMs: number;
  timedOut: boolean;
}> {
  const words = SAMPLE_WORDS.slice(0, totalWords).map((w) => ({ word: w, chinese: "" }));
  let index = 0;
  let wordsProcessed = 0;
  let rounds = 0;
  let maxChunkMs = 0;
  let failures = 0;
  const startTime = Date.now();
  let didAiWork = false;

  while (index < words.length) {
    const elapsed = Date.now() - startTime;
    if (didAiWork && elapsed >= NEW_CALL_CUTOFF_MS) break;
    const budget = timeBudgetRemaining(elapsed);
    if (budget < 12000) break;

    const batchChunks: { word: string; chinese: string }[][] = [];
    let scanIdx = index;
    while (batchChunks.length < concurrency && scanIdx < words.length) {
      const chunk = words.slice(scanIdx, scanIdx + chunkSize);
      scanIdx += chunkSize;
      if (chunk.length > 0) batchChunks.push(chunk);
    }
    if (batchChunks.length === 0) break;

    didAiWork = true;
    rounds += 1;
    const results = await Promise.all(
      batchChunks.map((chunk) => enrichOneChunk(chunk, budget))
    );

    for (const r of results) {
      maxChunkMs = Math.max(maxChunkMs, r.ms);
      if (r.ok) wordsProcessed += r.count;
      else failures += 1;
    }
    index = scanIdx;
  }

  const wallMs = Date.now() - startTime;
  return {
    wordsProcessed,
    rounds,
    maxChunkMs,
    failures,
    wallMs,
    timedOut: wallMs >= NEW_CALL_CUTOFF_MS - 500
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("Missing DEEPSEEK_API_KEY. Create repo/.env or pass env var.");
    process.exit(1);
  }

  const rounds = Number(process.argv.find((a) => a.startsWith("--rounds="))?.split("=")[1] || 1);
  console.log(`Model: ${MODEL}`);
  console.log(`Simulating one Vercel invocation (~${NEW_CALL_CUTOFF_MS}ms budget)\n`);

  // Phase 1: single-chunk latency vs size
  console.log("=== Phase 1: single chunk latency (light mode, no options) ===");
  console.log("chunkSize | ms    | ok | valid | note");
  console.log("---------|-------|----|-------|-----");
  for (const size of [10, 15, 20, 25, 30, 35, 40, 45]) {
    const chunk = SAMPLE_WORDS.slice(0, size).map((w) => ({ word: w, chinese: "" }));
    const r = await enrichOneChunk(chunk, 50000);
    console.log(
      `${String(size).padStart(8)} | ${String(r.ms).padStart(5)} | ${r.ok ? " Y" : " N"} | ${String(r.count).padStart(5)} | ${r.error || ""}`
    );
    await sleep(1500);
  }

  // Phase 2: grid search chunk × concurrency
  console.log("\n=== Phase 2: Vercel-round throughput (120 words, 1 run each) ===");
  console.log("chunk | conc | words/40s | rounds | maxChunkMs | fail | wallMs");
  console.log("------|------|-----------|--------|------------|------|-------");

  type Row = { chunk: number; conc: number; result: Awaited<ReturnType<typeof simulateVercelRound>> };
  const rows: Row[] = [];

  for (const chunk of [20, 25, 30, 35, 40]) {
    for (const conc of [1, 2, 3, 4]) {
      const result = await simulateVercelRound(chunk, conc, 120);
      rows.push({ chunk, conc, result });
      console.log(
        `${String(chunk).padStart(5)} | ${String(conc).padStart(4)} | ${String(result.wordsProcessed).padStart(9)} | ${String(result.rounds).padStart(6)} | ${String(result.maxChunkMs).padStart(10)} | ${String(result.failures).padStart(4)} | ${String(result.wallMs).padStart(6)}`
      );
      await sleep(2000);
    }
  }

  // Phase 3: repeat best candidates
  const scored = rows
    .map((r) => ({
      ...r,
      score:
        r.result.wordsProcessed -
        r.result.failures * 20 -
        (r.result.maxChunkMs > 48000 ? 50 : 0) -
        (r.result.failures > 0 ? 30 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  console.log("\n=== Top 3 configs (by words/40s − penalties) ===");
  for (const t of top3) {
    console.log(`  chunk=${t.chunk} conc=${t.conc} → ${t.result.wordsProcessed} words/round, maxChunk=${t.result.maxChunkMs}ms, fails=${t.result.failures}`);
  }

  if (rounds > 1) {
    console.log(`\n=== Phase 3: ${rounds} repeats for top config ===`);
    const best = top3[0];
    const repeats: number[] = [];
    for (let i = 0; i < rounds; i++) {
      const r = await simulateVercelRound(best.chunk, best.conc, 120);
      repeats.push(r.wordsProcessed);
      console.log(`  run ${i + 1}: ${r.wordsProcessed} words, maxChunk=${r.maxChunkMs}ms, fails=${r.failures}`);
      await sleep(2000);
    }
    const avg = repeats.reduce((a, b) => a + b, 0) / repeats.length;
    console.log(`  average: ${avg.toFixed(1)} words/40s`);
  }

  console.log("\n=== Recommendation ===");
  const pick = top3.find((t) => t.result.failures === 0 && t.result.maxChunkMs < 45000) || top3[0];
  console.log(`  ENRICH_CHUNK_SIZE_LIGHT=${pick.chunk}`);
  console.log(`  ENRICH_CONCURRENCY=${pick.conc}`);
  console.log(`  Expected ~${pick.result.wordsProcessed} words per Vercel request (~40s window)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
