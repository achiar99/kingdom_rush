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

// The outline every figure on the board is drawn with.
//
// Characters used to be bare gradients, which is why they read as soft smudges
// against the grass while the buildings — which got an ink pass — read as
// objects. Slightly warm and not fully opaque, so a line where two body parts
// overlap suggests a seam rather than cutting the figure in half.
export const FIGURE_INK = "rgba(40,28,20,0.82)";

// How heavy the line is, relative to the mass it wraps. Tuned so a 9px swift
// creep still gets a visible edge and a 38px master doesn't get a crayon
// border: the line grows with the figure but much more slowly than it does.
export const inkWidth = (r) => Math.max(0.9, Math.min(2.2, r * 0.11));

// A shaded sphere: radial gradient with the highlight offset toward the light.
// `lw` is the outline weight; pass 0 for a mass that shouldn't be outlined.
export function shadedSphere(cx, cy, r, light, mid, dark, lw) {
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
  const w = lw === undefined ? inkWidth(r) : lw;
  if (w) { ctx.strokeStyle = FIGURE_INK; ctx.lineWidth = w; ctx.stroke(); }
}

// Like shadedSphere but elliptical — the basic "body blob" for characters.
export function shadedEllipse(cx, cy, rx, ry, light, mid, dark, lw) {
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
  // Stroked outside the scale() so the line keeps an even weight all the way
  // round — inside it, a wide flat body would get a hairline top and a fat side.
  const w = lw === undefined ? inkWidth(Math.max(rx, ry)) : lw;
  if (w) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = FIGURE_INK;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
