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

// Convert a distance travelled along the path into an {x, y} position.
export function pointAtDistance(path, pathLen, d) {
  let remaining = d;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = dist(a.x, a.y, b.x, b.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return { x: path[path.length - 1].x, y: path[path.length - 1].y };
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
