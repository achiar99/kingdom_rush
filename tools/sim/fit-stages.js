#!/usr/bin/env node
// Fit every stage's hpScale band to the campaign curve.
//
// A stage's difficulty is two numbers — the hpScale of its first level and of
// its tenth — with the eight in between interpolated. This bisects both
// endpoints of all five stages against the win rate targetWinRate() says that
// slot in the campaign should have, and prints the bands to paste into
// data/stages.js.
//
//   node tools/sim/fit-stages.js            fit all five stages
//   node tools/sim/fit-stages.js -n 120     more trials per probe (slower, tighter)
//
// Nothing is written: this reports numbers, you apply them. hpScale is the
// single knob deliberately — gold and lives bands stay where the designer put
// them, and difficulty is expressed in one place.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { STAGES, LEVELS_PER_STAGE, goldForHpScale } from "../../src/data/stages.js";
import { LEVELS } from "../../src/data/levels.js";
import { targetWinRate, pct } from "./analyze.js";
import { DEFAULT_DT } from "./harness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i === -1 ? dflt : Number(args[i + 1]);
};
const TRIALS = argOf("-n", 70) || argOf("--trials", 70);
const PROBES = argOf("--probes", 9);
const JOBS = Math.max(1, Math.min(os.cpus().length - 1, 12));

function runCell(task) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(HERE, "worker.js"), { workerData: task });
    w.on("message", (m) => { if (m.type === "result") resolve(m.summary); });
    w.on("error", reject);
    w.on("exit", (c) => { if (c !== 0) reject(new Error(`worker exited with ${c}`)); });
  });
}

// Win rate falls as hpScale rises, so plain bisection converges.
async function solveHpScale(levelIndex, target, log) {
  let lo = 0.4, hi = 40;
  let best = { value: LEVELS[levelIndex].hpScale, gap: Infinity, rate: 0 };
  for (let i = 0; i < PROBES; i++) {
    const mid = (lo + hi) / 2;
    const sum = await runCell({
      levelIndex, skill: "average", trials: TRIALS, seed0: 1,
      difficulty: "normal", hero: "achilles", upgrades: {}, dt: DEFAULT_DT,
      // startGold must move WITH hpScale, exactly as data/levels.js derives
      // it. Overriding hpScale alone probes a world where the enemy shrank
      // but the purse stayed — every downward probe measured too easy, and
      // the fitter systematically overshot. (Found when a fitted endpoint
      // reported 50% and the same level, with the band actually applied and
      // the purse recomputed, measured 8-14%.)
      levelOverrides: { hpScale: Number(mid.toFixed(3)),
                        startGold: goldForHpScale(Number(mid.toFixed(3))) },
    });
    const gap = Math.abs(sum.winRate - target);
    if (gap < best.gap) best = { value: mid, gap, rate: sum.winRate };
    log(`      hp ${mid.toFixed(2).padStart(6)} → ${pct(sum.winRate).padStart(4)} win`);
    if (sum.winRate > target) lo = mid; else hi = mid;
    if (gap < 0.03) break;
  }
  return best;
}

// A simple concurrency gate so the ten bisections share the worker budget.
let active = 0;
const queue = [];
async function slot(fn) {
  if (active >= JOBS) await new Promise((r) => queue.push(r));
  active++;
  try { return await fn(); }
  finally { active--; queue.shift()?.(); }
}

async function main() {
  console.log(`\n  Fitting hpScale bands · ${TRIALS} runs per probe · ${PROBES} probes per endpoint\n`);

  const results = await Promise.all(STAGES.map(async (stage, si) => {
    const firstIdx = si * LEVELS_PER_STAGE;
    const lastIdx = firstIdx + LEVELS_PER_STAGE - 1;
    const lines = [];
    const log = (s) => lines.push(s);

    const [first, last] = await Promise.all([
      slot(() => solveHpScale(firstIdx, targetWinRate(firstIdx), log)),
      slot(() => solveHpScale(lastIdx, targetWinRate(lastIdx), log)),
    ]);
    return { stage, si, first, last, firstIdx, lastIdx };
  }));

  console.log("  stage                        first level            last level         suggested band");
  console.log("  " + "─".repeat(92));
  for (const { stage, first, last, firstIdx, lastIdx } of results) {
    // Round to something a human would actually type into stages.js.
    const a = Number(first.value.toFixed(1));
    const b = Number(last.value.toFixed(1));
    console.log(
      "  " + `${stage.numeral}. ${stage.name}`.padEnd(28) +
      `${a.toFixed(1).padStart(5)} → ${pct(first.rate).padStart(4)} (want ${pct(targetWinRate(firstIdx))})`.padEnd(23) +
      `${b.toFixed(1).padStart(5)} → ${pct(last.rate).padStart(4)} (want ${pct(targetWinRate(lastIdx))})`.padEnd(23) +
      `hpScale: [${a}, ${b}]`);
  }
  console.log("\n  Paste the bands into src/data/stages.js, then re-run tools/sim/cli.js to confirm.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
