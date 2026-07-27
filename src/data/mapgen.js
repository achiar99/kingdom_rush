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
// lane, sweep back. That skeleton is what makes tower placement interesting —
// a spot between two lanes covers both — but drawn literally it's a ladder of
// right angles, and fifty of those look like fifty of the same map.
//
// So the skeleton is only a set of control points. Each lane gets a couple of
// waypoints pushed off to the side so the road bows instead of running dead
// straight, and the whole thing is then drawn as a spline: the corners become
// sweeping bends and the straights breathe. `lanes` (3-5) stays the main
// variety knob — more lanes means a longer road and more double-covered spots.
function skeleton(rand, lanes) {
  const margin = 62;
  const laneGap = (H - margin * 2) / (lanes - 1);
  const ys = [];
  for (let i = 0; i < lanes; i++) {
    // jitter each lane, but by less than half the gap so two can never meet
    const jitter = (rand() - 0.5) * laneGap * 0.4;
    ys.push(Math.round(margin + i * laneGap + jitter));
  }
  if (rand() < 0.5) ys.reverse();          // enter from the bottom half the time

  // How far a lane may bow away from its nominal height. Kept well under half
  // the lane gap: a road that wanders is good, two lanes touching is not.
  const bow = Math.min(46, laneGap * 0.3);

  let goingRight = rand() < 0.5;
  const pts = [{ x: goingRight ? -30 : W + 30, y: ys[0] }];

  for (let i = 0; i < lanes; i++) {
    const y = ys[i];
    const last = i === lanes - 1;
    const startX = pts[pts.length - 1].x;
    const endX = last ? (goingRight ? W + 30 : -30)
                      : (goingRight ? W - Math.round(60 + rand() * 130)
                                    : Math.round(60 + rand() * 130));

    // Two waypoints along the lane, nudged up or down, so the straight becomes
    // a shallow S or a bow rather than a ruled line.
    for (const frac of [0.34, 0.68]) {
      pts.push({
        x: Math.round(startX + (endX - startX) * frac),
        y: Math.round(y + (rand() - 0.5) * 2 * bow),
      });
    }
    pts.push({ x: endX, y });

    if (!last) {
      // The turn: one point offset diagonally into the corner, so the spline
      // rounds it into a hairpin instead of folding at 90°.
      const nextY = ys[i + 1];
      const lead = (goingRight ? 1 : -1) * Math.round(26 + rand() * 34);
      pts.push({ x: endX + lead, y: Math.round((y + nextY) / 2) });
      pts.push({ x: endX, y: nextY });
      goingRight = !goingRight;
    }
  }
  return pts;
}

// An organic wandering road — the Kingdom Rush look. The serpentine's tell is
// that every crossing is horizontal and wall-to-wall; a real map's road hooks,
// staircases, doubles back, and enters and leaves on whatever edges it likes.
//
// The generator is a SELF-AVOIDING WALK on a coarse grid: entry and exit cells
// on two different edges, a randomized depth-first search for a route between
// them that visits at least `minCells` cells, then the cell centres (jittered)
// become spline control points. Self-avoidance on the grid is what guarantees
// the road never crosses itself and parallel corridors keep a full cell of
// clearance — properties the serpentine got from its lane structure, kept here
// without the lanes.
function wanderSkeleton(rand) {
  const COLS = 7, ROWS = 4;
  const cw = W / COLS, ch = H / ROWS;
  const idx = (c, r) => r * COLS + c;

  // entry and exit on two different edges, never adjacent corners
  const edgeCells = {
    left: Array.from({ length: ROWS }, (_, r) => [0, r]),
    right: Array.from({ length: ROWS }, (_, r) => [COLS - 1, r]),
    top: Array.from({ length: COLS }, (_, c) => [c, 0]),
    bottom: Array.from({ length: COLS }, (_, c) => [c, ROWS - 1]),
  };
  const edges = Object.keys(edgeCells);
  const e1 = edges[Math.floor(rand() * 4)];
  let e2 = edges[Math.floor(rand() * 4)];
  while (e2 === e1) e2 = edges[Math.floor(rand() * 4)];
  const pick = (edge) => edgeCells[edge][Math.floor(rand() * edgeCells[edge].length)];
  const start = pick(e1), goal = pick(e2);

  // randomized DFS for a self-avoiding path of at least minCells cells
  const minCells = 22;
  const visited = new Uint8Array(COLS * ROWS);
  const walk = [];
  let calls = 0;
  const dfs = (c, r) => {
    if (++calls > 30000) return false;             // determinism-safe bailout
    visited[idx(c, r)] = 1;
    walk.push([c, r]);
    if (c === goal[0] && r === goal[1] && walk.length >= minCells) return true;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map((d) => ({ d, k: rand() }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.d);
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (visited[idx(nc, nr)]) continue;
      if (dfs(nc, nr)) return true;
    }
    visited[idx(c, r)] = 0;
    walk.pop();
    return false;
  };
  if (!dfs(start[0], start[1])) return null;       // caller tries the next seed

  // cells -> jittered control points, plus off-screen extensions at both ends
  const centre = ([c, r]) => ({
    x: Math.round((c + 0.5) * cw + (rand() - 0.5) * cw * 0.34),
    y: Math.round((r + 0.5) * ch + (rand() - 0.5) * ch * 0.34),
  });
  const pts = walk.map(centre);
  // Top-edge roads barely leave the world: the sky band sits directly above
  // it on the canvas, and a full 30px extension would have creeps marching
  // over the mountains before they reach the field. 8px keeps the spawn just
  // behind the horizon's fade.
  const off = (edge, p) =>
    edge === "left" ? { x: -30, y: p.y } : edge === "right" ? { x: W + 30, y: p.y }
    : edge === "top" ? { x: p.x, y: -8 } : { x: p.x, y: H + 30 };
  pts.unshift(off(e1, pts[0]));
  pts.push(off(e2, pts[pts.length - 1]));
  return pts;
}

// A rectangular spiral coiling inward, the temple at its heart. The same few
// control-point tricks as the serpentine — bowed legs, rounded corners — but
// the geometry says something different: the whole map wraps around the thing
// you are defending, and the creeps close in from every side as they walk.
function spiralSkeleton(rand) {
  const m = 54 + Math.round(rand() * 8);          // outer margin
  const g = 88 + Math.round(rand() * 14);         // gap between coils
  const mirrored = rand() < 0.5;                  // enter left or right
  const flipped = rand() < 0.5;                   // clockwise or counter
  const X = (x) => (mirrored ? W - x : x);
  const Y = (y) => (flipped ? H - y : y);
  const bow = 13;                                 // small: coils must not touch

  const pts = [{ x: X(-30), y: Y(m) }];
  // Each entry: [corner-x, corner-y] in unmirrored space; legs between corners
  // get one bowed midpoint so the coil breathes without risking a collision.
  const corners = [
    [W - m, m], [W - m, H - m], [m, H - m], [m, m + g],
    [W - m - g, m + g], [W - m - g, H - m - g], [m + g, H - m - g], [m + g, m + 2 * g],
    [W / 2, m + 2 * g],
  ];
  let prev = pts[0];
  for (const [cx, cy] of corners) {
    const c = { x: X(cx), y: Y(cy) };
    pts.push({
      x: Math.round((prev.x + c.x) / 2 + (rand() - 0.5) * 2 * bow * (prev.x === c.x ? 1 : 0)),
      y: Math.round((prev.y + c.y) / 2 + (rand() - 0.5) * 2 * bow * (prev.y === c.y ? 1 : 0)),
    });
    pts.push(c);
    prev = c;
  }
  // the last step into the heart, where the temple stands
  pts.push({ x: X(W / 2), y: Y(m + 2 * g + 42) });
  return pts;
}

// Two armies, one gate: a pair of roads that enter separately, serpentine
// through their own halves of the field, and MERGE into a single shared road
// to the temple. Returns two full control-point routes whose tails are the
// same points — each is smoothed into its own polyline, and a creep walks one
// or the other.
//
// This is the "hard level" shape: until the merge your towers can only ever
// see half the traffic, and the ground that watches both branches at once —
// around the merge and along the shared tail — is suddenly the most valuable
// real estate on the map.
function forkSkeleton(rand) {
  // Seven heights: three lanes per branch, the merge lane dead centre. Two
  // crossings per branch measured ~2,550px per route, and at that length the
  // exposure band is unreachable no matter where the spots go — each creep
  // simply isn't on the road long enough. Three crossings brings a route back
  // to ~3,400px, inside what the campaign's difficulty math assumes.
  const m = 52;
  const gap = (H - m * 2) / 6;
  const ys = [];
  for (let i = 0; i < 7; i++) ys.push(Math.round(m + i * gap + (rand() - 0.5) * gap * 0.2));
  const mirrored = rand() < 0.5;
  const X = (x) => (mirrored ? W - x : x);
  const bow = Math.min(12, gap * 0.16);           // lanes sit close; keep them apart
  // Crossings run as wide as the hairpins allow: every pixel of width is route
  // length, and route length is exposure the band needs. (Was W-120-160 /
  // 96-136, which left the weak route ~10% under the band with no spot layout
  // able to close the gap.)
  const farX = W - 100 - Math.round(rand() * 22);
  const nearX = 78 + Math.round(rand() * 22);

  // one serpentine crossing with two bowed waypoints, matching the main
  // skeleton's lane shape
  const lane = (pts, fromX, toX, y) => {
    for (const f of [0.34, 0.68])
      pts.push({ x: Math.round(X(fromX + (toX - fromX) * f)),
                 y: Math.round(y + (rand() - 0.5) * 2 * bow) });
    pts.push({ x: X(toX), y });
  };
  const turn = (pts, x, yFrom, yTo, dir) => {
    pts.push({ x: X(x + dir * (26 + rand() * 30)), y: Math.round((yFrom + yTo) / 2) });
    pts.push({ x: X(x), y: yTo });
  };

  // The merge sits left of centre, midway between the two inner lanes. The
  // shared road then runs ONE full crossing and exits on the far side — an
  // earlier version gave it a second crossing back through the middle, and
  // that lane unavoidably crossed whichever branch was climbing into the
  // merge (measured: routes 6px apart, i.e. a road drawn over a road).
  const midY = ys[3];
  // The merge sits at the FAR turn, and the shared road runs back across the
  // middle to exit on the entry side. Crucially the shared segment is ONE
  // control-point array reused by both routes — an earlier version gave each
  // branch its own copy of the final crossing, and since every lane gets its
  // own random bows, the two roads overlapped as a wobbling ±12px braid.
  const M = { x: X(farX), y: midY };

  // branch A: enters top-left, three crossings in the top band, down into M
  const A = [{ x: X(-30), y: ys[0] }];
  lane(A, -30, farX, ys[0]);
  turn(A, farX, ys[0], ys[1], 1);
  lane(A, farX, nearX, ys[1]);
  turn(A, nearX, ys[1], ys[2], -1);
  lane(A, nearX, farX, ys[2]);
  turn(A, farX, ys[2], midY, 1);

  // branch B: enters bottom-left, three crossings in the bottom band, up into M
  const B = [{ x: X(-30), y: ys[6] }];
  lane(B, -30, farX, ys[6]);
  turn(B, farX, ys[6], ys[5], 1);
  lane(B, farX, nearX, ys[5]);
  turn(B, nearX, ys[5], ys[4], -1);
  lane(B, nearX, farX, ys[4]);
  turn(B, farX, ys[4], midY, 1);

  // the shared road: one crossing from the merge back out the entry side
  const shared = [M];
  lane(shared, farX, -30, midY);

  return [
    [...A, ...shared],
    [...B, ...shared],
  ];
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

// Forks get a lower floor, on purpose and after measuring the alternative.
// With three crossings per branch — the most road the geometry can hold
// without lanes touching — the weaker route tops out around 470-485: ground
// that watches branch A is ground that isn't watching branch B, and no spot
// layout closes that. So a fork map is inherently ~5-8% less defended per
// creep than a serpentine, and this band admits that honestly rather than
// letting every fork fall through to an unvalidated closest-miss. Forks are
// placed as the HARD levels of each stage, where that edge is the point.
export const FORK_EXPOSURE_BAND = [455, 545];

// ------------------------------------------------------------------ entry
// `seed` is the starting point, not necessarily the seed used: candidates are
// generated from consecutive seeds until one lands inside EXPOSURE_BAND, so
// the result is still fully deterministic but guaranteed playable. Falls back
// to the closest candidate if the band can't be hit.
export function generateMap(seed, { spots = 9, lanes = null, tries = 60, archetype = "serpentine" } = {}) {
  const [lo, hi] = archetype === "fork" ? FORK_EXPOSURE_BAND : EXPOSURE_BAND;
  let best = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const rand = rng(seed + attempt * 101);
    const laneCount = lanes ?? 3 + Math.floor(rand() * 3); // 3-5

    // One archetype, one to two routes. Every route ends at the same exit, so
    // there is always exactly one temple.
    let routes;
    if (archetype === "spiral") routes = [smooth(spiralSkeleton(rand))];
    else if (archetype === "fork") routes = forkSkeleton(rand).map((c) => smooth(c));
    else if (archetype === "wander") {
      const c = wanderSkeleton(rand);
      if (!c) continue;                            // walk not found; next seed
      routes = [smooth(c)];
    }
    else routes = [smooth(skeleton(rand, laneCount))];

    const picked = pickSpots(routes, rand, spots);
    // A map qualifies only if EVERY route sits inside the band — on a fork, a
    // creep walks one branch or the other, so each branch alone has to afford
    // the fire the campaign's difficulty math assumes.
    const exposures = routes.map((r) => exposurePerSpot(r, picked));
    const candidate = {
      path: routes[0], routes, spots: picked, lanes: laneCount, archetype,
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
