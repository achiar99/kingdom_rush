// Console formatting for the balance report. Nothing here computes anything —
// it only decides what's worth showing.
import { LEVELS } from "../../src/data/levels.js";
import { TARGETS, grade, pct, targetWinRate } from "./analyze.js";

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m",
  cyan: "\x1b[36m", grey: "\x1b[90m", magenta: "\x1b[35m",
};
let color = true;
export const setColor = (on) => { color = on; };
const c = (code, s) => (color ? code + s + C.reset : String(s));

const GRADE_COLOR = {
  GOOD: C.green, OK: C.green, "NEEDS WORK": C.yellow, POOR: C.yellow, BROKEN: C.red,
};
const SEV = {
  error: { icon: "✗", col: C.red }, warn: { icon: "▲", col: C.yellow }, info: { icon: "·", col: C.grey },
};

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const rule = (ch = "─", n = 78) => c(C.grey, ch.repeat(n));

// A 0-1 value as one of eight block characters — lets a whole wave curve sit
// on a single line where the shape is what matters, not the digits.
const BLOCKS = "·▁▂▃▄▅▆▇█";
const spark = (v) => (v <= 0 ? BLOCKS[0] : BLOCKS[Math.max(1, Math.min(8, Math.round(v * 8)))]);

export function header(opts, cells) {
  const lines = [
    "",
    c(C.bold + C.cyan, "  TOWER REALM — LEVEL BALANCE REPORT"),
    c(C.grey, `  ${opts.trials} runs × ${cells} level/skill cells = ${(opts.trials * cells).toLocaleString()} playthroughs`),
    c(C.grey, `  difficulty: ${opts.difficulty} · hero: ${opts.hero} · store upgrades: ${
      Object.keys(opts.upgrades).length ? JSON.stringify(opts.upgrades) : "none"} · dt: ${opts.dt.toFixed(4)}s`),
    "",
  ];
  return lines.join("\n");
}

// ------------------------------------------------------------ campaign table
export function campaignTable(perLevel, skills) {
  const out = [];
  out.push(c(C.bold, "  CAMPAIGN CURVE") + c(C.grey, "   win rate by player skill"));
  out.push("  " + rule());
  out.push("  " + c(C.grey,
    pad("#", 3) + pad("Realm", 20) + pad("Label", 12) +
    skills.map((s) => lpad(s.slice(0, 7), 8)).join("") +
    lpad("target", 8) + "  " + "grade"));

  for (const row of perLevel) {
    const lv = LEVELS[row.levelIndex];
    const target = targetWinRate(row.levelIndex);
    const g = grade(row.findings);
    const cells = skills.map((s) => {
      const sum = row.bySkill[s];
      if (!sum) return lpad("—", 8);
      const v = pct(sum.winRate);
      // Flag the average column against its target, since that's the one the
      // campaign curve is actually specified in terms of.
      if (s === "average") {
        const off = Math.abs(sum.winRate - target) > TARGETS.averageWinRateTolerance;
        return c(off ? C.yellow : C.green, lpad(v, 8));
      }
      return lpad(v, 8);
    }).join("");

    out.push("  " +
      pad(row.levelIndex + 1, 3) + pad(lv.name, 20) + c(C.grey, pad(lv.difficulty, 12)) +
      cells + c(C.grey, lpad(pct(target), 8)) + "  " + c(GRADE_COLOR[g] || "", g));
  }
  out.push("");
  return out.join("\n");
}

// --------------------------------------------------------------- per level
export function levelSection(row, skills, showWaves) {
  const lv = LEVELS[row.levelIndex];
  const avg = row.bySkill.average;
  const g = grade(row.findings);
  const out = [];

  out.push("  " + rule("═"));
  out.push("  " + c(C.bold, `${row.levelIndex + 1}. ${lv.name}`) +
    c(C.grey, `  ${lv.difficulty} · hpScale ${lv.hpScale} · ${row.static.startGold}g · ` +
      `${row.static.startLives} lives · ${row.static.waveCount} waves · ` +
      `${row.static.buildSpots} spots${row.static.customWaves ? "" : " · shared wave table"} · ` +
      `opening ${row.static.openingPressure.toFixed(1)} HP/gold`) +
    "   " + c(GRADE_COLOR[g] || "", `[${g}]`));

  if (avg) {
    out.push("     " + c(C.grey, "average run: ") +
      `lives ${avg.lives.mean.toFixed(1)}/${avg.lives.start}` +
      c(C.grey, ` (p10 ${avg.lives.p10.toFixed(0)}, p90 ${avg.lives.p90.toFixed(0)})`) +
      ` · 3★ ${pct(avg.stars.rate3)} · flawless ${pct(avg.lives.flawlessRate)}` +
      ` · ${avg.towerCountMean.toFixed(1)}/${row.static.buildSpots} spots used` +
      ` · hero Lv${avg.heroLevelMean.toFixed(1)}` +
      ` · ${(avg.durationMean / 60).toFixed(1)} min`);
    if (avg.timeoutRate > 0.01)
      out.push("     " + c(C.yellow, `${pct(avg.timeoutRate)} of runs hit the 20-minute cutoff without resolving.`));
  }

  // Wave curve: leak rate per wave, as a sparkline plus the raw numbers.
  if (avg) {
    const reached = avg.perWave.filter((w) => w.reached > 0);
    out.push("     " + c(C.grey, "leak/wave  ") +
      reached.map((w) => spark(w.leakRate)).join("") +
      c(C.grey, `  (wave 1..${reached.length})`));
    if (showWaves) out.push(waveTable(row, avg));
  }

  for (const f of row.findings) {
    const s = SEV[f.severity];
    out.push("     " + c(s.col, s.icon + " ") + c(s.col, f.message));
  }
  if (!row.findings.length) out.push("     " + c(C.green, "✓ nothing to flag."));
  out.push("");
  return out.join("\n");
}

function waveTable(row, avg) {
  const out = [];
  out.push("     " + c(C.grey,
    pad("wave", 6) + lpad("HP", 8) + lpad("creeps", 7) + lpad("armor", 7) + lpad("fly", 6) +
    lpad("reach", 7) + lpad("leak", 7) + lpad("deaths", 7) + lpad("lives-", 7) +
    lpad("closest", 8) + lpad("gold", 7) + lpad("towers", 7)));
  for (const w of avg.perWave) {
    const st = row.static.waves[w.wave - 1];
    if (!w.reached) {
      out.push("     " + pad(w.wave, 6) + c(C.grey, lpad("— never reached —", 40)));
      continue;
    }
    // "closest" is how far along the path the furthest creep got, averaged:
    // 1.00 means creeps were reaching the castle.
    const danger = w.leakRate > 0.5 ? C.red : w.leakRate > 0.2 ? C.yellow : C.reset;
    out.push("     " +
      pad(w.wave, 6) +
      lpad(Math.round(st.hp).toLocaleString(), 8) +
      lpad(st.count, 7) +
      lpad(pct(st.avgArmor), 7) +
      lpad(pct(st.flyingShare), 6) +
      lpad(pct(w.reachRate), 7) +
      c(danger, lpad(pct(w.leakRate), 7)) +
      lpad(pct(w.deathRate), 7) +
      lpad(w.livesLostMean.toFixed(1), 7) +
      lpad(w.maxProgressMean.toFixed(2), 8) +
      lpad(Math.round(w.goldAtStartMean), 7) +
      lpad(w.towersMean.toFixed(1), 7));
  }
  return out.join("\n");
}

export function progressionSection(findings) {
  if (!findings.length) return "  " + c(C.green, "✓ Campaign difficulty rises monotonically.") + "\n";
  const out = ["  " + c(C.bold, "CAMPAIGN PROGRESSION"), "  " + rule()];
  for (const f of findings) {
    const s = SEV[f.severity];
    out.push("  " + c(s.col, s.icon + " ") + c(s.col, f.message));
  }
  out.push("");
  return out.join("\n");
}

export function summaryLine(perLevel) {
  const grades = perLevel.map((r) => grade(r.findings));
  const counts = {};
  for (const g of grades) counts[g] = (counts[g] || 0) + 1;
  const parts = Object.entries(counts).map(([g, n]) => c(GRADE_COLOR[g] || "", `${n} ${g}`));
  return "  " + c(C.bold, "VERDICT  ") + parts.join(c(C.grey, " · ")) + "\n";
}
