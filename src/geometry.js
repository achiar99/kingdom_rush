// Pure path/distance math. No module-level state — every function takes the
// path it operates on as a parameter, so callers pass in the active level's
// PATH explicitly (see state.js).

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total += dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
  return total;
}

// Cumulative arc length at each vertex, built once per path and remembered.
//
// Roads used to be ten-point zigzags, so walking them linearly cost nothing.
// They're now smooth curves tessellated into a few hundred segments, and
// pointAtDistance runs for every creep every frame — linear scanning would
// make that thirty times more expensive. The table turns it into a binary
// search, which is flat in the number of segments.
const cumCache = new WeakMap();

function cumulative(path) {
  let cum = cumCache.get(path);
  if (!cum) {
    cum = new Float64Array(path.length);
    for (let i = 1; i < path.length; i++)
      cum[i] = cum[i - 1] + dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
    cumCache.set(path, cum);
  }
  return cum;
}

// Convert a distance travelled along the path into an {x, y} position.
export function pointAtDistance(path, pathLen, d) {
  const last = path.length - 1;
  if (d <= 0) return { x: path[0].x, y: path[0].y };
  const cum = cumulative(path);
  if (d >= cum[last]) return { x: path[last].x, y: path[last].y };

  // largest i with cum[i] <= d
  let lo = 0, hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid - 1;
  }
  const a = path[lo], b = path[lo + 1];
  const seg = cum[lo + 1] - cum[lo];
  const t = seg === 0 ? 0 : (d - cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Nearest point on the path to (px,py) — used to rally soldiers onto the road.
export function nearestPointOnPath(path, px, py) {
  let best = { x: path[0].x, y: path[0].y }, bestD = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + dx * t, y = a.y + dy * t;
    const d = dist(px, py, x, y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}
