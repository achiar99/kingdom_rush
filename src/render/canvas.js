// The shared canvas/2d context and the base shading vocabulary every render
// module draws with.
//
// The look is "2.5D": everything is drawn on a flat top-down plane, but
// radial-gradient shading + soft ground shadows + top highlights make towers
// and creeps read as rounded volumes lit from the upper-left.
export const canvas = document.getElementById("game");

// `ctx` is a live binding, not a constant, so it can be pointed at a different
// surface for a moment. The Field Guide uses this to draw real towers and
// creatures into little thumbnail canvases with the same code that draws them
// on the battlefield — the alternative was a second set of drawings for the
// guide, which would drift out of step the day after it was written.
export let ctx = canvas.getContext("2d");

// Run `fn` with every render module drawing into `target` instead. Restores
// the battlefield context afterwards even if `fn` throws.
export function withCanvas(target, fn) {
  const previous = ctx;
  ctx = target;
  try { return fn(); }
  finally { ctx = previous; }
}

export const LIGHT = { x: -0.5, y: -0.6 }; // light direction (upper-left)

// Soft elliptical shadow cast on the ground beneath an object.
export function groundShadow(cx, cy, rx, ry) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A shaded sphere: radial gradient with the highlight offset toward the light.
export function shadedSphere(cx, cy, r, light, mid, dark) {
  const hx = cx + LIGHT.x * r * 0.55;
  const hy = cy + LIGHT.y * r * 0.55;
  const g = ctx.createRadialGradient(hx, hy, r * 0.1, cx, cy, r);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

// Like shadedSphere but elliptical — the basic "body blob" for characters.
export function shadedEllipse(cx, cy, rx, ry, light, mid, dark) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(LIGHT.x * rx * 0.55, LIGHT.y * rx * 0.55, rx * 0.1, 0, 0, rx);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}
