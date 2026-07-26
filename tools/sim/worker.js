// One worker owns one (level, skill) cell: it runs every trial for that cell
// and ships back only the summary. Shipping summaries instead of raw trials
// keeps tens of thousands of playthroughs from ever crossing a thread
// boundary — the numbers are small, the trials are not.
//
// Each worker is a fresh module instance, which matters: src/state.js holds
// the world in module-level singletons, so trials must never run concurrently
// inside one thread. Between cells is fine; between threads is fine.
import { parentPort, workerData } from "node:worker_threads";
import { runTrial } from "./harness.js";
import { summarize } from "./stats.js";

const { levelIndex, skill, trials, seed0, difficulty, hero, upgrades, dt, levelOverrides } = workerData;

const results = [];
for (let i = 0; i < trials; i++) {
  results.push(runTrial({
    levelIndex, skill, difficulty, hero, upgrades, dt, levelOverrides, seed: seed0 + i,
  }));
  // Coarse heartbeat so the CLI can show progress on long runs.
  if ((i + 1) % 50 === 0) parentPort.postMessage({ type: "progress", done: 50 });
}
parentPort.postMessage({ type: "progress", done: trials % 50 });
parentPort.postMessage({ type: "result", summary: summarize(results) });
