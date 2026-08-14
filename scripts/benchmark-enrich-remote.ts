/**
 * Benchmark enrich params via deployed /api/enrich-words (uses server-side DEEPSEEK_API_KEY).
 *
 * Usage:
 *   npx tsx scripts/benchmark-enrich-remote.ts
 *   npx tsx scripts/benchmark-enrich-remote.ts --url=http://localhost:3000
 */

const BASE_URL = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1]
  || "https://english-word-master.vercel.app";

const SAMPLE_WORDS = [
  "abandon", "resilient", "meticulous", "pragmatic", "scrutinize", "foster", "elucidate", "lucid",
  "subtle", "thrive", "coherent", "ambiguous", "versatile", "imperative", "mitigate", "adversity",
  "culminate", "tangible", "indispensable", "empirical", "profound", "persevere", "paramount", "eloquent",
  "compliment", "autonomous", "exemplary", "innovative", "pivotal", "comprehensive", "exchange", "curriculum",
  "extracurricular", "biology", "confident", "volunteer", "debate", "graduate", "recommend", "significant",
  "responsible", "determine", "contribute", "establish", "investigate", "interpret", "persuade", "negotiate",
  "anticipate", "compromise", "distinguish", "emphasize", "facilitate", "implement", "maintain", "obtain",
  "participate", "recognize", "substitute", "transform", "undertake", "withdraw", "accumulate", "allocate",
  "compensate", "demonstrate", "eliminate", "generate", "illustrate", "justify", "manipulate", "observe",
  "prioritize", "qualify", "reflect", "speculate", "tolerate", "validate", "accelerate", "calculate",
  "circulate", "concentrate", "decorate", "evaluate", "fluctuate", "guarantee", "hesitate", "integrate",
  "liberate", "motivate", "navigate", "operate", "penetrate", "question", "regulate", "simulate",
  "terminate", "utilize", "visualize", "wander", "yield", "absorb", "capture", "deliver",
  "expand", "feature", "govern", "handle", "impact", "launch", "monitor", "notice",
  "occur", "perform", "require", "suggest", "trigger", "update", "witness", "achieve",
  "benefit", "challenge", "develop", "enhance", "foundation", "growth", "harmony", "influence"
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function oneRound(
  chunkSize: number,
  concurrency: number,
  wordCount: number
): Promise<{
  ms: number;
  processed: number;
  pending: number;
  done: boolean;
  ok: boolean;
  enriched: number;
  error?: string;
}> {
  const words = SAMPLE_WORDS.slice(0, wordCount).map((w) => ({ word: w, chinese: "" }));
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/enrich-words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        words,
        light: true,
        _benchChunkSize: chunkSize,
        _benchConcurrency: concurrency
      }),
      signal: AbortSignal.timeout(120000)
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      return { ms, processed: 0, pending: wordCount, done: false, ok: false, enriched: 0, error: `HTTP ${res.status}` };
    }
    const data: any = await res.json();
    const list = Array.isArray(data.words) ? data.words : [];
    const enriched = list.filter(
      (w: any) => w.phonetic && w.exampleSentence && w.chinese
    ).length;
    const pending = Array.isArray(data.pending) ? data.pending.length : 0;
    return {
      ms,
      processed: list.length,
      pending,
      done: !!data.done,
      ok: !!data.success,
      enriched,
      error: enriched < list.length * 0.8 ? `quality ${enriched}/${list.length}` : undefined
    };
  } catch (e: any) {
    return {
      ms: Date.now() - start,
      processed: 0,
      pending: wordCount,
      done: false,
      ok: false,
      enriched: 0,
      error: e?.message || String(e)
    };
  }
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  console.log("Testing one Vercel invocation per config (120 words, light mode)\n");

  // Baseline: current production defaults (no bench params)
  console.log("=== Baseline (server defaults, no bench override) ===");
  const baseline = await oneRound(35, 3, 120);
  console.log(
    `  defaults: ${baseline.enriched} enriched in ${baseline.ms}ms, pending=${baseline.pending}, done=${baseline.done}${baseline.error ? ` (${baseline.error})` : ""}`
  );
  await sleep(3000);

  console.log("\n=== Grid: chunk × concurrency ===");
  console.log("chunk | conc | enriched | ms   | pending | done | note");
  console.log("------|------|----------|------|---------|------|-----");

  type Row = { chunk: number; conc: number; r: Awaited<ReturnType<typeof oneRound>> };
  const rows: Row[] = [];

  for (const chunk of [20, 25, 30, 35, 40]) {
    for (const conc of [1, 2, 3, 4]) {
      const r = await oneRound(chunk, conc, 120);
      rows.push({ chunk, conc, r });
      console.log(
        `${String(chunk).padStart(5)} | ${String(conc).padStart(4)} | ${String(r.enriched).padStart(8)} | ${String(r.ms).padStart(4)} | ${String(r.pending).padStart(7)} | ${r.done ? "  Y" : "  N"} | ${r.error || (r.ms > 58000 ? "near-timeout" : "")}`
      );
      await sleep(3000);
    }
  }

  const scored = rows
    .map((row) => ({
      ...row,
      score:
        row.r.enriched -
        (row.r.ms > 58000 ? 40 : 0) -
        (row.r.enriched < 60 ? 30 : 0) -
        (row.r.error ? 20 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  console.log("\n=== Top 3 ===");
  for (const t of scored.slice(0, 3)) {
    console.log(
      `  chunk=${t.chunk} conc=${t.conc} → ${t.r.enriched} words in ${t.r.ms}ms, pending=${t.r.pending}`
    );
  }

  const pick = scored.find((t) => t.r.enriched >= 80 && t.r.ms < 58000 && !t.r.error) || scored[0];
  console.log("\n=== Recommendation ===");
  console.log(`  ENRICH_CHUNK_SIZE_LIGHT=${pick.chunk}`);
  console.log(`  ENRICH_CONCURRENCY=${pick.conc}`);
  console.log(`  ~${pick.r.enriched} words per request, ${pick.r.ms}ms wall time`);
}

main().catch(console.error);
