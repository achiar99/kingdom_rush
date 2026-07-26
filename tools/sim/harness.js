// Runs one complete playthrough of one level, headlessly, and records what
// happened. This is the real game — src/simulation.js's update() driven at a
// fixed timestep — with a bot on the controls instead of a mouse.
import { LEVELS, wavesFor } from "../../src/data/levels.js";
import { DIFFICULTIES } from "../../src/data/difficulties.js";
import { HEROES, DEFAULT_HERO } from "../../src/data/hero.js";
import { state, loadLevel, LEVEL, PATH_LEN } from "../../src/state.js";
import { setProgressForSimulation } from "../../src/save.js";
import { installSimHooks } from "../../src/simHooks.js";
import { update, resetRun } from "../../src/simulation.js";
import { Bot, SKILL_PROFILES } from "./bot.js";
import { Rng } from "./rng.js";

// simHooks is a module-level singleton, so the outcome lands in this box and
// runTrial picks it up. One install per process is enough.
const lastOutcome = { won: false, stars: 0 };
installSimHooks({
  onGameOver(won, stars) { lastOutcome.won = won; lastOutcome.stars = stars; },
});

export const DEFAULT_DT = 1 / 30;   // fine enough to match play, coarse enough to be fast
const MAX_GAME_SECONDS = 20 * 60;   // a run this long is stuck, not hard

export function runTrial({
  levelIndex,
  skill = "average",
  difficulty = "normal",
  hero = DEFAULT_HERO,
  upgrades = {},          // star-store ranks, e.g. { archer: 2 }
  seed = 1,
  dt = DEFAULT_DT,
  // Fields to patch onto the level definition before the run — how tune.js
  // sweeps hpScale / startGold / startLives without editing levels.js.
  levelOverrides = null,
} = {}) {
  const profile = SKILL_PROFILES[skill];
  if (!profile) throw new Error(`unknown skill profile: ${skill}`);
  if (!DIFFICULTIES[difficulty]) throw new Error(`unknown difficulty: ${difficulty}`);
  if (!HEROES[hero]) throw new Error(`unknown hero: ${hero}`);

  // Configure the run the way a save slot would, then boot the level.
  setProgressForSimulation({ difficulty, hero, upgrades, unlocked: levelIndex + 1 });
  if (levelOverrides) Object.assign(LEVELS[levelIndex], levelOverrides);
  loadLevel(levelIndex);
  resetRun();
  lastOutcome.won = false;
  lastOutcome.stars = 0;

  const bot = new Bot(new Rng(seed), profile);
  const waveCount = wavesFor(LEVEL).length;
  const livesStart = state.lives;

  // --- per-wave bookkeeping -------------------------------------------------
  const waves = [];
  let cur = null;                 // the wave record currently being filled in
  let goldSpentTotal = 0, goldEarnedTotal = 0;
  let prevGold = state.gold, prevLives = state.lives, prevWaveIndex = -1;
  let idleGoldSum = 0, idleGoldSamples = 0;
  let heroDeaths = 0, heroWasAlive = true;
  let peakHeroLevel = 1;
  let t = 0;

  const openWave = () => {
    cur = {
      wave: state.waveIndex + 1,
      livesLost: 0,
      durationSec: 0,
      goldAtStart: state.gold,
      towersAtStart: state.towers.length,
      investedAtStart: state.towers.reduce((a, x) => a + x.invested, 0),
      peakEnemies: 0,
      peakHpOnField: 0,
      maxProgress: 0,             // furthest any creep got, as a fraction of the path
    };
  };
  const closeWave = () => { if (cur) { waves.push(cur); cur = null; } };

  // --- main loop ------------------------------------------------------------
  while (!state.over && t < MAX_GAME_SECONDS) {
    bot.tick(dt);

    // A new wave started this frame.
    if (state.running && state.waveIndex !== prevWaveIndex) {
      closeWave();
      openWave();
      prevWaveIndex = state.waveIndex;
    }

    update(dt);
    t += dt;

    // Gold moved: kills and the wave-clear bonus are income, anything else is
    // the bot buying something.
    const dGold = state.gold - prevGold;
    if (dGold > 0) goldEarnedTotal += dGold; else goldSpentTotal -= dGold;
    prevGold = state.gold;

    const lost = prevLives - state.lives;
    if (lost > 0 && cur) cur.livesLost += lost;
    prevLives = state.lives;

    const hero = state.hero;
    if (hero) {
      if (heroWasAlive && !hero.alive) heroDeaths++;
      heroWasAlive = hero.alive;
      if (hero.level > peakHeroLevel) peakHeroLevel = hero.level;
    }

    if (cur && state.running) {
      cur.durationSec += dt;
      let hpOnField = 0, maxProg = 0;
      for (const e of state.enemies) {
        if (e.dead) continue;
        hpOnField += e.hp;
        const prog = e.dist / PATH_LEN;
        if (prog > maxProg) maxProg = prog;
      }
      if (state.enemies.length > cur.peakEnemies) cur.peakEnemies = state.enemies.length;
      if (hpOnField > cur.peakHpOnField) cur.peakHpOnField = hpOnField;
      if (maxProg > cur.maxProgress) cur.maxProgress = maxProg;
      // Gold sitting unspent mid-fight is the clearest signal of a level
      // handing out more money than it gives you anything to do with.
      idleGoldSum += state.gold;
      idleGoldSamples++;
    }
  }
  closeWave();

  const timedOut = !state.over;
  const towerMix = {};
  for (const tw of state.towers) towerMix[tw.type] = (towerMix[tw.type] || 0) + 1;
  const firstLeak = waves.find((w) => w.livesLost > 0);

  return {
    levelIndex, levelId: LEVEL.id, skill, difficulty, hero, seed,
    won: lastOutcome.won && !timedOut,
    stars: lastOutcome.won ? lastOutcome.stars : 0,
    timedOut,
    livesStart, livesEnd: Math.max(0, state.lives),
    livesLost: livesStart - Math.max(0, state.lives),
    gameSeconds: t,
    wavesTotal: waveCount,
    wavesCleared: lastOutcome.won ? waveCount : Math.max(0, state.waveIndex),
    lossWave: lastOutcome.won || timedOut ? null : state.waveIndex + 1,
    firstLeakWave: firstLeak ? firstLeak.wave : null,
    goldEarned: goldEarnedTotal,
    goldSpent: goldSpentTotal,
    goldIdleMean: idleGoldSamples ? idleGoldSum / idleGoldSamples : 0,
    towerCount: state.towers.length,
    towerMix,
    investedEnd: state.towers.reduce((a, x) => a + x.invested, 0),
    heroLevel: peakHeroLevel,
    heroDeaths,
    waves,
  };
}

// Run the same level many times, varying only the seed (and therefore only
// the player). Returns the raw trials; aggregation lives in analyze.js.
export function runBatch({ trials = 1000, seed0 = 1, ...opts }) {
  const out = [];
  for (let i = 0; i < trials; i++) out.push(runTrial({ ...opts, seed: seed0 + i }));
  return out;
}
