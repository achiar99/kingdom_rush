#!/usr/bin/env node
// Calibrate every level's difficulty against the campaign curve.
//
// The stage hpScale band says how hard a slot in the campaign SHOULD be; the
// exposure normalisation in levels.js removes what the map's measured
// coverage predicts. What's left is each map's character — chokepoint
// quality, how a fork splits attention, how a coil stacks range — which no
// closed-form metric captures. This tool measures it the only honest way:
// play each level thousands of times, bisect the hpScale that lands its
// target win rate, and report the residual factor
//
//     tune = solved / (band × norm)
//
// to paste into src/data/calibration.js. Factors near 1 mean the band and
// the normaliser already had it right.
//
//   node tools/sim/calibrate.js              all 50 levels
//   node tools/sim/calibrate.js -l 35,36     just those (1-based, like cli.js)
//   node tools/sim/calibrate.js -n 120       more trials per probe
//
// Nothing is written: this reports numbers, you apply them (same contract as
// fit-stages.js).
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { STAGES, goldForHpScale, band } from "../../src/data/stages.js";
import { LEVELS } from "../../src/data/levels.js";
import { CALIBRATION } from "../../src/data/calibration.js";
import { targetWinRate, pct } from "./analyze.js";
import { DEFAULT_DT } from "./harness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i === -1 ? dflt : args[i + 1];
};
const TRIALS = Number(argOf("-n", 80));
const PROBES = Number(argOf("--probes", 8));
const ONLY = (argOf("-l", "") || "").split(",").filter(Boolean).map((s) => Number(s) - 1);
const JOBS = Math.max(1, Math.min(os.cpus().length - 1, 12));

// Masters bypass hpScale (absoluteHp), so a finale's solve reads the waves
// BEFORE the master; that's still the right thing to calibrate.
function runCell(task) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(HERE, "worker.js"), { workerData: task });
    w.on("message", (m) => { if (m.type === "result") resolve(m.summary); });
    w.on("error", reject);
    w.on("exit", (c) => { if (c !== 0) reject(new Error(`worker exited ${c}`)); });
  });
}

async function solve(levelIndex, target) {
  let lo = 0.3, hi = 12, best = null;
  for (let i = 0; i < PROBES; i++) {
    const mid = (lo + hi) / 2;
    const sum = await runCell({
      levelIndex, skill: "average", trials: TRIALS, seed0: 1,
      difficulty: "normal", hero: "achilles", upgrades: {}, dt: DEFAULT_DT,
      // startGold moves WITH hpScale, exactly as levels.js derives it —
      // see the identical note in fit-stages.js.
      levelOverrides: { hpScale: Number(mid.toFixed(3)),
                        startGold: goldForHpScale(mid) },
    });
    if (!best || Math.abs(sum.winRate - target) < best.gap)
      best = { value: mid, rate: sum.winRate, gap: Math.abs(sum.winRate - target) };
    if (sum.winRate > target) lo = mid; else hi = mid;
  }
  return best;
}

const todo = LEVELS.filter((lv) => !ONLY.length || ONLY.includes(lv.index));
const out = new Array(LEVELS.length).fill(null);

// a small worker pool over levels; each solve is itself sequential
let cursor = 0;
async function pump() {
  while (cursor < todo.length) {
    const lv = todo[cursor++];
    const target = targetWinRate(lv.index);
    const s = await solve(lv.index, target);
    // hpScale currently on the level already includes norm and any existing
    // calibration; divide both out to recover band × norm alone.
    const baseline = lv.hpScale / (CALIBRATION[lv.index] ?? 1);
    // Clamp: early levels are hpScale-insensitive (see fit-stages.js) and
    // the solver wanders in their flat response; a wild factor there would
    // only distort the purse. Later levels respond sharply, so they get the
    // full range the solve asked for.
    const ceiling = lv.index < 7 ? 1.35 : 2.2;
    // The floor is generous on purpose: the opposite-sides pincer needs less
    // than half its band value — creeps flooding BOTH edges at once is that
    // much harder than the same creeps on one road.
    const tune = Math.min(ceiling, Math.max(0.35, s.value / baseline));
    out[lv.index] = { tune, solved: s.value, rate: s.rate, target };
    console.error(
      `${String(lv.index).padStart(2)} ${lv.id.padEnd(13)} solved ${s.value.toFixed(2)} ` +
      `@${pct(s.rate)} (want ${pct(target)})  tune ${tune.toFixed(2)}`);
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, 4) }, pump));

console.log("\n// paste into src/data/calibration.js:");
console.log("export const CALIBRATION = [");
for (let s = 0; s < 5; s++) {
  const row = out.slice(s * 10, s * 10 + 10)
    .map((r, i) => (r ? r.tune.toFixed(2) : (CALIBRATION[s * 10 + i] ?? 1).toFixed(2)));
  console.log(`  ${row.join(", ")},  // ${STAGES[s].numeral}`);
}
console.log("];");
