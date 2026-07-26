// Turns summaries into verdicts.
//
// Every rule here encodes an opinion about what "the difficulty makes sense"
// means, and every one of those opinions is a constant you can argue with —
// they're all collected in TARGETS so they're easy to find and re-tune.
import { LEVELS, wavesFor } from "../../src/data/levels.js";
import { ENEMY_TYPES } from "../../src/data/enemyTypes.js";
import { TOWER_TYPES } from "../../src/data/towerTypes.js";
import { DIFFICULTIES } from "../../src/data/difficulties.js";
import { pathLength } from "../../src/geometry.js";
import { mean } from "./stats.js";

export const TARGETS = {
  // The intended win-rate curve for a mid-skill player, from the first realm
  // to the last. Everything else is measured against this shape.
  averageWinRateFirst: 0.95,
  averageWinRateLast: 0.40,
  averageWinRateTolerance: 0.20,

  noviceFirstLevelFloor: 0.70,   // the opening realm must not wall a beginner
  expertLastLevelFloor: 0.45,    // a strong player must be able to finish the game
  feasibilityFloor: 0.10,        // below this even `perfect` can't do it → broken

  trivialNoviceWinRate: 0.97,    // a novice basically can't lose…
  trivialFlawlessRate: 0.85,     // …and barely even leaks

  star3RateBand: [0.10, 0.70],   // 3 stars should be an achievement, not a default

  earlyWaveLeakCeiling: 0.15,    // waves 1-2 shouldn't bite before you can build
  waveSpikeJump: 0.35,           // wave-over-wave leak-rate jump that reads as a cliff
  waveDeathShareCeiling: 0.55,   // one wave causing most of a level's losses
  skillSpread: 0.08,             // expert-minus-novice win rate; below this, play doesn't matter

  openingPressureRatio: 2.5,     // wave-1 HP-per-gold vs. the first realm's
  idleGoldRatio: 0.60,           // mean unspent gold ÷ priciest tower → economy too loose
  buildoutFloor: 0.55,           // fraction of build spots filled by the end
  monotonicSlack: 0.10,          // how much a level may be *easier* than the one before
};

const pct = (x) => `${(x * 100).toFixed(0)}%`;

// ---------------------------------------------------------------- static
// Facts about a level you can read straight off its definition, no simulation
// needed. Cheap, and they catch the crude mistakes (a wave table that never
// ramps, a gold budget that can't buy the towers the level demands).
export function staticProfile(levelIndex, difficultyKey = "normal") {
  const lv = LEVELS[levelIndex];
  const diff = DIFFICULTIES[difficultyKey];
  const waves = wavesFor(lv);
  const cheapest = Math.min(...Object.values(TOWER_TYPES).map((t) => t.cost));

  let cumulativeReward = 0;
  const waveRows = waves.map((w, i) => {
    const hpMul = w.hpMul * lv.hpScale * diff.hpMul;
    let hp = 0, count = 0, reward = 0, spawnSeconds = 0, flyingHp = 0, armorWeighted = 0;
    for (const g of w.groups) {
      const d = ENEMY_TYPES[g.type];
      const groupHp = d.hp * hpMul * g.count;
      hp += groupHp;
      count += g.count;
      reward += d.reward * g.count;
      spawnSeconds = Math.max(spawnSeconds, g.count * g.gap);
      armorWeighted += d.armor * groupHp;
      if (d.flying) flyingHp += groupHp;
    }
    // Effective HP a non-magic tower has to chew through, armor included.
    const avgArmor = hp ? armorWeighted / hp : 0;
    const effectiveHp = hp / (1 - avgArmor);
    const goldBefore = Math.round(lv.startGold * diff.goldMul) + cumulativeReward;
    cumulativeReward += reward + (i < waves.length - 1 ? 30 : 0); // + wave-clear bonus
    return {
      wave: i + 1, hp, effectiveHp, avgArmor, count, reward, spawnSeconds,
      flyingShare: hp ? flyingHp / hp : 0,
      hpPerSecond: spawnSeconds ? hp / spawnSeconds : hp,
      goldBefore,
      affordableTowers: Math.floor(goldBefore / cheapest),
      // The core affordability ratio: enemy HP the player must chew through,
      // per gold they've been given to do it with. Comparable across levels
      // precisely because it divides out both sides of the economy.
      pressure: goldBefore ? effectiveHp / goldBefore : Infinity,
    };
  });

  return {
    levelIndex, id: lv.id, name: lv.name, label: lv.difficulty,
    hpScale: lv.hpScale,
    startGold: Math.round(lv.startGold * diff.goldMul),
    startLives: Math.round(lv.startLives * diff.livesMul),
    buildSpots: lv.spots.length,
    pathLength: Math.round(pathLength(lv.path)),
    waveCount: waves.length,
    totalHp: waveRows.reduce((a, r) => a + r.hp, 0),
    totalReward: waveRows.reduce((a, r) => a + r.reward, 0),
    customWaves: !!lv.waves,
    openingPressure: waveRows[0].pressure,
    peakPressure: Math.max(...waveRows.map((r) => r.pressure)),
    waves: waveRows,
  };
}

// Static checks — things that are wrong on paper, before anyone plays.
// These run per level and don't need simulation results.
export function checkStatic(profile, baseline) {
  const findings = [];
  const add = (severity, code, message) => findings.push({ severity, code, message });

  // Wave 1 arrives while the player still only has their starting purse. If
  // it demands several times more HP-per-gold than the opening realm does,
  // they simply cannot have built enough to meet it — no skill involved.
  const ratio = profile.openingPressure / baseline.openingPressure;
  if (ratio > TARGETS.openingPressureRatio)
    add("warn", "opening-unaffordable",
      `Wave 1 asks for ${profile.openingPressure.toFixed(1)} HP per starting gold — ${ratio.toFixed(1)}× the opening realm's ${baseline.openingPressure.toFixed(1)}. The first wave lands before any affordable defence can exist.`);

  // A level whose own wave 1 is harder than its wave 3 has no on-ramp.
  const w = profile.waves;
  if (w.length >= 3 && w[0].pressure > w[2].pressure * 1.1)
    add("info", "no-onramp",
      `Wave 1 (${w[0].pressure.toFixed(1)} HP/gold) is tougher than wave 3 (${w[2].pressure.toFixed(1)}) — the level starts at its hardest and eases off.`);

  return findings;
}

// ------------------------------------------------------------- per level
// `bySkill` maps skill name → summary (from stats.summarize).
export function checkLevel(bySkill, levelIndex, levelCount) {
  const findings = [];
  const add = (severity, code, message) => findings.push({ severity, code, message });

  const avg = bySkill.average;
  const nov = bySkill.novice;
  const exp = bySkill.expert;
  const perfect = bySkill.perfect;
  const lv = LEVELS[levelIndex];

  // --- is it even possible / is it a formality? ---
  if (perfect && perfect.winRate < TARGETS.feasibilityFloor)
    add("error", "infeasible",
      `Even a perfect player wins only ${pct(perfect.winRate)} of the time — this isn't hard, it's unwinnable with the tools the level provides.`);

  if (nov && nov.winRate >= TARGETS.trivialNoviceWinRate &&
      nov.lives.flawlessRate >= TARGETS.trivialFlawlessRate)
    add(levelIndex === 0 ? "info" : "warn", "trivial",
      `A novice wins ${pct(nov.winRate)} of runs and never loses a life in ${pct(nov.lives.flawlessRate)} of them — there's no challenge here at all.`);

  // --- the intended win-rate curve ---
  if (avg) {
    const t = levelCount > 1 ? levelIndex / (levelCount - 1) : 0;
    const target = TARGETS.averageWinRateFirst +
      (TARGETS.averageWinRateLast - TARGETS.averageWinRateFirst) * t;
    const delta = avg.winRate - target;
    if (Math.abs(delta) > TARGETS.averageWinRateTolerance)
      add("warn", delta > 0 ? "too-easy" : "too-hard",
        `Average-skill win rate is ${pct(avg.winRate)}; this slot in the campaign wants roughly ${pct(target)} (±${pct(TARGETS.averageWinRateTolerance)}).`);
  }

  if (levelIndex === 0 && nov && nov.winRate < TARGETS.noviceFirstLevelFloor)
    add("error", "harsh-opening",
      `First realm turns away beginners: novice win rate ${pct(nov.winRate)}, want at least ${pct(TARGETS.noviceFirstLevelFloor)}.`);

  if (levelIndex === levelCount - 1 && exp && exp.winRate < TARGETS.expertLastLevelFloor)
    add("warn", "unfinishable-finale",
      `Expert win rate on the final realm is ${pct(exp.winRate)}; a strong player should clear the campaign at least ${pct(TARGETS.expertLastLevelFloor)} of the time.`);

  // --- does playing well pay off? ---
  if (nov && exp && exp.winRate - nov.winRate < TARGETS.skillSpread &&
      avg && avg.winRate > 0.05 && avg.winRate < 0.95)
    add("warn", "skill-insensitive",
      `Expert and novice win rates are within ${pct(Math.abs(exp.winRate - nov.winRate))} of each other — the outcome barely responds to how well the level is played.`);

  // --- star thresholds ---
  if (avg) {
    const [lo, hi] = TARGETS.star3RateBand;
    if (avg.stars.rate3 > hi)
      add("info", "stars-cheap", `${pct(avg.stars.rate3)} of average-skill runs get 3 stars — the top rating means little here.`);
    else if (avg.winRate > 0.3 && avg.stars.rate3 < lo)
      add("info", "stars-unreachable", `Only ${pct(avg.stars.rate3)} of average-skill runs manage 3 stars.`);
  }

  // --- the shape of the level, wave by wave ---
  if (avg) {
    const reached = avg.perWave.filter((w) => w.reached >= Math.max(10, avg.n * 0.05));

    for (const w of reached.filter((w) => w.wave <= 2))
      if (w.leakRate > TARGETS.earlyWaveLeakCeiling)
        add("warn", "front-loaded",
          `Wave ${w.wave} already leaks in ${pct(w.leakRate)} of runs — players are being punished before they've had a chance to build.`);

    // A cliff: leak rate jumping far above everything that came before it.
    let runningMax = 0;
    for (const w of reached) {
      if (w.leakRate - runningMax > TARGETS.waveSpikeJump)
        add("warn", "difficulty-cliff",
          `Wave ${w.wave} spikes: leak rate jumps from ${pct(runningMax)} to ${pct(w.leakRate)}. The ramp into it is too steep.`);
      runningMax = Math.max(runningMax, w.leakRate);
    }

    // One wave doing all the killing.
    for (const w of reached)
      if (w.deathShare > TARGETS.waveDeathShareCeiling && avg.winRate < 0.95)
        add("warn", "single-wall",
          `Wave ${w.wave} accounts for ${pct(w.deathShare)} of every loss on this level — it's a wall, not a curve.`);

    // The finale should be the peak.
    if (reached.length >= 3 && avg.winRate > 0.2) {
      const last = reached[reached.length - 1];
      const prior = reached.slice(0, -1);
      const hardest = prior.reduce((a, w) => (w.leakRate > a.leakRate ? w : a));
      if (hardest.leakRate > last.leakRate + 0.15)
        add("info", "anticlimax",
          `Wave ${hardest.wave} (leak ${pct(hardest.leakRate)}) is harder than the final wave ${last.wave} (${pct(last.leakRate)}) — the level peaks early.`);
    }
  }

  // --- economy ---
  if (exp) {
    const priciest = Math.max(...Object.values(TOWER_TYPES).map((t) => t.cost));
    if (exp.goldIdleMean / priciest > TARGETS.idleGoldRatio)
      add("info", "economy-loose",
        `An expert still sits on ${exp.goldIdleMean.toFixed(0)} unspent gold on average (${(exp.goldIdleMean / priciest).toFixed(1)}× the priciest tower) — the level hands out more money than it gives you to do with it.`);
    const buildout = exp.towerCountMean / lv.spots.length;
    if (buildout < TARGETS.buildoutFloor && exp.winRate > 0.2)
      add("info", "economy-tight",
        `Experts finish with only ${exp.towerCountMean.toFixed(1)} of ${lv.spots.length} build spots used (${pct(buildout)}) — most of the map never comes into play.`);
  }

  return findings;
}

// ------------------------------------------------------- across the campaign
// The campaign has to get harder. A level that's easier than the one before
// it is a bug in the ordering even if the level itself is well-tuned.
export function checkProgression(perLevel) {
  const findings = [];
  const rows = perLevel
    .filter((r) => r.bySkill.average)
    .map((r) => ({ index: r.levelIndex, name: LEVELS[r.levelIndex].name,
                   label: LEVELS[r.levelIndex].difficulty, winRate: r.bySkill.average.winRate }));

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1], cur = rows[i];
    if (cur.winRate > prev.winRate + TARGETS.monotonicSlack)
      findings.push({
        severity: "warn", code: "non-monotonic", levelIndex: cur.index,
        message: `${cur.name} (${cur.label}) is easier than ${prev.name} (${prev.label}) that precedes it: ${pct(cur.winRate)} vs ${pct(prev.winRate)} win rate.`,
      });
  }

  // Flat stretches: three realms in a row that play identically.
  for (let i = 2; i < rows.length; i++) {
    const w = [rows[i - 2], rows[i - 1], rows[i]].map((r) => r.winRate);
    if (Math.max(...w) - Math.min(...w) < 0.05)
      findings.push({
        severity: "info", code: "flat-progression", levelIndex: rows[i].index,
        message: `${rows[i - 2].name} → ${rows[i].name} all land within ${pct(Math.max(...w) - Math.min(...w))} of each other — three realms that feel the same.`,
      });
  }

  return findings;
}

// Overall grade for one level, from its findings.
export function grade(findings) {
  if (findings.some((f) => f.severity === "error")) return "BROKEN";
  const warns = findings.filter((f) => f.severity === "warn").length;
  if (warns >= 3) return "POOR";
  if (warns >= 1) return "NEEDS WORK";
  if (findings.length) return "OK";
  return "GOOD";
}

export { pct };
