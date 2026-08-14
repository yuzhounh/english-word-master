/**
 * Offline simulation of Vercel enrich rounds (no API calls).
 * Calibrated from observed production: 2 words ≈ 7.7s (old, with options).
 * Light mode estimate: ~0.45s/word batched + 3s fixed overhead per chunk.
 *
 * Usage: npx tsx scripts/benchmark-enrich-sim.ts
 */

const NEW_CALL_CUTOFF_MS = 40000;
const FUNCTION_HARD_LIMIT_MS = 55000;

function timeBudgetRemaining(elapsedMs: number): number {
  return Math.max(12000, FUNCTION_HARD_LIMIT_MS - elapsedMs - 5000);
}

/** Estimated DeepSeek latency for light-mode chunk (ms) */
function estimateChunkMs(chunkSize: number, concurrency: number): number {
  // Batching sublinear; parallel calls share wall-clock (max of group)
  const perWordMs = 420; // ~0.42s/word in batch (light, no options)
  const overheadMs = 2800;
  const base = overheadMs + chunkSize * perWordMs;
  // Slight penalty when running parallel (provider rate / contention)
  const contention = 1 + (concurrency - 1) * 0.08;
  return Math.round(base * contention);
}

function simulateRound(chunkSize: number, concurrency: number, totalWords = 120) {
  let index = 0;
  let wordsProcessed = 0;
  let rounds = 0;
  let maxChunkMs = 0;
  let failures = 0;
  const startTime = Date.now();
  let didAiWork = false;

  while (index < totalWords) {
    const elapsed = Date.now() - startTime;
    if (didAiWork && elapsed >= NEW_CALL_CUTOFF_MS) break;
    if (timeBudgetRemaining(elapsed) < 12000) break;

    const batchSizes: number[] = [];
    let scanIdx = index;
    while (batchSizes.length < concurrency && scanIdx < totalWords) {
      const size = Math.min(chunkSize, totalWords - scanIdx);
      batchSizes.push(size);
      scanIdx += chunkSize;
    }
    if (batchSizes.length === 0) break;

    didAiWork = true;
    rounds += 1;

    // Parallel: wall-clock = slowest chunk in batch
    const chunkMs = batchSizes.map((size) => estimateChunkMs(size, concurrency));
    const roundMs = Math.max(...chunkMs);
    maxChunkMs = Math.max(maxChunkMs, roundMs);

    // Simulate timeout / quality failure when chunk too large or too slow
    for (const [i, size] of batchSizes.entries()) {
      const ms = chunkMs[i];
      if (ms > 52000 || size > 42) {
        failures += 1;
        wordsProcessed += Math.floor(size * 0.3);
      } else if (ms > 45000 || size > 38) {
        wordsProcessed += Math.floor(size * 0.85);
      } else {
        wordsProcessed += size;
      }
    }

    // Advance simulated clock
    const now = Date.now();
    while (Date.now() - now < roundMs) {
      /* busy-wait substitute: advance fake clock */
    }
    index = scanIdx;
  }

  return {
    wordsProcessed,
    rounds,
    maxChunkMs,
    failures,
    wallMs: Date.now() - startTime
  };
}

/** Accurate simulation using fake clock */
function simulateRoundAccurate(chunkSize: number, concurrency: number, totalWords = 120) {
  let index = 0;
  let wordsProcessed = 0;
  let rounds = 0;
  let maxChunkMs = 0;
  let failures = 0;
  let elapsed = 0;
  let didAiWork = false;

  while (index < totalWords) {
    if (didAiWork && elapsed >= NEW_CALL_CUTOFF_MS) break;
    if (timeBudgetRemaining(elapsed) < 12000) break;

    const batchSizes: number[] = [];
    let scanIdx = index;
    while (batchSizes.length < concurrency && scanIdx < totalWords) {
      const size = Math.min(chunkSize, totalWords - scanIdx);
      batchSizes.push(size);
      scanIdx += chunkSize;
    }
    if (batchSizes.length === 0) break;

    didAiWork = true;
    rounds += 1;

    const chunkMs = batchSizes.map((size) => estimateChunkMs(size, concurrency));
    const roundMs = Math.max(...chunkMs);
    maxChunkMs = Math.max(maxChunkMs, roundMs);
    elapsed += roundMs;

    for (const [i, size] of batchSizes.entries()) {
      const ms = chunkMs[i];
      if (ms > 52000 || size > 42) {
        failures += 1;
        wordsProcessed += Math.floor(size * 0.3);
      } else if (ms > 45000 || size > 38) {
        wordsProcessed += Math.floor(size * 0.85);
      } else {
        wordsProcessed += size;
      }
    }
    index = scanIdx;
  }

  return { wordsProcessed, rounds, maxChunkMs, failures, wallMs: elapsed };
}

console.log("Offline simulation (light mode, no options)");
console.log("Model: ~0.42s/word + 2.8s overhead per chunk\n");

console.log("=== Single-chunk estimated latency ===");
for (const size of [10, 15, 20, 25, 30, 35, 40, 45]) {
  const ms = estimateChunkMs(size, 1);
  console.log(`  chunk=${String(size).padStart(2)} → ~${ms}ms${ms > 50000 ? " ⚠ timeout risk" : ""}`);
}

console.log("\n=== Vercel round (120 words, 40s budget) ===");
console.log("chunk | conc | words/40s | rounds | maxChunkMs | fail");
console.log("------|------|-----------|--------|------------|----");

type Row = { chunk: number; conc: number; r: ReturnType<typeof simulateRoundAccurate>; score: number };
const rows: Row[] = [];

for (const chunk of [20, 25, 30, 35, 40]) {
  for (const conc of [1, 2, 3, 4]) {
    const r = simulateRoundAccurate(chunk, conc, 120);
    const score = r.wordsProcessed - r.failures * 25 - (r.maxChunkMs > 48000 ? 40 : 0);
    rows.push({ chunk, conc, r, score });
    console.log(
      `${String(chunk).padStart(5)} | ${String(conc).padStart(4)} | ${String(r.wordsProcessed).padStart(9)} | ${String(r.rounds).padStart(6)} | ${String(r.maxChunkMs).padStart(10)} | ${String(r.failures).padStart(4)}`
    );
  }
}

rows.sort((a, b) => b.score - a.score);
const pick = rows.find((r) => r.r.failures === 0 && r.r.maxChunkMs < 45000) || rows[0];

console.log("\n=== Top 3 ===");
rows.slice(0, 3).forEach((t) => {
  console.log(`  chunk=${t.chunk} conc=${t.conc} → ${t.r.wordsProcessed} words/40s, maxChunk=${t.r.maxChunkMs}ms`);
});

console.log("\n=== Recommended defaults ===");
console.log(`  ENRICH_CHUNK_SIZE_LIGHT=${pick.chunk}`);
console.log(`  ENRICH_CONCURRENCY=${pick.conc}`);
console.log(`  ~${pick.r.wordsProcessed} words per Vercel request`);

console.log("\nNote: Run scripts/benchmark-enrich.ts with DEEPSEEK_API_KEY for real measurements.");
