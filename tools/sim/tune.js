#!/usr/bin/env node
// Parameter sweeps. The report tells you a level is mistuned; this tells you
// what number to change it to.
//
//   node tools/sim/tune.js -l 9 -p hpScale --range 1:6:0.5
//   node tools/sim/tune.js -l 9 -p startGold --range 300:1500:150
//   node tools/sim/tune.js -l 8 -p startLives --range 12:40:4 -n 200
//   node tools/sim/tune.js -l 9 -p hpScale --solve            find the value hitting the target
//
// Sweeps patch the level definition in memory only — levels.js is never
// touched. Apply the answer by hand once you like it.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { LEVELS } from "../../src/data/levels.js";
import { DIFFICULTIES } from "../../src/data/difficulties.js";
import { HEROES } from "../../src/data/hero.js";
import { SKILL_NAMES } from "./bot.js";
import { DEFAULT_DT } from "./harness.js";
import { TARGETS, pct } from "./analyze.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TUNABLE = ["hpScale", "startGold", "startLives"];

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

function parseArgs(argv) {
  const o = {
    levelIndex: null, param: "hpScale", range: null, solve: false,
    trials: 120, skills: ["novice", "average", "expert"],
    difficulty: "normal", hero: "achilles", upgrades: {}, dt: DEFAULT_DT, seed0: 1,
    target: null,
    jobs: Math.max(1, Math.min(os.cpus().length - 1, 12)),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--level": case "-l": o.levelIndex = Number(next()) - 1; break;
      case "--param": case "-p": o.param = next(); break;
      case "--range": case "-r": o.range = next().split(":").map(Number); break;
      case "--solve": o.solve = true; break;
      case "--target": o.target = Number(next()); break;
      case "--trials": case "-n": o.trials = Number(next()); break;
      case "--skill": case "-s": o.skills = next().split(","); break;
      case "--difficulty": case "-d": o.difficulty = next(); break;
      case "--hero": o.hero = next(); break;
      case "--upgrades": o.upgrades = JSON.parse(next()); break;
      case "--jobs": case "-j": o.jobs = Number(next()); break;
      case "--help": case "-h": usage(); process.exit(0);
      default: die(`unknown option: ${a}  (try --help)`);
    }
  }
  if (o.levelIndex === null || !LEVELS[o.levelIndex]) die("--level is required (1-based)");
  if (!TUNABLE.includes(o.param)) die(`--param must be one of: ${TUNABLE.join(", ")}`);
  if (!DIFFICULTIES[o.difficulty]) die(`unknown --difficulty: ${o.difficulty}`);
  if (!HEROES[o.hero]) die(`unknown --hero: ${o.hero}`);
  for (const s of o.skills) if (!SKILL_NAMES.includes(s)) die(`unknown --skill: ${s}`);
  if (!o.range && !o.solve) o.range = defaultRange(o.param, LEVELS[o.levelIndex][o.param]);
  // The campaign curve says what win rate this slot in the game should have.
  if (o.target === null) {
    const t = o.levelIndex / Math.max(1, LEVELS.length - 1);
    o.target = TARGETS.averageWinRateFirst +
      (TARGETS.averageWinRateLast - TARGETS.averageWinRateFirst) * t;
  }
  return o;
}

// A sensible span around whatever the level currently uses.
function defaultRange(param, current) {
  if (param === "hpScale") return [Math.max(0.5, current * 0.35), current * 1.2, current * 0.15];
  if (param === "startGold") return [current, current * 4, current * 0.35];
  return [current, current * 3, Math.max(1, Math.round(current * 0.25))];
}

function usage() {
  console.log(`
Sweep one level parameter and watch the win rate move.

  -l, --level N         1-based realm to tune                   (required)
  -p, --param NAME      ${TUNABLE.join(" | ")}          (default hpScale)
  -r, --range A:B:STEP  values to try            (default: a span around the current one)
      --solve           bisect for --target instead of sweeping
      --target RATE     desired average-skill win rate   (default: the campaign curve)
  -n, --trials N        runs per value per skill                (default 120)
  -s, --skill A,B       ${SKILL_NAMES.join(", ")}
  -d, --difficulty KEY  ${Object.keys(DIFFICULTIES).join(", ")}
      --hero KEY        ${Object.keys(HEROES).join(", ")}
      --upgrades JSON   star-store ranks
  -j, --jobs N          worker threads

Nothing is written to disk: levels.js is left alone, the sweep only patches
the level in memory. Read the answer off the table and apply it yourself.
`.trim());
}

// ---------------------------------------------------------------- running
function runCell(task) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(HERE, "worker.js"), { workerData: task });
    w.on("message", (m) => { if (m.type === "result") resolve(m.summary); });
    w.on("error", reject);
    w.on("exit", (code) => { if (code !== 0) reject(new Error(`worker exited with ${code}`)); });
  });
}

async function pool(tasks, limit) {
  const out = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; out[i] = await runCell(tasks[i]); }
  }));
  return out;
}

const cellTask = (o, value, skill) => ({
  levelIndex: o.levelIndex, skill, trials: o.trials, seed0: o.seed0,
  difficulty: o.difficulty, hero: o.hero, upgrades: o.upgrades, dt: o.dt,
  levelOverrides: { [o.param]: value },
});

// Evaluate one candidate value across every requested skill.
async function evaluate(o, value) {
  const sums = await pool(o.skills.map((s) => cellTask(o, value, s)), o.jobs);
  const by = {};
  o.skills.forEach((s, i) => { by[s] = sums[i]; });
  return by;
}

// ----------------------------------------------------------------- output
const BLOCKS = "·▁▂▃▄▅▆▇█";
const bar = (v) => BLOCKS[Math.max(0, Math.min(8, Math.round(v * 8)))].repeat(1) +
  "█".repeat(Math.round(v * 24)).padEnd(24, "·");

function fmtValue(param, v) {
  return param === "hpScale" ? v.toFixed(2) : String(Math.round(v));
}

async function sweep(o) {
  const [a, b, step] = o.range;
  const values = [];
  for (let v = a; v <= b + 1e-9; v += step) values.push(Number(v.toFixed(4)));
  if (!values.length) die("--range produced no values");

  const lv = LEVELS[o.levelIndex];
  console.log(`\n  Sweeping ${o.param} on realm ${o.levelIndex + 1} · ${lv.name} (${lv.difficulty})`);
  console.log(`  currently ${o.param}=${lv[o.param]} · target average win rate ${pct(o.target)} · ` +
    `${o.trials} runs per value per skill\n`);
  console.log("  " + o.param.padEnd(11) + o.skills.map((s) => s.slice(0, 7).padStart(9)).join("") +
    "   avg win rate");
  console.log("  " + "─".repeat(12 + o.skills.length * 9 + 28));

  let best = null;
  for (const v of values) {
    const by = await evaluate(o, v);
    const avg = by.average ?? by[o.skills[0]];
    const gap = Math.abs(avg.winRate - o.target);
    if (!best || gap < best.gap) best = { value: v, gap, winRate: avg.winRate };
    const cells = o.skills.map((s) => pct(by[s].winRate).padStart(9)).join("");
    const mark = v === lv[o.param] ? " ←now" : "";
    console.log("  " + fmtValue(o.param, v).padEnd(11) + cells + "   " + bar(avg.winRate) + mark);
  }

  console.log(`\n  Closest to target: ${o.param} = ${fmtValue(o.param, best.value)} ` +
    `→ ${pct(best.winRate)} average win rate (target ${pct(o.target)}).`);
  console.log(`  Currently ${o.param} = ${lv[o.param]}. Edit src/data/levels.js to apply.\n`);
}

// Bisection on the assumption that win rate is monotonic in the parameter:
// falling for hpScale, rising for startGold / startLives.
async function solve(o) {
  const lv = LEVELS[o.levelIndex];
  const rising = o.param !== "hpScale";
  let [lo, hi] = o.param === "hpScale"
    ? [0.25, Math.max(2, lv[o.param] * 1.5)]
    : [lv[o.param] * 0.5, lv[o.param] * 8];

  console.log(`\n  Solving ${o.param} on realm ${o.levelIndex + 1} · ${lv.name} ` +
    `for a ${pct(o.target)} average win rate (${o.trials} runs per probe)\n`);

  let bestValue = lv[o.param], bestGap = Infinity, bestRate = 0;
  for (let iter = 0; iter < 8; iter++) {
    const mid = (lo + hi) / 2;
    const by = await evaluate({ ...o, skills: ["average"] }, mid);
    const rate = by.average.winRate;
    const gap = Math.abs(rate - o.target);
    if (gap < bestGap) { bestGap = gap; bestValue = mid; bestRate = rate; }
    console.log(`  probe ${String(iter + 1).padStart(2)}  ${o.param}=${fmtValue(o.param, mid).padStart(8)}` +
      `  →  ${pct(rate).padStart(5)} win`);
    // Too many wins → push toward the harder side of the interval.
    if ((rate > o.target) === rising) hi = mid; else lo = mid;
    if (gap < 0.02) break;
  }
  console.log(`\n  Suggested ${o.param} = ${fmtValue(o.param, bestValue)} → about ${pct(bestRate)} ` +
    `average win rate (currently ${lv[o.param]}).\n`);
}

const o = parseArgs(process.argv);
await (o.solve ? solve(o) : sweep(o));
