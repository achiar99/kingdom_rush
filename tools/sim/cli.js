#!/usr/bin/env node
// Entry point for the balance harness.
//
//   node tools/sim/cli.js                          every realm, 300 runs per skill
//   node tools/sim/cli.js --trials 1000            the full 1000-run sweep
//   node tools/sim/cli.js --level 9 --waves        one realm, wave-by-wave detail
//   node tools/sim/cli.js --difficulty hard --hero mage
//   node tools/sim/cli.js --json out/balance.json  machine-readable dump
//
// Run `--help` for the complete list.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { LEVELS } from "../../src/data/levels.js";
import { DIFFICULTIES } from "../../src/data/difficulties.js";
import { HEROES } from "../../src/data/hero.js";
import { SKILL_NAMES } from "./bot.js";
import { DEFAULT_DT } from "./harness.js";
import { staticProfile, checkStatic, checkLevel, checkProgression } from "./analyze.js";
import * as report from "./report.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------- args
function parseArgs(argv) {
  const o = {
    trials: 300,
    levels: null,               // null = all
    skills: [...SKILL_NAMES],
    difficulty: "normal",
    hero: "knight",
    upgrades: {},
    dt: DEFAULT_DT,
    seed0: 1,
    waves: false,
    json: null,
    color: process.stdout.isTTY,
    jobs: Math.max(1, Math.min(os.cpus().length - 1, 12)),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--trials": case "-n": o.trials = Number(next()); break;
      case "--level": case "-l":
        // 1-based on the command line, to match how levels are numbered in game
        o.levels = next().split(",").map((s) => Number(s.trim()) - 1); break;
      case "--skill": case "-s": o.skills = next().split(",").map((s) => s.trim()); break;
      case "--difficulty": case "-d": o.difficulty = next(); break;
      case "--hero": o.hero = next(); break;
      case "--upgrades": o.upgrades = JSON.parse(next()); break;
      case "--dt": o.dt = Number(next()); break;
      case "--seed": o.seed0 = Number(next()); break;
      case "--waves": case "-w": o.waves = true; break;
      case "--json": o.json = next(); break;
      case "--jobs": case "-j": o.jobs = Number(next()); break;
      case "--no-color": o.color = false; break;
      case "--help": case "-h": usage(); process.exit(0);
      default: die(`unknown option: ${a}  (try --help)`);
    }
  }

  if (!Number.isFinite(o.trials) || o.trials < 1) die("--trials must be a positive number");
  if (!DIFFICULTIES[o.difficulty]) die(`--difficulty must be one of: ${Object.keys(DIFFICULTIES).join(", ")}`);
  if (!HEROES[o.hero]) die(`--hero must be one of: ${Object.keys(HEROES).join(", ")}`);
  for (const s of o.skills) if (!SKILL_NAMES.includes(s)) die(`--skill must be from: ${SKILL_NAMES.join(", ")}`);
  o.levels = (o.levels ?? LEVELS.map((_, i) => i)).filter((i) => {
    if (i >= 0 && i < LEVELS.length) return true;
    die(`--level out of range: ${i + 1} (have 1..${LEVELS.length})`);
  });
  return o;
}

function usage() {
  console.log(`
Tower Realm balance harness — plays whole levels headlessly and reports on
whether their difficulty holds up.

  -n, --trials N        runs per level per skill        (default 300)
  -l, --level  A,B      1-based realms to test          (default all ${LEVELS.length})
  -s, --skill  A,B      ${SKILL_NAMES.join(", ")}
  -d, --difficulty KEY  ${Object.keys(DIFFICULTIES).join(", ")}          (default normal)
      --hero KEY        ${Object.keys(HEROES).join(", ")}
      --upgrades JSON   star-store ranks, e.g. '{"archer":2,"magic":1}'
      --dt SECONDS      simulation timestep             (default ${DEFAULT_DT.toFixed(4)})
      --seed N          first RNG seed                  (default 1)
  -w, --waves           print the per-wave table
  -j, --jobs N          worker threads                  (default cores-1)
      --json PATH       write the full result set as JSON
      --no-color        plain output

The simulation itself is deterministic; all run-to-run variance comes from the
simulated player. 'perfect' isn't a difficulty setting — it's the feasibility
bound: if it can't clear a level, no human can.
`.trim());
}

const die = (msg) => { console.error(`error: ${msg}`); process.exit(1); };

// ------------------------------------------------------------- worker pool
// `task` must stay structured-cloneable — it becomes workerData verbatim — so
// the progress callback is passed alongside it rather than inside it.
function runCell(task, onProgress) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(HERE, "worker.js"), { workerData: task });
    w.on("message", (m) => {
      if (m.type === "progress") onProgress(m.done);
      else if (m.type === "result") resolve(m.summary);
    });
    w.on("error", reject);
    w.on("exit", (code) => { if (code !== 0) reject(new Error(`worker exited with ${code}`)); });
  });
}

async function pool(tasks, limit, onProgress) {
  const results = new Array(tasks.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await runCell(tasks[i], onProgress);
    }
  });
  await Promise.all(runners);
  return results;
}

// -------------------------------------------------------------------- main
async function main() {
  const opts = parseArgs(process.argv);
  report.setColor(opts.color);

  const tasks = [];
  for (const levelIndex of opts.levels)
    for (const skill of opts.skills)
      tasks.push({
        levelIndex, skill, trials: opts.trials, seed0: opts.seed0,
        difficulty: opts.difficulty, hero: opts.hero, upgrades: opts.upgrades, dt: opts.dt,
      });

  const total = tasks.length * opts.trials;
  let done = 0;
  const tick = (n) => {
    done += n;
    if (!process.stderr.isTTY) return;
    const frac = done / total;
    const bar = "█".repeat(Math.round(frac * 30)).padEnd(30, "·");
    process.stderr.write(`\r  simulating ${bar} ${done}/${total}`);
  };
  const started = Date.now();
  const summaries = await pool(tasks, opts.jobs, tick);
  if (process.stderr.isTTY) process.stderr.write("\r" + " ".repeat(60) + "\r");
  const elapsed = (Date.now() - started) / 1000;

  // Realm 1 is the yardstick the static affordability checks compare against.
  const baseline = staticProfile(0, opts.difficulty);

  // Regroup flat cell results into one row per level.
  const perLevel = opts.levels.map((levelIndex) => {
    const bySkill = {};
    tasks.forEach((t, i) => {
      if (t.levelIndex === levelIndex) bySkill[t.skill] = summaries[i];
    });
    const profile = staticProfile(levelIndex, opts.difficulty);
    return {
      levelIndex,
      bySkill,
      static: profile,
      findings: [
        ...checkStatic(profile, baseline),
        ...checkLevel(bySkill, levelIndex, LEVELS.length),
      ],
    };
  });
  const progression = opts.levels.length > 1 ? checkProgression(perLevel) : [];

  // ------------------------------------------------------------- output
  const out = [];
  out.push(report.header(opts, tasks.length));
  if (opts.levels.length > 1) out.push(report.campaignTable(perLevel, opts.skills));
  for (const row of perLevel) out.push(report.levelSection(row, opts.skills, opts.waves));
  if (opts.levels.length > 1) out.push(report.progressionSection(progression));
  out.push(report.summaryLine(perLevel));
  console.log(out.join("\n"));
  console.error(`  ${total.toLocaleString()} playthroughs in ${elapsed.toFixed(1)}s ` +
    `(${Math.round(total / elapsed)}/s across ${Math.min(opts.jobs, tasks.length)} threads)`);

  if (opts.json) {
    fs.mkdirSync(path.dirname(path.resolve(opts.json)), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify({
      generatedAt: new Date().toISOString(),
      options: opts,
      levels: perLevel,
      progression,
    }, null, 2));
    console.error(`  wrote ${opts.json}`);
  }

  // Non-zero exit when something is outright broken, so this can gate CI.
  const broken = perLevel.some((r) => r.findings.some((f) => f.severity === "error"));
  process.exit(broken ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
