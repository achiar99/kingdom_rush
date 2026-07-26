// Wave tables, generated per level from its stage.
//
// Hand-written wave lists were what broke the old campaign: the last three
// realms each got a bespoke table, and every one of them opened harder than
// the player could possibly afford (see tools/sim — wave 1 was asking nine
// enemy HP per starting gold). Generating them fixes that class of mistake by
// construction, because the opening of every level is derived from the same
// rule instead of being retyped fifty times.
//
// Waves name ROLES, never creatures. The stage's kit decides what actually
// walks down the road — see data/enemyKits.js.
import { ROLES } from "./enemyKits.js";
import { LEVELS_PER_STAGE, stageProgress } from "./stages.js";

// mulberry32, seeded per level so a level's waves never change under a player.
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// When each role first appears, as a fraction of the way through a stage.
// Stage 1 has to teach the whole vocabulary, so it introduces roles slowly;
// later stages assume you know what a brute is and field them immediately.
const INTRO_FIRST_STAGE = { swarm: 0, swift: 0.1, shielded: 0.2, winged: 0.3, brute: 0.45, champion: 0.7 };
// Later stages field everything from their first level — including champions.
// Holding champions back to the middle of a stage put a cliff there: the
// balance fitter needed a *lower* hpScale for a stage's last level than its
// first to compensate, which is nonsense to read and impossible to tune.
const INTRO_LATER = { swarm: 0, swift: 0, shielded: 0, winged: 0, brute: 0, champion: 0 };

// Spawn gap and squad size per role — a runner rush is twenty creeps a third
// of a second apart; brutes come in threes with a long beat between them.
const SHAPE = {
  swarm:    { gap: [0.9, 0.5], count: [6, 12] },
  swift:    { gap: [0.42, 0.24], count: [6, 16] },
  shielded: { gap: [0.8, 0.45], count: [4, 10] },
  brute:    { gap: [1.5, 0.85], count: [2, 6] },
  winged:   { gap: [0.7, 0.36], count: [4, 12] },
  champion: { gap: [3.0, 1.6], count: [1, 3] },
};

const lerp = (a, b, t) => a + (b - a) * t;
const pickInt = (pair, t, rand, jitter = 0.18) =>
  Math.max(1, Math.round(lerp(pair[0], pair[1], t) * (1 - jitter / 2 + rand() * jitter)));

// Roles unlocked at this point in the campaign, hardest-first so wave
// composition can lead with the headline threat.
function availableRoles(stageIndex, levelInStage) {
  const t = stageProgress(levelInStage);
  const intro = stageIndex === 0 ? INTRO_FIRST_STAGE : INTRO_LATER;
  return ROLES.filter((r) => t >= intro[r]);
}

// One level's worth of waves.
//
// The shape every level follows: a soft opening the starting purse can
// actually answer, a middle that introduces one new pressure at a time, and
// a finale that is the hardest thing in the level. `hpMul` climbing from 1.0
// is what makes wave 8 bite when wave 1 didn't — the level's own hpScale
// multiplies all of it.
// How much *work* each role asks of the player's towers, in "hpScale = 1"
// units. Three things decide that, and using HP alone gets it badly wrong:
//
//   hp        — what has to be removed
//   speed     — a Peltast at 108 crosses the map in half the time a Levy at
//               55 does, so the same towers get half as many shots at it
//   armour    — 55% armour more than doubles the damage a non-Oracle needs
//
// Weighing by HP alone is what let two neighbouring levels measure 100% and
// 0%: one had 48 swift creeps and the other 93, which looked near-identical
// by HP and was nothing of the kind in play.
const ROLE = {
  swarm:    { hp: 45,   speed: 55,  armor: 0 },
  swift:    { hp: 26,   speed: 108, armor: 0 },
  shielded: { hp: 70,   speed: 48,  armor: 0.55 },
  brute:    { hp: 190,  speed: 34,  armor: 0.2 },
  winged:   { hp: 52,   speed: 74,  armor: 0 },
  champion: { hp: 1100, speed: 26,  armor: 0.35 },
};
const BASE_SPEED = 55;
const roleWeight = (r) => (ROLE[r].hp * (ROLE[r].speed / BASE_SPEED)) / (1 - ROLE[r].armor);

const waveWeight = (w) =>
  w.groups.reduce((a, g) => a + g.count * roleWeight(g.type), 0) * w.hpMul;

// Two numbers that decide how a table plays, both independent of hpScale:
// how much total HP it asks for per wave, and how big its single worst wave
// is. Leaving these unconstrained is what made adjacent levels measure 0% and
// 100% at identical enemy HP — one table had rolled a triple-champion finale
// and its neighbour hadn't.
export function tableProfile(waves) {
  const weights = waves.map(waveWeight);
  return {
    perWave: weights.reduce((a, b) => a + b, 0) / waves.length,
    peak: Math.max(...weights),
  };
}

// Generate a spread of candidate tables and keep the most typical one.
//
// Fixed bands don't work here: a stage-I level with no champions unlocked is
// legitimately a quarter the weight of a stage-V finale, so any single
// threshold either rejects everything or nothing. Taking the median of the
// level's *own* candidates self-calibrates — it keeps whatever is normal for
// this level's wave count and role set, and throws away the roll that
// happened to stack three champions into the finale.
//
// This is the wave-table twin of the map validator: same problem (unchecked
// generation producing 0%-and-100% neighbours), same shape of fix.
const CANDIDATES = 25;

export function generateWaves(opts) {
  const { seed } = opts;
  const pool = Array.from({ length: CANDIDATES }, (_, i) => {
    const waves = buildTable({ ...opts, seed: seed + i * 7717 });
    return { waves, profile: tableProfile(waves) };
  });

  const medianOf = (pick) => {
    const xs = pool.map((c) => pick(c.profile)).sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)];
  };
  const midPerWave = medianOf((p) => p.perWave);
  const midPeak = medianOf((p) => p.peak);

  // Closest to the middle on both axes at once, each measured relatively so
  // neither dominates.
  let best = pool[0], bestMiss = Infinity;
  for (const c of pool) {
    const miss = Math.abs(c.profile.perWave - midPerWave) / midPerWave +
                 Math.abs(c.profile.peak - midPeak) / midPeak;
    if (miss < bestMiss) { bestMiss = miss; best = c; }
  }
  return best.waves;
}

function buildTable({ stageIndex, levelInStage, waveCount, seed }) {
  const rand = rng(seed);
  const roles = availableRoles(stageIndex, levelInStage);
  const canChampion = roles.includes("champion");
  const fodder = roles.filter((r) => r !== "champion");
  const waves = [];

  for (let w = 0; w < waveCount; w++) {
    const t = waveCount === 1 ? 1 : w / (waveCount - 1);   // 0..1 through the level
    const last = w === waveCount - 1;

    // Difficulty ramp within the level. The curve is deliberately gentle up
    // front and steep at the end: the first two waves are build-up time.
    const hpMul = Number((1.0 + 1.15 * Math.pow(t, 1.35)).toFixed(3));
    const speedMul = Number((1.0 + 0.28 * Math.pow(t, 1.6)).toFixed(3));

    // How many distinct roles share this wave — one early, three or four by
    // the end, so late waves need an answer to several threats at once.
    const variety = Math.min(fodder.length, 1 + Math.floor(t * 2.6 + rand() * 0.7));

    // Rotate which roles lead, so consecutive waves don't repeat themselves.
    const order = [...fodder].sort(() => rand() - 0.5);
    const chosen = order.slice(0, variety);

    const groups = chosen.map((role) => {
      const sh = SHAPE[role];
      return {
        type: role,
        count: pickInt(sh.count, t, rand),
        gap: Number(lerp(sh.gap[0], sh.gap[1], t).toFixed(2)),
      };
    });

    // Champions headline the finale, and show up once or twice before it in
    // the back half of a level so the finale isn't the first one you meet.
    const championWave = canChampion && (last || (t > 0.55 && rand() < 0.22));
    if (championWave) {
      const sh = SHAPE.champion;
      groups.unshift({
        type: "champion",
        count: last ? pickInt(sh.count, t, rand, 0) : 1,
        gap: Number(lerp(sh.gap[0], sh.gap[1], t).toFixed(2)),
      });
    }

    waves.push({ hpMul, speedMul, groups });
  }

  // Guarantee the finale is the peak: nothing before it may out-HP it.
  // Generated curves are monotonic by construction, but the random variety
  // and champion placement can still produce an anticlimax, and "the last
  // wave is the hardest" is a promise the level shouldn't break.
  const weight = (wv) => wv.groups.reduce((a, g) => a + g.count * (g.type === "champion" ? 12 : 1), 0) * wv.hpMul;
  const finale = waves[waves.length - 1];
  const peakBefore = Math.max(...waves.slice(0, -1).map(weight), 0);
  if (weight(finale) < peakBefore * 1.05) {
    const scale = (peakBefore * 1.15) / weight(finale);
    for (const g of finale.groups) g.count = Math.max(1, Math.round(g.count * Math.min(scale, 1.6)));
    finale.hpMul = Number((finale.hpMul * Math.min(1.2, Math.max(1, scale / 1.6))).toFixed(3));
  }

  return waves;
}

export { LEVELS_PER_STAGE };
