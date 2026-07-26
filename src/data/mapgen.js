// Seeded map generation: a road across the battlefield, and the build spots
// that overlook it.
//
// Fifty hand-drawn maps would be fifty designs invented once and never
// revisited. Generating them from a seed means the *shape* of a good map is
// written down as rules instead — and a level that plays badly is fixed by
// changing one number, then re-checked by the balance harness in tools/sim.
//
// Determinism matters: the same seed must always produce the same map, or
// saved progress and simulated balance would both drift under the player.
import { CONFIG } from "../config.js";
import { dist, pathLength, pointAtDistance, nearestPointOnPath } from "../geometry.js";

const W = CONFIG.width, H = CONFIG.height;

// mulberry32 — same generator the balance harness uses.
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

// ------------------------------------------------------------------- road
// Every map is a serpentine: creeps sweep across the field, drop to the next
// lane, sweep back. It's the shape that makes tower placement interesting —
// a spot between two lanes covers both — and jittering the lane heights and
// turn positions is enough to keep fifty of them from feeling alike.
//
// `lanes` (3-5) is the main difficulty-independent variety knob: more lanes
// means a longer road, more time under fire, and more double-covered spots.
function serpentine(rand, lanes) {
  const margin = 60;
  const laneGap = (H - margin * 2) / (lanes - 1);
  const ys = [];
  for (let i = 0; i < lanes; i++) {
    // jitter each lane, but by less than half the gap so two can never meet
    const jitter = (rand() - 0.5) * laneGap * 0.4;
    ys.push(Math.round(margin + i * laneGap + jitter));
  }
  if (rand() < 0.5) ys.reverse();          // enter from the bottom half the time

  let goingRight = rand() < 0.5;
  const pts = [{ x: goingRight ? -30 : W + 30, y: ys[0] }];
  for (let i = 0; i < lanes; i++) {
    const y = ys[i];
    if (i === lanes - 1) {
      pts.push({ x: goingRight ? W + 30 : -30, y });   // run off the far edge
      break;
    }
    // Where this lane stops and turns. Varying the inset is what gives the
    // route its hooked, uneven, hand-drawn look instead of a clean zigzag.
    const inset = Math.round(60 + rand() * 130);
    const turnX = goingRight ? W - inset : inset;
    pts.push({ x: turnX, y });                 // along the lane
    pts.push({ x: turnX, y: ys[i + 1] });      // down to the next
    goingRight = !goingRight;
  }
  return pts;
}

// ------------------------------------------------------------ build spots
// Candidates on a coarse grid, filtered to the band beside the road — close
// enough that a tower's range reaches it, far enough that the tower isn't
// sitting in the middle of the street.
function candidateSpots(path, rand) {
  const NEAR = 34, FAR = 104;
  const out = [];
  for (let x = 46; x <= W - 46; x += 26) {
    for (let y = 46; y <= H - 40; y += 26) {
      const on = nearestPointOnPath(path, x, y);
      const d = dist(x, y, on.x, on.y);
      if (d < NEAR || d > FAR) continue;
      out.push({ x: Math.round(x + (rand() - 0.5) * 10), y: Math.round(y + (rand() - 0.5) * 10) });
    }
  }
  return out;
}

// How much road a tower here would watch — the same coverage measure the
// balance harness's bot uses to judge a spot, so generated maps are scored
// by the criterion they'll actually be played against.
function coverage(samples, x, y, range) {
  let n = 0;
  for (const p of samples) if (dist(x, y, p.x, p.y) <= range) n++;
  return n;
}

function samplePath(path, step = 10) {
  const len = pathLength(path);
  const pts = [];
  for (let d = 0; d <= len; d += step) pts.push(pointAtDistance(path, len, d));
  return pts;
}

// Greedily take the best-covering candidate, then forbid its neighbourhood so
// towers spread along the whole route instead of clumping on the one hot
// corner. That spread is what makes the *whole* map matter.
function pickSpots(path, rand, count) {
  const samples = samplePath(path);
  const cands = candidateSpots(path, rand);
  const MIN_APART = 74;
  const chosen = [];
  const scored = cands.map((c) => ({
    ...c,
    // score against a mid-range tower; add a little noise so equally good
    // positions don't always resolve the same way across seeds
    score: coverage(samples, c.x, c.y, 125) * (0.9 + rand() * 0.2),
  })).sort((a, b) => b.score - a.score);

  for (const c of scored) {
    if (chosen.length >= count) break;
    if (chosen.some((s) => dist(s.x, s.y, c.x, c.y) < MIN_APART)) continue;
    chosen.push({ x: c.x, y: c.y });
  }
  // Relax the spacing if the road was too cramped to fit them all.
  for (let relax = MIN_APART - 12; chosen.length < count && relax > 34; relax -= 12)
    for (const c of scored) {
      if (chosen.length >= count) break;
      if (chosen.some((s) => dist(s.x, s.y, c.x, c.y) < relax)) continue;
      chosen.push({ x: c.x, y: c.y });
    }
  return chosen;
}

// ------------------------------------------------------- defensibility
// How much tower fire a map affords: for every point on the road, how many
// build spots could shoot it, integrated along the whole route and divided by
// the number of spots. It is, near enough, the total damage one tower gets to
// deal over one creep's journey — so it predicts how hard the map plays.
//
// This number is why generated maps need validating at all. Left unchecked,
// it varied 2.1× across fifty seeds, and the balance harness showed that
// variance swamping every intentional difficulty setting: two adjacent levels
// with the same enemy HP measured 98% and 0% win rates purely because one
// map's spots covered the road and the other's didn't.
export function exposurePerSpot(path, spots, range = 130) {
  if (!spots.length) return 0;
  const len = pathLength(path);
  const samples = samplePath(path, 10);
  let overlap = 0;
  for (const p of samples)
    for (const s of spots) if (dist(s.x, s.y, p.x, p.y) <= range) overlap++;
  return (overlap / samples.length) * len / spots.length;
}

// The band a map has to land in to be used. Narrow on purpose: variety should
// come from the shape of the route, not from whether it's defensible.
export const EXPOSURE_BAND = [495, 545];

// ------------------------------------------------------------------ entry
// `seed` is the starting point, not necessarily the seed used: candidates are
// generated from consecutive seeds until one lands inside EXPOSURE_BAND, so
// the result is still fully deterministic but guaranteed playable. Falls back
// to the closest candidate if the band can't be hit.
export function generateMap(seed, { spots = 9, lanes = null, tries = 60 } = {}) {
  const [lo, hi] = EXPOSURE_BAND;
  let best = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const rand = rng(seed + attempt * 101);
    const laneCount = lanes ?? 3 + Math.floor(rand() * 3); // 3-5
    const path = serpentine(rand, laneCount);
    const picked = pickSpots(path, rand, spots);
    const exposure = exposurePerSpot(path, picked);
    const candidate = {
      path, spots: picked, lanes: laneCount, exposure,
      length: Math.round(pathLength(path)),
      seedUsed: seed + attempt * 101,
    };
    if (exposure >= lo && exposure <= hi) return candidate;
    // Keep whichever near-miss sits closest to the middle of the band.
    const miss = Math.abs(exposure - (lo + hi) / 2);
    if (!best || miss < best.miss) best = { candidate, miss };
  }
  return best.candidate;
}
