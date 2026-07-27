// From blueprint to battlefield: the machinery that turns a hand-authored
// route layout (see layouts.js) into a playable map.
//
// The routes themselves are designed, not generated — fifty distinct roads
// are a design problem, and rules kept producing fifty variations of the same
// maze. What stays procedural is everything that must be MEASURED rather than
// drawn: seeded jitter so a blueprint doesn't look traced from a ruler, the
// spline that turns control points into a road, build-spot placement scored
// by actual coverage, and the exposure-band validation that keeps every map's
// defensibility inside the range the balance harness was tuned against.
//
// Determinism matters: the same seed and blueprint must always produce the
// same map, or saved progress and simulated balance would both drift under
// the player.
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

// ------------------------------------------------------------------ jitter
// A blueprint drawn dead-on would betray its control points. Each interior
// point gets a small seeded nudge; endpoints stay put (they anchor the road
// to its off-screen entry and exit).
//
// Crucially, jitter is applied PER POINT, not per route: a fork's merged tail
// is the same point arrays spliced into every route, and jittering by
// identity (the Map below) moves a shared point once, so every route still
// agrees exactly on where the roads meet. ±7px is small enough that the
// authored 100px+ corridor clearances survive.
const JITTER = 7;
function jitterRoutes(routes, rand) {
  const moved = new Map();
  return routes.map((route) =>
    route.map((pt, i) => {
      if (moved.has(pt)) return moved.get(pt);
      const anchor = i === 0 || i === route.length - 1;
      const p = anchor
        ? { x: pt[0], y: pt[1] }
        : { x: Math.round(pt[0] + (rand() * 2 - 1) * JITTER),
            y: Math.round(pt[1] + (rand() * 2 - 1) * JITTER) };
      moved.set(pt, p);
      return p;
    }));
}

// Centripetal Catmull-Rom through the control points, tessellated into a dense
// polyline. Centripetal (alpha = 0.5) rather than uniform because uniform
// splines overshoot and form cusps exactly where this road turns hardest — the
// hairpins would loop back over themselves.
//
// The result is still a plain array of {x, y}, so every consumer — movement,
// the road renderer, build-spot scoring — keeps working untouched. It just has
// a few hundred short segments instead of ten long ones.
function smooth(control, step = 13) {
  // Phantom endpoints, mirrored outward, so the curve starts and ends exactly
  // on the real entry/exit points instead of drifting off-screen.
  const p = [
    { x: 2 * control[0].x - control[1].x, y: 2 * control[0].y - control[1].y },
    ...control,
    { x: 2 * control[control.length - 1].x - control[control.length - 2].x,
      y: 2 * control[control.length - 1].y - control[control.length - 2].y },
  ];

  const out = [{ x: control[0].x, y: control[0].y }];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    // centripetal knot spacing
    const d01 = Math.pow(dist(p0.x, p0.y, p1.x, p1.y), 0.5) || 1e-4;
    const d12 = Math.pow(dist(p1.x, p1.y, p2.x, p2.y), 0.5) || 1e-4;
    const d23 = Math.pow(dist(p2.x, p2.y, p3.x, p3.y), 0.5) || 1e-4;
    // tangents (Barry-Goldman form, reduced)
    const m1x = ((p2.x - p1.x) + d12 * ((p1.x - p0.x) / d01 - (p2.x - p0.x) / (d01 + d12)));
    const m1y = ((p2.y - p1.y) + d12 * ((p1.y - p0.y) / d01 - (p2.y - p0.y) / (d01 + d12)));
    const m2x = ((p2.x - p1.x) + d12 * ((p3.x - p2.x) / d23 - (p3.x - p1.x) / (d12 + d23)));
    const m2y = ((p2.y - p1.y) + d12 * ((p3.y - p2.y) / d23 - (p3.y - p1.y) / (d12 + d23)));

    const steps = Math.max(2, Math.ceil(dist(p1.x, p1.y, p2.x, p2.y) / step));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      // Hermite basis
      const h1 = 2 * t3 - 3 * t2 + 1, h2 = -2 * t3 + 3 * t2;
      const h3 = t3 - 2 * t2 + t, h4 = t3 - t2;
      out.push({
        x: Math.round((h1 * p1.x + h2 * p2.x + h3 * m1x + h4 * m2x) * 10) / 10,
        y: Math.round((h1 * p1.y + h2 * p2.y + h3 * m1y + h4 * m2y) * 10) / 10,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------ build spots
// Candidates on a coarse grid, filtered to the band beside the road — close
// enough that a tower's range reaches it, far enough that the tower isn't
// sitting in the middle of the street.
function candidateSpots(routes, rand) {
  const NEAR = 34, FAR = 104;
  const out = [];
  for (let x = 46; x <= W - 46; x += 26) {
    for (let y = 46; y <= H - 40; y += 26) {
      // distance to the closest of ALL routes — a spot in a fork's median that
      // is too near branch A is still in the street, whatever branch B thinks
      let d = Infinity;
      for (const r of routes) {
        const on = nearestPointOnPath(r, x, y);
        d = Math.min(d, dist(x, y, on.x, on.y));
      }
      if (d < NEAR || d > FAR) continue;
      out.push({ x: Math.round(x + (rand() - 0.5) * 10), y: Math.round(y + (rand() - 0.5) * 10) });
    }
  }
  return out;
}

// How much road a tower here would watch — the same coverage measure the
// balance harness's bot uses to judge a spot, so maps are scored by the
// criterion they'll actually be played against.
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
function pickSpots(routes, rand, count) {
  // Coverage is scored over every route's samples together. On a fork the
  // shared tail appears once per route, so ground that watches it counts
  // double — which is exactly right, because every creep on the map walks it.
  const samples = routes.flatMap((r) => samplePath(r));
  const cands = candidateSpots(routes, rand);
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
// How much tower fire a map affords: the average length of road one build
// spot watches. (Algebraically: for every point on the road, count the spots
// that could shoot it, integrate along the route, divide by spot count.)
// It is, near enough, the total damage one tower gets to deal over one
// creep's journey — so it predicts how hard the map plays.
//
// This number is why maps need validating at all. Left unchecked it varied
// 2.1× across fifty seeds of the old generator, and the balance harness
// showed that variance swamping every intentional difficulty setting: two
// levels with the same enemy HP measured 98% and 0% win rates purely because
// one map's spots covered the road and the other's didn't.
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
// come from the shape of the route, not from whether it's defensible. The
// hand-authored layouts are designed against it — corridors run 100-145px
// apart precisely so a build spot between two passes watches both, which is
// what lifts a spot's average coverage into this range.
//
// Re-derived for the hand-authored campaign (as it was re-derived when the
// generated roads were shortened): most blueprints deliver 420-478, and the
// deliberately compact shapes — staircases, weaves, the hooked L — bottom
// out just above 400. The band is the lint that catches a blueprint whose
// spots can't watch its road; the balance harness in tools/sim is what
// actually prices the residual spread.
export const EXPOSURE_BAND = [400, 480];

// Forks keep their own lower floor: ground watching branch A isn't watching
// branch B, so the per-spot average over each single route sits lower even
// on a well-designed map. Fork maps are dealt two extra build spots per
// extra route in compensation (see levels.js); the rest is the hard-level
// edge forks exist for. Within the band the shapes stratify on purpose:
// plain Y-merges measure 320+, split-and-rejoin diamonds ~300+, and the two
// tridents and the double diamond — each stage-arc's deliberate hardest —
// sit down near the floor.
export const FORK_EXPOSURE_BAND = [285, 480];

// ------------------------------------------------------------------ entry
// `seed` picks the jitter, not the shape: the blueprint's control points are
// nudged from consecutive seeds until the finished map lands inside the
// exposure band, so the result is fully deterministic AND guaranteed
// defensible. Falls back to the closest candidate if the band can't be hit —
// a blueprint that misses consistently is an authoring bug, and
// tools/check-maps.js exists to catch it before it ships.
export function generateMap(seed, { spots = 9, layout, tries = 40 } = {}) {
  const multi = layout.routes.length > 1;
  const [lo, hi] = layout.band || (multi ? FORK_EXPOSURE_BAND : EXPOSURE_BAND);
  let best = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const rand = rng(seed + attempt * 101);
    const routes = jitterRoutes(layout.routes, rand).map((c) => smooth(c));
    const picked = pickSpots(routes, rand, spots);
    // A map qualifies only if EVERY route sits inside the band — on a fork, a
    // creep walks one branch or the other, so each branch alone has to afford
    // the fire the campaign's difficulty math assumes.
    const exposures = routes.map((r) => exposurePerSpot(r, picked));
    const candidate = {
      path: routes[0], routes, spots: picked,
      lanes: layout.routes.length, archetype: layout.archetype, motif: layout.motif,
      exposure: Math.min(...exposures),
      length: Math.round(pathLength(routes[0])),
      seedUsed: seed + attempt * 101,
    };
    if (exposures.every((e) => e >= lo && e <= hi)) return candidate;
    // Keep whichever near-miss sits closest to the middle of the band.
    const mid = (lo + hi) / 2;
    const miss = Math.max(...exposures.map((e) => Math.abs(e - mid)));
    if (!best || miss < best.miss) best = { candidate, miss };
  }
  return best.candidate;
}
