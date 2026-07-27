// Map lint: every hand-authored layout, measured.
//
//   node tools/check-maps.js            table for all 50 levels
//   node tools/check-maps.js 12 37      only those level indices
//
// Three families of failure it exists to catch, all invisible in the data
// and glaring in play:
//   EXPOSURE   the map fell outside its defensibility band (see mapgen.js) —
//              it will play measurably harder or easier than its hpScale says
//   CLEARANCE  two corridors run closer than the painted road is wide, and
//              parallel roads visually merge into one sand lake
//   BOUNDS     a control point wandered into the border frame or off-field
import { LEVELS } from "../src/data/levels.js";
import { EXPOSURE_BAND, FORK_EXPOSURE_BAND } from "../src/data/mapgen.js";
import { pathLength, pointAtDistance, dist } from "../src/geometry.js";

const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));

// The painted road is ~67px wide plus tufts; below this centreline gap the
// verges touch. Junction areas of a fork are exempt — converging is the point.
const MIN_CLEAR = 96;
// Interior control points must stay inside the frame band (58px) minus a
// little slack for the jitter and the spline's swing.
const X_MIN = 60, X_MAX = 840, Y_MIN = 52, Y_MAX = 508;

function samples(path, step = 12) {
  const len = pathLength(path);
  const out = [];
  for (let d = 0; d <= len; d += step) out.push({ ...pointAtDistance(path, len, d), d });
  return out;
}

// Minimum distance between two stretches of road that aren't the same
// stretch. Same-route: pairs far apart along the arc. Cross-route: pairs
// where neither sample sits on the shared/merging part of a fork.
function selfClearance(path) {
  const S = samples(path);
  let min = Infinity, at = null;
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      // Same bend, not two corridors. 230 clears the sharpest legitimate
      // turns — a V-apex measures ~180 of arc across, a serpentine U-turn
      // ~205, a rounded merge hairpin ~220 — while corridors that merely
      // pass near each other measure 300+ and stay caught.
      if (S[j].d - S[i].d < 230) continue;
      const dd = dist(S[i].x, S[i].y, S[j].x, S[j].y);
      if (dd < min) { min = dd; at = S[i]; }
    }
  return { min, at };
}

function crossClearance(a, b) {
  const SA = samples(a), SB = samples(b);
  // A sample is "shared" when it lies on the other route too.
  const sharedA = SA.map((p) => SB.some((q) => dist(p.x, p.y, q.x, q.y) < 9));
  const sharedB = SB.map((p) => SA.some((q) => dist(p.x, p.y, q.x, q.y) < 9));
  // Distance along the arc to the nearest shared sample — points close to a
  // junction are allowed to be close to the other route.
  const nearJunction = (shared, idx) => {
    for (let k = 0; k < shared.length; k++)
      if (shared[k] && Math.abs(k - idx) * 12 < 150) return true;
    return false;
  };
  let min = Infinity, at = null;
  for (let i = 0; i < SA.length; i++) {
    if (sharedA[i] || nearJunction(sharedA, i)) continue;
    for (let j = 0; j < SB.length; j++) {
      if (sharedB[j] || nearJunction(sharedB, j)) continue;
      const dd = dist(SA[i].x, SA[i].y, SB[j].x, SB[j].y);
      if (dd < min) { min = dd; at = SA[i]; }
    }
  }
  return { min, at };
}

let failures = 0;
const rows = [];
for (const lv of LEVELS) {
  if (only.length && !only.includes(lv.index)) continue;
  const multi = lv.routes.length > 1;
  const [lo, hi] = multi ? FORK_EXPOSURE_BAND : EXPOSURE_BAND;
  const problems = [];

  // exposure — recompute per route off the level as built
  const { exposurePerSpot } = await import("../src/data/mapgen.js");
  const exposures = lv.routes.map((r) => Math.round(exposurePerSpot(r, lv.spots)));
  for (const e of exposures)
    if (e < lo || e > hi) problems.push(`EXPOSURE ${e} outside [${lo},${hi}]`);

  // clearance — within each route and between routes
  let clear = Infinity, clearAt = null;
  for (const r of lv.routes) {
    const c = selfClearance(r);
    if (c.min < clear) { clear = c.min; clearAt = c.at; }
  }
  for (let i = 0; i < lv.routes.length; i++)
    for (let j = i + 1; j < lv.routes.length; j++) {
      const c = crossClearance(lv.routes[i], lv.routes[j]);
      if (c.min < clear) { clear = c.min; clearAt = c.at; }
    }
  if (clear < MIN_CLEAR)
    problems.push(`CLEARANCE ${Math.round(clear)} at (${Math.round(clearAt.x)},${Math.round(clearAt.y)})`);

  // bounds — smoothed road must stay on the field (entries/exits exempt)
  for (const r of lv.routes) {
    const S = samples(r);
    const len = S[S.length - 1].d;
    for (const p of S) {
      if (p.d < 155 || p.d > len - 155) continue;    // entry/exit runs
      if (p.x < X_MIN || p.x > X_MAX || p.y < Y_MIN || p.y > Y_MAX) {
        problems.push(`BOUNDS (${Math.round(p.x)},${Math.round(p.y)})`);
        break;
      }
    }
  }

  const lens = lv.routes.map((r) => Math.round(pathLength(r)));
  if (problems.length) failures++;
  rows.push({
    idx: lv.index, id: lv.id, arch: lv.archetype.slice(0, 6), routes: lv.routes.length,
    spots: lv.spots.length, len: lens.join("/"), exp: exposures.join("/"),
    band: `[${lo},${hi}]`, status: problems.length ? problems.join("; ") : "ok",
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("idx", 4) + pad("id", 14) + pad("arch", 8) + pad("rts", 4) +
  pad("spots", 6) + pad("len", 16) + pad("exposure", 14) + pad("band", 11) + "status");
for (const r of rows)
  console.log(pad(r.idx, 4) + pad(r.id, 14) + pad(r.arch, 8) + pad(r.routes, 4) +
    pad(r.spots, 6) + pad(r.len, 16) + pad(r.exp, 14) + pad(r.band, 11) + r.status);
console.log(failures ? `\n${failures} level(s) failing` : "\nall levels pass");
process.exit(failures ? 1 : 0);
