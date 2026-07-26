// Small statistics helpers, plus the reduction from a pile of raw trials to
// one summary per (level, skill).
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function percentile(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// Wilson score interval — behaves sensibly for win rates near 0 and 1, where
// the textbook normal approximation would hand back nonsense like 1.02.
export function wilson(successes, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

const histogram = (values) => {
  const h = {};
  for (const v of values) h[v] = (h[v] || 0) + 1;
  return h;
};

// Reduce N trials of one (level, skill) pairing into the numbers the report
// and the balance checks actually read.
export function summarize(trials) {
  const n = trials.length;
  const wins = trials.filter((t) => t.won).length;
  const livesEnd = trials.map((t) => t.livesEnd);
  const starCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const t of trials) starCounts[t.stars]++;

  // Per-wave rollup. Only trials that actually *reached* a wave count toward
  // it, so a wave-9 statistic isn't diluted by everyone who died on wave 3.
  const waveCount = trials[0]?.wavesTotal ?? 0;
  const perWave = [];
  for (let w = 1; w <= waveCount; w++) {
    const recs = trials.map((t) => t.waves.find((x) => x.wave === w)).filter(Boolean);
    if (!recs.length) { perWave.push({ wave: w, reached: 0 }); continue; }
    const leaked = recs.filter((r) => r.livesLost > 0).length;
    // "Died here" = the run ended on this wave.
    const died = trials.filter((t) => t.lossWave === w).length;
    perWave.push({
      wave: w,
      reached: recs.length,
      reachRate: recs.length / n,
      leakRate: leaked / recs.length,
      deathRate: died / recs.length,
      deathShare: n - wins > 0 ? died / (n - wins) : 0, // share of ALL losses
      livesLostMean: mean(recs.map((r) => r.livesLost)),
      maxProgressMean: mean(recs.map((r) => r.maxProgress)),
      durationMean: mean(recs.map((r) => r.durationSec)),
      towersMean: mean(recs.map((r) => r.towersAtStart)),
      goldAtStartMean: mean(recs.map((r) => r.goldAtStart)),
      peakEnemiesMean: mean(recs.map((r) => r.peakEnemies)),
    });
  }

  const towerMix = {};
  for (const t of trials)
    for (const [k, v] of Object.entries(t.towerMix)) towerMix[k] = (towerMix[k] || 0) + v;
  const mixTotal = Object.values(towerMix).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(towerMix)) towerMix[k] /= mixTotal;

  return {
    level: trials[0].levelIndex,
    levelId: trials[0].levelId,
    skill: trials[0].skill,
    difficulty: trials[0].difficulty,
    n,
    winRate: wins / n,
    winCi: wilson(wins, n),
    timeoutRate: trials.filter((t) => t.timedOut).length / n,
    stars: {
      counts: starCounts,
      rate3: starCounts[3] / n,
      meanGivenWin: wins ? mean(trials.filter((t) => t.won).map((t) => t.stars)) : 0,
    },
    lives: {
      start: trials[0].livesStart,
      mean: mean(livesEnd),
      p10: percentile(livesEnd, 0.1),
      p50: percentile(livesEnd, 0.5),
      p90: percentile(livesEnd, 0.9),
      flawlessRate: trials.filter((t) => t.livesLost === 0).length / n,
    },
    wavesClearedMean: mean(trials.map((t) => t.wavesCleared)),
    wavesTotal: waveCount,
    lossWaveHist: histogram(trials.filter((t) => t.lossWave).map((t) => t.lossWave)),
    firstLeakWaveHist: histogram(trials.filter((t) => t.firstLeakWave).map((t) => t.firstLeakWave)),
    goldIdleMean: mean(trials.map((t) => t.goldIdleMean)),
    goldEarnedMean: mean(trials.map((t) => t.goldEarned)),
    towerCountMean: mean(trials.map((t) => t.towerCount)),
    investedMean: mean(trials.map((t) => t.investedEnd)),
    heroLevelMean: mean(trials.map((t) => t.heroLevel)),
    heroDeathsMean: mean(trials.map((t) => t.heroDeaths)),
    durationMean: mean(trials.map((t) => t.gameSeconds)),
    towerMix,
    perWave,
  };
}
