// Enemy figures, assembled rather than hand-drawn.
//
// Five stages × ten roles is fifty creatures, plus five stage masters, and
// fifty-five bespoke draw functions would be fifty-five places to fix a bug.
// Instead each creature in data/enemyKits.js carries an `art` recipe and this
// module composes the figure from those parts. A new stage is a new kit entry,
// not new rendering code.
//
// The parts are layered in this order, and the order matters:
//
//   aura     the glow that sits behind everything
//   frame    the silhouette — body, limbs, head; reports where the head landed
//   skin     the material laid over the torso the frame just reported
//   face     eyes and mouth, skipped when a crest IS the face
//   crest    helmet, horns, hood, halo
//   carry    whatever is in its hands
//
// Frame and skin do the real work. They were split apart because frame alone
// wasn't enough: with five frames and only head trinkets to tell them apart,
// fifty creatures collapsed into 38 distinct recipes and read as about ten
// monsters in recoloured palettes. A bronze biped and a bone biped share an
// outline and are never confused.
//
// Everything is sized off the creep's radius so wave/level scaling keeps
// working, and walk cycles key off e.dist (distance travelled), so monsters
// stop mid-stride when a hoplite blocks them.
import { pointAtDistance } from "../geometry.js";
import { PATH, PATH_LEN } from "../state.js";
import { ctx, groundShadow, shadedSphere, shadedEllipse, FIGURE_INK, inkWidth } from "./canvas.js";

// which way is this creep headed? (for lean/facing; 0 when moving vertically)
function pathDirX(e) {
  if (!PATH.length) return 0;      // drawn outside a level, e.g. in the guide
  const ahead = pointAtDistance(PATH, PATH_LEN, Math.min(e.dist + 4, PATH_LEN));
  const dx = ahead.x - e.x;
  return Math.abs(dx) < 0.3 ? 0 : Math.sign(dx);
}

// ------------------------------------------------------------- shared parts
// shadedEllipse/shadedSphere ink themselves, but frames draw limbs, tails and
// wings with bare fills and strokes — and those were the only parts of a
// creature left with no outline, which is exactly where the silhouette lives.
// A Cyclops was a crisply drawn chest floating in unoutlined brown mush.
function inkedFill(build, colour, lw) {
  ctx.beginPath();
  build();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.stroke();
}

// A limb: one fat dark pass, then the colour on top of it. Cheaper and better
// looking than trying to outline a stroked path properly.
function inkedStroke(build, colour, w, lw) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  build();
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = w + lw * 1.7;
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = w;
  ctx.stroke();
}

function monsterFeet(x, cy, r, phase, color, spread = 0.42) {
  const sw = Math.sin(phase);
  const lw = inkWidth(r);
  for (const sgn of [-1, 1]) {
    inkedFill(() => ctx.ellipse(x + sgn * r * spread, cy + r * 0.8 + sgn * sw * r * 0.09,
      r * 0.26, r * 0.15, 0, 0, Math.PI * 2), color, lw);
  }
}

// angry eyes: white/tinted sclera, pupil, slanted brows
function angryEyes(x, y, r, o = {}) {
  const ew = r * (o.size || 0.2);
  const off = r * (o.spread || 0.34);
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = o.sclera || "#fff6e6";
    ctx.beginPath();
    ctx.ellipse(x + sgn * off, y, ew, ew * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.pupil || "#1d1626";
    ctx.beginPath();
    ctx.arc(x + sgn * off, y + ew * 0.2, ew * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = o.brow || "rgba(24,10,16,0.85)";
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(x + sgn * (off + ew * 0.9), y - ew * 1.55);
    ctx.lineTo(x + sgn * (off - ew * 0.8), y - ew * 0.85);
    ctx.stroke();
  }
}

// single central eye — cyclopes only
function oneEye(x, y, r) {
  ctx.fillStyle = "#fff6e6";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.3, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a1408";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.05, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(24,10,16,0.85)";
  ctx.lineWidth = Math.max(1.4, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.36, y - r * 0.44);
  ctx.lineTo(x + r * 0.36, y - r * 0.44);
  ctx.stroke();
}

function toothyMouth(x, y, w, h, teeth) {
  ctx.fillStyle = "#3d1220";
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5f0e2";
  const step = (w * 1.5) / (teeth + 1);
  for (let i = 1; i <= teeth; i++) {
    const tx = x - w * 0.75 + i * step;
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.12, y + h * 0.85);
    ctx.lineTo(tx, y - h * 0.35);
    ctx.lineTo(tx + w * 0.12, y + h * 0.85);
    ctx.closePath();
    ctx.fill();
  }
}

// ------------------------------------------------------------------ frames
// A frame draws the body and returns where the head sits, so crests can be
// placed without every recipe knowing the anatomy, plus optionally a grip
// point (gx/gy/gs) for carried gear when the hands are not near the body
// centre or belong to a limb smaller than the creature's radius.
//
// Every frame is handed a `skin` callback and must invoke it with its TRUE
// torso ellipse, at the exact moment the torso is drawn and before the head
// goes on. That ordering is the whole design:
//
// Skins used to run after the frame returned, which meant a chiton or a
// ribcage would paint straight over the creature's face — so frames reported
// a shrunken "head-safe" ellipse instead. That fixed the faces and broke the
// skins: on a hulk the safe region was half the chest, so its fur ringed the
// middle of its belly instead of its outline. Painting before the head means
// the head simply covers any overlap, and every skin gets the real body.

function frameBiped(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 5;
  monsterFeet(x, cy, r, ph, c.dark);
  shadedEllipse(x, cy + r * 0.12, r * 0.72, r * 0.78, c.light, c.mid, c.dark); // torso
  skin(x, cy + r * 0.12, r * 0.72, r * 0.78);
  shadedEllipse(x, cy - r * 0.62, r * 0.5, r * 0.46, c.light, c.mid, c.dark);  // head
  return { hx: x, hy: cy - r * 0.62, hr: r * 0.5 };
}

// Hunched and top-heavy: a small low head sunk between huge shoulders, arms
// long enough to drag. Reads as "big and stupid" from across the board, which
// is exactly what a cyclops or a gigante should read as.
function frameHulk(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 5;
  const dir = pathDirX(e) || 1;
  const sw = Math.sin(ph);
  const lw = inkWidth(r);
  for (const sgn of [-1, 1]) {                               // stumpy legs
    inkedFill(() => ctx.ellipse(x + sgn * r * 0.36, cy + r * 0.82 + sgn * sw * r * 0.07,
      r * 0.28, r * 0.22, 0, 0, Math.PI * 2), c.dark, lw);
  }
  for (const sgn of [-1, 1]) {                               // arms swing opposite
    inkedStroke(() => {
      ctx.moveTo(x + sgn * r * 0.62, cy - r * 0.2);
      ctx.quadraticCurveTo(x + sgn * r * 0.95, cy + r * 0.3,
        x + sgn * r * 0.78 + dir * sw * r * 0.12, cy + r * 0.72);
    }, c.mid, r * 0.34, lw);
  }
  shadedEllipse(x, cy + r * 0.1, r * 0.86, r * 0.7, c.light, c.mid, c.dark);   // barrel chest
  skin(x, cy + r * 0.1, r * 0.86, r * 0.7);
  const hy = cy - r * 0.5;
  shadedEllipse(x + dir * r * 0.1, hy, r * 0.38, r * 0.34, c.light, c.mid, c.dark);
  return { hx: x + dir * r * 0.1, hy, hr: r * 0.38 };
}

// No legs at all — a torso that frays into smoke. The missing ground contact
// is the whole point: it separates the dead from everything else at a glance.
function frameWraith(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x;
  const t = performance.now() / 300;
  const drift = Math.sin(t + e.dist / 20) * r * 0.1;
  ctx.beginPath();                                           // tattered tail
  ctx.moveTo(x - r * 0.6, cy + r * 0.1);
  for (let i = 0; i <= 6; i++) {
    const p = i / 6;
    const w = r * 0.6 * (1 - p * 0.8);
    const wob = Math.sin(t * 1.6 + p * 4) * r * 0.16 * p;
    ctx.lineTo(x - w + wob + drift, cy + r * 0.1 + p * r * 1.15);
  }
  for (let i = 6; i >= 0; i--) {
    const p = i / 6;
    const w = r * 0.6 * (1 - p * 0.8);
    const wob = Math.sin(t * 1.6 + p * 4) * r * 0.16 * p;
    ctx.lineTo(x + w + wob + drift, cy + r * 0.1 + p * r * 1.15);
  }
  ctx.closePath();
  ctx.fillStyle = c.dark;
  ctx.fill();
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = inkWidth(r);
  ctx.stroke();
  shadedEllipse(x, cy - r * 0.05, r * 0.62, r * 0.68, c.light, c.mid, c.dark);
  skin(x, cy - r * 0.05, r * 0.62, r * 0.68);
  const hy = cy - r * 0.72;
  shadedEllipse(x, hy, r * 0.42, r * 0.4, c.light, c.mid, c.dark);
  return { hx: x, hy, hr: r * 0.42 };
}

// Low and many-legged, legs arching ABOVE the body line. Nothing else in the
// bestiary has that outline, so it stays legible even at swarm size.
function frameCrawler(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 3.5;
  const dir = pathDirX(e) || 1;
  const lw = inkWidth(r);
  for (let i = 0; i < 3; i++) {
    for (const sgn of [-1, 1]) {
      const step = Math.sin(ph + i * 1.7 + (sgn > 0 ? Math.PI : 0));
      const ox = (i - 1) * r * 0.5;
      inkedStroke(() => {
        ctx.moveTo(x + ox, cy + r * 0.25);
        ctx.quadraticCurveTo(x + ox + sgn * r * 0.7, cy - r * 0.45,
          x + ox + sgn * r * 0.85, cy + r * 0.6 + step * r * 0.1);
      }, c.dark, Math.max(1.2, r * 0.1), lw * 0.5);
    }
  }
  shadedEllipse(x, cy + r * 0.3, r * 0.8, r * 0.42, c.light, c.mid, c.dark);   // abdomen
  skin(x, cy + r * 0.3, r * 0.8, r * 0.42);
  const hx = x + dir * r * 0.72, hy = cy + r * 0.12;
  shadedEllipse(hx, hy, r * 0.36, r * 0.3, c.light, c.mid, c.dark);            // cephalothorax
  ctx.strokeStyle = c.dark;                                                    // mandibles
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + dir * r * 0.25, hy + sgn * r * 0.1);
    ctx.lineTo(hx + dir * r * 0.6, hy + sgn * r * 0.24);
    ctx.stroke();
  }
  return { hx, hy, hr: r * 0.36 };
}

// Three necks off one coil. Cut one down and the shape still says "hydra",
// which is the right read for the role that splits when it dies.
function frameHydra(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x;
  const t = performance.now() / 340;
  const lw = inkWidth(r);
  inkedFill(() => ctx.ellipse(x, cy + r * 0.6, r * 1.0, r * 0.38, 0, 0, Math.PI * 2),
    c.dark, lw);
  shadedEllipse(x, cy + r * 0.52, r * 0.88, r * 0.34, c.light, c.mid, c.dark);
  skin(x, cy + r * 0.52, r * 0.88, r * 0.34);
  const necks = [-0.62, 0, 0.62];
  const heads = [];
  necks.forEach((off, i) => {
    const sway = Math.sin(t + i * 2.1) * r * 0.14;
    const tipX = x + off * r * 0.95 + sway, tipY = cy - r * (0.5 + (i === 1 ? 0.32 : 0));
    inkedStroke(() => {
      ctx.moveTo(x + off * r * 0.4, cy + r * 0.4);
      ctx.quadraticCurveTo(x + off * r * 0.9, cy - r * 0.05, tipX, tipY);
    }, c.mid, r * 0.26, lw);
    shadedEllipse(tipX, tipY, r * 0.28, r * 0.22, c.light, c.mid, c.dark);
    heads.push({ x: tipX, y: tipY });
  });
  // the outer two get their own little eyes; the centre head is the one the
  // crest/eye pass will decorate
  for (const h of [heads[0], heads[2]]) angryEyes(h.x, h.y, r * 0.44, { size: 0.2, spread: 0.3 });
  return { hx: heads[1].x, hy: heads[1].y, hr: r * 0.28 };
}

// Human above, horse below. Worth its own frame rather than a quadruped with
// a hat: the vertical torso is what makes a centaur read as a centaur.
function frameCentaur(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 4;
  const dir = pathDirX(e) || 1;
  const sw = Math.sin(ph);
  const lw = inkWidth(r);
  for (const [ox, phase] of [[-0.66, sw], [-0.38, -sw], [0.24, sw], [0.5, -sw]]) {
    inkedFill(() => ctx.ellipse(x + ox * r, cy + r * 0.78 + phase * r * 0.08,
      r * 0.14, r * 0.2, 0, 0, Math.PI * 2), c.dark, lw * 0.8);
  }
  shadedEllipse(x - dir * r * 0.15, cy + r * 0.32, r * 0.9, r * 0.46, c.light, c.mid, c.dark);
  skin(x - dir * r * 0.15, cy + r * 0.32, r * 0.9, r * 0.46);
  inkedStroke(() => {                                        // tail
    ctx.moveTo(x - dir * r * 1.0, cy + r * 0.18);
    ctx.quadraticCurveTo(x - dir * r * 1.3, cy + r * 0.5 + sw * r * 0.1,
      x - dir * r * 1.1, cy + r * 0.85);
  }, c.dark, Math.max(1.5, r * 0.12), lw * 0.5);
  const tx = x + dir * r * 0.42;                             // upright human torso
  shadedEllipse(tx, cy - r * 0.28, r * 0.4, r * 0.5, c.light, c.mid, c.dark);
  const hy = cy - r * 0.86;
  shadedEllipse(tx, hy, r * 0.34, r * 0.32, c.light, c.mid, c.dark);
  // The hands are up on the human half, a long way from the body centre, and
  // that half is barely half as wide as a biped's torso. Left to the default
  // anchor and the default size, the hoplon sat dead centre on the horse's
  // back at nearly the width of the whole figure — it read as a shield with
  // legs rather than as a centaur.
  return { hx: tx, hy, hr: r * 0.34, gx: tx + r * 0.3, gy: cy - r * 0.5, gs: 0.72 };
}

// Long low body on four legs — boars, lions, Cerberus, centaur barrels.
function frameQuadruped(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 4;
  const dir = pathDirX(e) || 1;
  const sw = Math.sin(ph);
  const lw = inkWidth(r);
  for (const [ox, phase] of [[-0.62, sw], [-0.3, -sw], [0.3, sw], [0.62, -sw]]) {
    inkedFill(() => ctx.ellipse(x + ox * r, cy + r * 0.72 + phase * r * 0.08,
      r * 0.15, r * 0.2, 0, 0, Math.PI * 2), c.dark, lw * 0.8);
  }
  inkedStroke(() => {                                                          // tail
    ctx.moveTo(x - dir * r * 0.95, cy);
    ctx.quadraticCurveTo(x - dir * r * 1.35, cy - r * 0.3 + sw * r * 0.12,
      x - dir * r * 1.2, cy + r * 0.25);
  }, c.dark, Math.max(1.5, r * 0.11), lw * 0.5);
  shadedEllipse(x, cy + r * 0.15, r * 1.02, r * 0.6, c.light, c.mid, c.dark);  // barrel
  skin(x, cy + r * 0.15, r * 1.02, r * 0.6);
  const hx = x + dir * r * 0.85, hy = cy - r * 0.22;
  shadedEllipse(hx, hy, r * 0.44, r * 0.4, c.light, c.mid, c.dark);            // head
  return { hx, hy, hr: r * 0.44 };
}

// Compact body, wings supplied separately by drawEnemy.
function frameAvian(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x;
  const dir = pathDirX(e) || 1;
  inkedFill(() => {                                          // tail feathers
    ctx.moveTo(x - dir * r * 0.5, cy + r * 0.5);
    ctx.lineTo(x - dir * r * 1.15, cy + r * 0.95);
    ctx.lineTo(x - dir * r * 0.38, cy + r * 0.2);
    ctx.closePath();
  }, c.dark, inkWidth(r) * 0.8);
  shadedEllipse(x, cy, r * 0.72, r * 0.82, c.light, c.mid, c.dark);
  skin(x, cy, r * 0.72, r * 0.82);
  const hx = x + dir * r * 0.28, hy = cy - r * 0.62;
  shadedEllipse(hx, hy, r * 0.36, r * 0.34, c.light, c.mid, c.dark);
  ctx.fillStyle = "#f0c040";                                 // beak
  ctx.beginPath();
  ctx.moveTo(hx + dir * r * 0.3, hy);
  ctx.lineTo(hx + dir * r * 0.75, hy + r * 0.1);
  ctx.lineTo(hx + dir * r * 0.28, hy + r * 0.2);
  ctx.closePath();
  ctx.fill();
  return { hx, hy, hr: r * 0.36 };
}

// Coiled body tapering to a raised head.
function frameSerpent(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x;
  const dir = pathDirX(e) || 1;
  const wave = Math.sin(e.dist / 9);
  const lw = inkWidth(r);
  inkedFill(() => ctx.ellipse(x, cy + r * 0.55, r * 1.0, r * 0.4, 0, 0, Math.PI * 2),
    c.dark, lw);                                             // coil on the ground
  shadedEllipse(x, cy + r * 0.5, r * 0.85, r * 0.32, c.light, c.mid, c.dark);
  skin(x, cy + r * 0.5, r * 0.85, r * 0.32);
  inkedStroke(() => {                                        // rearing neck
    ctx.moveTo(x, cy + r * 0.4);
    ctx.quadraticCurveTo(x + wave * r * 0.3, cy - r * 0.2, x + dir * r * 0.18, cy - r * 0.62);
  }, c.mid, r * 0.44, lw);
  const hx = x + dir * r * 0.18, hy = cy - r * 0.72;
  shadedEllipse(hx, hy, r * 0.42, r * 0.32, c.light, c.mid, c.dark);
  ctx.strokeStyle = "#ff5b4a";                               // forked tongue
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(hx + dir * r * 0.35, hy + r * 0.08);
  ctx.lineTo(hx + dir * r * 0.7, hy + r * 0.14);
  ctx.stroke();
  return { hx, hy, hr: r * 0.42 };
}

// Slab-shouldered bronze construct: squared off, riveted, no soft edges.
function frameColossus(e, cy, skin) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 6;
  const sw = Math.sin(ph);
  const lw = inkWidth(r);
  for (const sgn of [-1, 1]) {                               // pillar legs
    inkedFill(() => ctx.roundRect(x + sgn * r * 0.34 - r * 0.16,
      cy + r * 0.42 + sgn * sw * r * 0.06, r * 0.32, r * 0.6, r * 0.08), c.dark, lw);
  }
  const g = ctx.createLinearGradient(x - r, cy - r, x + r, cy + r);
  g.addColorStop(0, c.light); g.addColorStop(0.5, c.mid); g.addColorStop(1, c.dark);
  inkedFill(() => ctx.roundRect(x - r * 0.72, cy - r * 0.5, r * 1.44, r * 1.05, r * 0.14),
    g, lw);                                                  // torso block
  skin(x, cy + r * 0.02, r * 0.68, r * 0.5);
  for (const sgn of [-1, 1]) {                               // rivets
    ctx.fillStyle = "rgba(255,245,215,0.8)";
    ctx.beginPath();
    ctx.arc(x + sgn * r * 0.5, cy - r * 0.28, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  const hy = cy - r * 0.78;
  inkedFill(() => ctx.roundRect(x - r * 0.34, hy - r * 0.3, r * 0.68, r * 0.6, r * 0.1),
    c.mid, lw);                                              // head block
  return { hx: x, hy, hr: r * 0.36 };
}

const FRAMES = {
  biped: frameBiped, quadruped: frameQuadruped, avian: frameAvian,
  serpent: frameSerpent, colossus: frameColossus,
  hulk: frameHulk, wraith: frameWraith, crawler: frameCrawler,
  hydra: frameHydra, centaur: frameCentaur,
};

// -------------------------------------------------------------------- skins
// A skin is a surface pass over the body the frame just drew. Frames give a
// silhouette; skins give a material.
//
// Splitting the two is what stops fifty creatures reading as ten. Before this
// existed the whole bestiary shared five outlines, and the only things telling
// a Bronze Hoplite from a Skeletal Hoplite were a helmet and a palette — which
// is nothing at all at twelve pixels. A bronze biped and a bone biped now
// share an outline and are still never confused.
//
// Each skin gets the torso ellipse the frame reported. Most clip to it so the
// same function works on a hulk's barrel chest and a serpent's coil; the ones
// that break the outline on purpose (fur, rags) deliberately don't.
function clipBody(b, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(b.bx, b.by, b.brx, b.bry, 0, 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

// Riveted plate with a hard specular band — worked metal, not skin.
function skinBronze(b, c) {
  clipBody(b, () => {
    ctx.strokeStyle = "rgba(60,38,10,0.55)";
    ctx.lineWidth = Math.max(1, b.brx * 0.09);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(b.bx, b.by + i * b.bry * 0.55, b.brx * 1.1, b.bry * 0.34, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,246,214,0.8)";
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(b.bx + sgn * b.brx * 0.55, b.by - b.bry * 0.3, Math.max(1, b.brx * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(b.bx - b.brx, b.by, b.bx + b.brx * 0.2, b.by);
    g.addColorStop(0, "rgba(255,250,225,0)");
    g.addColorStop(0.55, "rgba(255,250,225,0.5)");
    g.addColorStop(1, "rgba(255,250,225,0)");
    ctx.fillStyle = g;
    ctx.fillRect(b.bx - b.brx, b.by - b.bry, b.brx * 1.4, b.bry * 2);
  });
}

// A ribcage over a hollow chest. The single loudest "this thing is dead" cue
// available, and it costs four arcs.
//
// Deliberately does NOT clip: every mark below is inside the torso ellipse by
// construction, and save/clip/restore was the most expensive thing any skin
// did — this was measured as the priciest of the eight before the clip came
// out. Keep the 0.8/0.85 insets if you edit it, or the ribs will escape.
function skinBone(b, c) {
  ctx.fillStyle = "rgba(20,16,24,0.5)";
  ctx.beginPath();
  ctx.ellipse(b.bx, b.by, b.brx * 0.8, b.bry * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#efe6cf";
  ctx.lineWidth = Math.max(1, b.brx * 0.11);
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const yy = b.by - b.bry * 0.5 + i * b.bry * 0.36;
    ctx.beginPath();
    ctx.ellipse(b.bx, yy, b.brx * (0.66 - i * 0.06), b.bry * 0.2, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f6efdc";                          // sternum
  ctx.lineWidth = Math.max(1, b.brx * 0.13);
  ctx.beginPath();
  ctx.moveTo(b.bx, b.by - b.bry * 0.62);
  ctx.lineTo(b.bx, b.by + b.bry * 0.5);
  ctx.stroke();
}

// Overlapping rows of scales — reptiles and sea things.
function skinScales(b, c) {
  clipBody(b, () => {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = Math.max(0.8, b.brx * 0.05);
    const step = Math.max(3, b.brx * 0.3);
    for (let yy = b.by - b.bry; yy < b.by + b.bry; yy += step * 0.7) {
      for (let xx = b.bx - b.brx; xx < b.bx + b.brx; xx += step) {
        const off = (Math.round((yy - b.by) / (step * 0.7)) % 2) * step * 0.5;
        ctx.beginPath();
        ctx.arc(xx + off, yy, step * 0.42, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    }
  });
}

// Shaggy contour. Breaks the outline on purpose, so unlike most skins it does
// not clip — and for the same reason each tuft is its own little triangle
// rather than one closed star. A closed star fills its own middle, which
// painted a flat dark blob over the body and cost the Cyclops, the Minotaur
// and Cerberus their entire silhouette.
function skinFur(b, c) {
  ctx.fillStyle = c.dark;
  const tufts = 14;
  // One path, one fill. The tufts don't overlap, so batching them is identical
  // output for a fraction of the cost — fourteen separate fills made this the
  // most expensive skin of the eight.
  ctx.beginPath();
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2;
    const w = 0.22;
    ctx.moveTo(b.bx + Math.cos(a - w) * b.brx * 0.94, b.by + Math.sin(a - w) * b.bry * 0.94);
    ctx.lineTo(b.bx + Math.cos(a) * b.brx * 1.3, b.by + Math.sin(a) * b.bry * 1.35);
    ctx.lineTo(b.bx + Math.cos(a + w) * b.brx * 0.94, b.by + Math.sin(a + w) * b.bry * 0.94);
    ctx.closePath();
  }
  ctx.fill();
  clipBody(b, () => {
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(0.8, b.brx * 0.06);
    for (let i = 0; i < 5; i++) {
      const xx = b.bx - b.brx * 0.6 + i * b.brx * 0.3;
      ctx.beginPath();
      ctx.moveTo(xx, b.by - b.bry * 0.7);
      ctx.quadraticCurveTo(xx + b.brx * 0.12, b.by, xx, b.by + b.bry * 0.7);
      ctx.stroke();
    }
  });
}

// Fracture lines through cut rock.
function skinStone(b, c) {
  clipBody(b, () => {
    ctx.strokeStyle = "rgba(20,16,12,0.5)";
    ctx.lineWidth = Math.max(1, b.brx * 0.07);
    for (let i = 0; i < 3; i++) {
      const sx = b.bx - b.brx * 0.7 + i * b.brx * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx, b.by - b.bry);
      ctx.lineTo(sx + b.brx * 0.18, b.by - b.bry * 0.2);
      ctx.lineTo(sx - b.brx * 0.1, b.by + b.bry * 0.35);
      ctx.lineTo(sx + b.brx * 0.22, b.by + b.bry);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(b.bx - b.brx * 0.3, b.by - b.bry * 0.4, b.brx * 0.3, b.bry * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Same fractures, lit from inside and breathing. Anything forged in fire.
function skinEmber(b, c) {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260 + b.bx);
  clipBody(b, () => {
    ctx.fillStyle = "rgba(30,12,6,0.55)";
    ctx.beginPath();
    ctx.ellipse(b.bx, b.by, b.brx, b.bry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,${120 + 80 * pulse},40,${0.7 + 0.3 * pulse})`;
    ctx.lineWidth = Math.max(1.2, b.brx * 0.1);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const sx = b.bx - b.brx * 0.55 + i * b.brx * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx, b.by - b.bry * 0.9);
      ctx.lineTo(sx + b.brx * 0.2, b.by - b.bry * 0.1);
      ctx.lineTo(sx - b.brx * 0.12, b.by + b.bry * 0.9);
      ctx.stroke();
    }
  });
}

// Hanging strips of rotted cloth. Like fur, it must escape the ellipse.
function skinTattered(b, c) {
  ctx.fillStyle = c.dark;
  const t = performance.now() / 400;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const xx = b.bx - b.brx * 0.75 + i * b.brx * 0.375;
    const len = b.bry * (0.5 + ((i * 7) % 5) * 0.16);
    const sway = Math.sin(t + i) * b.brx * 0.1;
    ctx.moveTo(xx - b.brx * 0.16, b.by + b.bry * 0.3);
    ctx.lineTo(xx + b.brx * 0.16, b.by + b.bry * 0.3);
    ctx.lineTo(xx + sway, b.by + b.bry * 0.3 + len);
    ctx.closePath();
  }
  ctx.fill();
  clipBody(b, () => {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(0.8, b.brx * 0.06);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(b.bx - b.brx, b.by - b.bry * 0.4 + i * b.bry * 0.45);
      ctx.lineTo(b.bx + b.brx, b.by - b.bry * 0.6 + i * b.bry * 0.45);
      ctx.stroke();
    }
  });
}

// Draped linen with a belt — the living, civilised half of the bestiary.
function skinChiton(b, c) {
  clipBody(b, () => {
    ctx.fillStyle = "rgba(248,244,228,0.82)";
    ctx.beginPath();
    ctx.moveTo(b.bx - b.brx, b.by - b.bry * 0.1);
    ctx.lineTo(b.bx + b.brx, b.by - b.bry * 0.45);
    ctx.lineTo(b.bx + b.brx, b.by + b.bry);
    ctx.lineTo(b.bx - b.brx, b.by + b.bry);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(150,140,110,0.55)";       // folds
    ctx.lineWidth = Math.max(0.8, b.brx * 0.06);
    for (let i = 0; i < 4; i++) {
      const xx = b.bx - b.brx * 0.6 + i * b.brx * 0.4;
      ctx.beginPath();
      ctx.moveTo(xx, b.by - b.bry * 0.2);
      ctx.lineTo(xx - b.brx * 0.08, b.by + b.bry);
      ctx.stroke();
    }
    ctx.fillStyle = c.mid;                            // belt
    ctx.fillRect(b.bx - b.brx, b.by + b.bry * 0.18, b.brx * 2, b.bry * 0.2);
  });
}

const SKINS = {
  bronze: skinBronze, bone: skinBone, scales: skinScales, fur: skinFur,
  stone: skinStone, ember: skinEmber, tattered: skinTattered, chiton: skinChiton,
};

// ------------------------------------------------------------------ crests
function crestPlume(x, y, r, colors) {
  const hg = ctx.createLinearGradient(x, y - r * 0.7, x, y + r * 0.3);
  hg.addColorStop(0, "#f2e2b8"); hg.addColorStop(1, colors.dark);
  ctx.fillStyle = hg;                                        // corinthian helm
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b8302a";                                 // horsehair crest
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.5);
  ctx.quadraticCurveTo(x, y - r * 1.5, x + r * 0.5, y - r * 0.5);
  ctx.quadraticCurveTo(x, y - r * 0.95, x - r * 0.5, y - r * 0.5);
  ctx.fill();
  ctx.fillStyle = "#141a26";                                 // eye slit
  ctx.beginPath();
  ctx.roundRect(x - r * 0.4, y - r * 0.18, r * 0.8, r * 0.18, r * 0.09);
  ctx.fill();
}

function crestHorns(x, y, r, _colors) {
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = "#e8dcc4";
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.35, y - r * 0.2);
    ctx.quadraticCurveTo(x + sgn * r * 1.05, y - r * 0.5, x + sgn * r * 0.9, y - r * 1.1);
    ctx.quadraticCurveTo(x + sgn * r * 0.6, y - r * 0.6, x + sgn * r * 0.58, y - r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,20,0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function crestSnakes(x, y, r, _colors) {
  const t = performance.now() / 260;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI;
    const wig = Math.sin(t + i) * 0.28;
    ctx.strokeStyle = i % 2 ? "#5faa5f" : "#8fd08f";
    ctx.lineWidth = Math.max(1.4, r * 0.13);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.1);
    ctx.quadraticCurveTo(
      x + Math.cos(a + wig) * r * 0.9, y + Math.sin(a + wig) * r * 0.9,
      x + Math.cos(a + wig) * r * 1.35, y + Math.sin(a + wig) * r * 1.25 - r * 0.2);
    ctx.stroke();
  }
}

function crestCrown(x, y, r, _colors) {
  const top = y - r * 0.9;
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, top);
  ctx.lineTo(x - r * 0.7, top - r * 0.4);
  ctx.lineTo(x - r * 0.35, top - r * 0.12);
  ctx.lineTo(x, top - r * 0.52);
  ctx.lineTo(x + r * 0.35, top - r * 0.12);
  ctx.lineTo(x + r * 0.7, top - r * 0.4);
  ctx.lineTo(x + r * 0.7, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// a cold drifting flame where a face should be
function crestWisp(x, y, r, _colors) {
  const f = 0.5 + 0.5 * Math.sin(performance.now() / 150);
  const g = ctx.createRadialGradient(x, y - r * 0.5, 0, x, y - r * 0.5, r * 0.9);
  g.addColorStop(0, `rgba(190,230,255,${0.55 + 0.25 * f})`);
  g.addColorStop(1, "rgba(120,170,230,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.5, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

// A laurel wreath — the mark of the warded, who are consecrated rather than
// armoured.
function crestWreath(x, y, r, _colors) {
  ctx.strokeStyle = "#5f9a4a";
  ctx.lineWidth = Math.max(1.4, r * 0.13);
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 0.85, s > 0 ? -1.5 : Math.PI + 0.3,
            s > 0 ? -0.15 : Math.PI + 1.65);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {                 // leaves
      const a = (s > 0 ? -1.3 + i * 0.4 : Math.PI + 0.5 + i * 0.4);
      const lx = x + Math.cos(a) * r * 0.85, ly = y - r * 0.15 + Math.sin(a) * r * 0.85;
      ctx.fillStyle = i % 2 ? "#8fc46a" : "#4f8a3c";
      ctx.beginPath();
      ctx.ellipse(lx, ly, r * 0.2, r * 0.1, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A shaggy ruff around the whole head — lions, wolves, anything that hunts.
// Drawn as separate outward tufts rather than one closed star, because a
// closed star fills its own middle — which would paint over the face this
// crest is supposed to be framing.
function crestMane(x, y, r, colors) {
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const w = 0.26;
    ctx.moveTo(x + Math.cos(a - w) * r * 0.95, y + Math.sin(a - w) * r * 0.95);
    ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5);
    ctx.lineTo(x + Math.cos(a + w) * r * 0.95, y + Math.sin(a + w) * r * 0.95);
    ctx.closePath();
  }
  ctx.fill();
}

// Branching antlers — taller and airier than horns, so the two never blur.
function crestAntlers(x, y, r, _colors) {
  ctx.strokeStyle = "#c9b48c";
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.lineCap = "round";
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.3, y - r * 0.3);
    ctx.lineTo(x + sgn * r * 0.62, y - r * 1.5);
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const ty = y - r * (0.7 + i * 0.45);
      ctx.beginPath();
      ctx.moveTo(x + sgn * r * (0.42 + i * 0.08), ty);
      ctx.lineTo(x + sgn * r * (1.05 + i * 0.12), ty - r * 0.42);
      ctx.stroke();
    }
  }
}

// A bare skull worn as (or instead of) a face — replaces the eye pass.
function crestSkullface(x, y, r, _colors) {
  ctx.fillStyle = "#efe7d2";
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.05, r * 0.7, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe7d2";
  ctx.beginPath();
  ctx.roundRect(x - r * 0.34, y + r * 0.5, r * 0.68, r * 0.36, r * 0.1);  // jaw
  ctx.fill();
  ctx.fillStyle = "#241a22";
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sgn * r * 0.3, y - r * 0.1, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.12);
  ctx.lineTo(x - r * 0.13, y + r * 0.42);
  ctx.lineTo(x + r * 0.13, y + r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,50,40,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3 + i * r * 0.3, y + r * 0.5);
    ctx.lineTo(x - r * 0.3 + i * r * 0.3, y + r * 0.86);
    ctx.stroke();
  }
}

// A ring of cold light standing off the head — divine, or pretending to be.
function crestHalo(x, y, r, _colors) {
  const t = performance.now() / 900;
  ctx.strokeStyle = `rgba(255,232,150,${0.6 + 0.25 * Math.sin(t * 4)})`;
  ctx.lineWidth = Math.max(1.4, r * 0.12);
  ctx.beginPath();
  ctx.ellipse(x, y - r * 1.15, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  const g = ctx.createRadialGradient(x, y - r * 1.15, 0, x, y - r * 1.15, r * 1.2);
  g.addColorStop(0, "rgba(255,240,180,0.3)");
  g.addColorStop(1, "rgba(255,220,120,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - r * 1.15, r * 1.2, 0, Math.PI * 2);
  ctx.fill();
}

// A deep cowl with two lights inside it. Reads at any size.
function crestHood(x, y, r, colors) {
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y + r * 0.7);
  ctx.quadraticCurveTo(x - r * 0.95, y - r * 1.0, x, y - r * 1.05);
  ctx.quadraticCurveTo(x + r * 0.95, y - r * 1.0, x + r * 0.85, y + r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(8,4,12,0.92)";                    // shadowed opening
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.05, r * 0.5, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  const f = 0.6 + 0.4 * Math.sin(performance.now() / 320 + x);
  ctx.fillStyle = `rgba(180,230,255,${0.7 + 0.3 * f})`;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sgn * r * 0.2, y, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CRESTS = {
  plume: crestPlume, horns: crestHorns, snakes: crestSnakes,
  crown: crestCrown, wisp: crestWisp, wreath: crestWreath,
  mane: crestMane, antlers: crestAntlers, skullface: crestSkullface,
  halo: crestHalo, hood: crestHood,
};

// Crests that ARE the face — the eye/mouth pass must not draw over them.
const FACE_CRESTS = new Set(["plume", "wisp", "skullface", "hood"]);

// ------------------------------------------------------------- carried gear
function carrySpearShield(e, x, y, r) {
  const jab = e.engaged ? Math.sin(performance.now() / 90) * r * 0.3 : 0;
  ctx.strokeStyle = "#7a5630";                               // spear shaft
  ctx.lineWidth = Math.max(1.6, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + r * 0.7);
  ctx.lineTo(x + r * 0.95 + jab, y - r * 0.95);
  ctx.stroke();
  ctx.fillStyle = "#e8e2cc";                                 // leaf blade
  ctx.beginPath();
  ctx.moveTo(x + r * 0.95 + jab, y - r * 1.35);
  ctx.lineTo(x + r * 1.12 + jab, y - r * 0.9);
  ctx.lineTo(x + r * 0.78 + jab, y - r * 0.9);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.6, y, 0, x - r * 0.6, y, r * 0.62);
  g.addColorStop(0, "#e8c070"); g.addColorStop(1, "#8a5a14");
  ctx.fillStyle = g;                                         // hoplon
  ctx.beginPath();
  ctx.arc(x - r * 0.6, y + r * 0.1, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,24,8,0.6)";
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.6, y + r * 0.1, r * 0.26, 0, Math.PI * 2);
  ctx.stroke();
}

function carryClub(e, x, y, r) {
  const swing = e.engaged ? Math.sin(performance.now() / 90) * 0.55 : Math.sin(e.dist / 5) * 0.12;
  ctx.save();
  ctx.translate(x + r * 0.8, y);
  ctx.rotate(-0.75 + swing);
  const g = ctx.createLinearGradient(0, 0, 0, -r * 1.1);
  g.addColorStop(0, "#6e4a26"); g.addColorStop(1, "#4a2f14");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-r * 0.11, -r * 1.05, r * 0.22, r * 1.05, r * 0.11);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 1.0, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function carryBow(e, x, y, r) {
  ctx.strokeStyle = "#8a6234";
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  ctx.arc(x + r * 0.75, y, r * 0.66, -1.1, 1.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(240,235,215,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r * 1.05, y - r * 0.58);
  ctx.lineTo(x + r * 1.05, y + r * 0.58);
  ctx.stroke();
}

function carryScythe(e, x, y, r) {
  ctx.strokeStyle = "#4a4038";
  ctx.lineWidth = Math.max(1.6, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + r * 0.8);
  ctx.lineTo(x + r * 0.85, y - r * 1.25);
  ctx.stroke();
  ctx.strokeStyle = "#cfe4f2";
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.arc(x + r * 0.85, y - r * 1.2, r * 0.62, Math.PI * 0.95, Math.PI * 1.85);
  ctx.stroke();
}

// A raised torch — a priest's implement, and a bright point that reads at
// small size.
function carryTorch(e, x, y, r) {
  const flick = 0.6 + 0.4 * Math.sin(performance.now() / 90 + x);
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.72, y + r * 0.5);
  ctx.lineTo(x + r * 0.9, y - r * 0.75);
  ctx.stroke();
  const g = ctx.createRadialGradient(x + r * 0.9, y - r, 0, x + r * 0.9, y - r, r * 0.7 * flick);
  g.addColorStop(0, "rgba(255,225,150,0.95)");
  g.addColorStop(1, "rgba(255,150,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + r * 0.9, y - r, r * 0.7 * flick, 0, Math.PI * 2);
  ctx.fill();
}

// A cradled urn — what a brood carries its young in.
function carryUrn(e, x, y, r) {
  ctx.fillStyle = "#8a4a24";
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y + r * 0.45);
  ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.1, x + r * 0.6, y - r * 0.5);
  ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.1, x + r * 0.9, y + r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,14,6,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A heavy double-bitted labrys, hefted overhead when engaged.
function carryAxe(e, x, y, r) {
  const swing = e.engaged ? Math.sin(performance.now() / 80) * 0.7 : Math.sin(e.dist / 6) * 0.1;
  ctx.save();
  ctx.translate(x + r * 0.75, y - r * 0.1);
  ctx.rotate(-0.5 + swing);
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = Math.max(1.6, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.8);
  ctx.lineTo(0, -r * 0.95);
  ctx.stroke();
  ctx.fillStyle = "#d8d2bc";
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.quadraticCurveTo(sgn * r * 0.75, -r * 0.95, sgn * r * 0.5, -r * 0.35);
    ctx.quadraticCurveTo(sgn * r * 0.2, -r * 0.6, 0, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40,30,16,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// Three prongs — the sea's weapon, and the underworld's.
function carryTrident(e, x, y, r) {
  const jab = e.engaged ? Math.sin(performance.now() / 85) * r * 0.32 : 0;
  ctx.strokeStyle = "#5a6a72";
  ctx.lineWidth = Math.max(1.6, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + r * 0.8);
  ctx.lineTo(x + r * 0.92 + jab, y - r * 0.85);
  ctx.stroke();
  ctx.strokeStyle = "#dfeaf0";
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.lineCap = "round";
  for (const off of [-0.3, 0, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(x + r * (0.92 + off * 0.6) + jab, y - r * 0.85);
    ctx.lineTo(x + r * (0.92 + off) + jab, y - r * 1.45);
    ctx.stroke();
  }
}

// Two short blades, held low and crossed — assassins and beast-handlers.
function carryTwinBlades(e, x, y, r) {
  const flick = e.engaged ? Math.sin(performance.now() / 70) * 0.5 : 0;
  ctx.strokeStyle = "#e2e8ec";
  ctx.lineWidth = Math.max(1.6, r * 0.11);
  ctx.lineCap = "round";
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.55, y + r * 0.3);
    ctx.lineTo(x + sgn * r * (1.0 + flick * 0.3), y - r * 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.45, y + r * 0.5);
    ctx.lineTo(x + sgn * r * 0.6, y + r * 0.22);
    ctx.stroke();
  }
}

// A lyre, with strings that shiver. Nothing else in the kit is an instrument.
function carryLyre(e, x, y, r) {
  const t = performance.now() / 120;
  ctx.strokeStyle = "#c8a24a";
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.45, y + r * 0.45);
  ctx.quadraticCurveTo(x + r * 0.35, y - r * 0.6, x + r * 0.62, y - r * 0.9);
  ctx.moveTo(x + r * 1.0, y + r * 0.45);
  ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.6, x + r * 0.83, y - r * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.45, y + r * 0.45);
  ctx.lineTo(x + r * 1.0, y + r * 0.45);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,248,220,0.75)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sx = x + r * (0.56 + i * 0.12) + Math.sin(t + i) * r * 0.02;
    ctx.beginPath();
    ctx.moveTo(sx, y + r * 0.42);
    ctx.lineTo(sx, y - r * 0.85);
    ctx.stroke();
  }
}

const CARRIES = {
  spearShield: carrySpearShield, club: carryClub, bow: carryBow,
  scythe: carryScythe, torch: carryTorch, urn: carryUrn,
  axe: carryAxe, trident: carryTrident, twinBlades: carryTwinBlades,
  lyre: carryLyre,
};

// ------------------------------------------------------------------- auras
function auraFlame(x, y, r) {
  const f = 0.5 + 0.5 * Math.sin(performance.now() / 80);
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.5);
  g.addColorStop(0, `rgba(255,150,50,${0.22 + 0.1 * f})`);
  g.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function auraSpectral(x, y, r) {
  const f = 0.5 + 0.5 * Math.sin(performance.now() / 220);
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.45);
  g.addColorStop(0, `rgba(170,210,255,${0.2 + 0.12 * f})`);
  g.addColorStop(1, "rgba(120,150,220,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.45, 0, Math.PI * 2);
  ctx.fill();
}

function auraStorm(x, y, r) {
  const t = performance.now() / 100;
  ctx.strokeStyle = `rgba(200,240,255,${0.35 + 0.3 * Math.abs(Math.sin(t))})`;
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 0; i < 3; i++) {
    const a = t * 0.6 + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.1 + 0.12 * i), a, a + 1.1);
    ctx.stroke();
  }
}

// A hexagonal shimmer — the visible sign that sorcery slides off this one.
function auraWard(x, y, r) {
  const t = performance.now() / 700;
  ctx.strokeStyle = `rgba(150,220,255,${0.35 + 0.2 * Math.sin(t * 3)})`;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = t + (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r * 1.3, py = y + Math.sin(a) * r * 1.3;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

// Green motes drifting upward — something is putting itself back together.
function auraRegen(x, y, r) {
  const t = performance.now() / 420;
  for (let i = 0; i < 4; i++) {
    const ph = (t + i * 0.25) % 1;
    const px = x + Math.sin((i * 2.1) + t * 2) * r * 0.7;
    const py = y + r * 0.6 - ph * r * 1.9;
    ctx.fillStyle = `rgba(120,240,160,${0.55 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

const AURAS = {
  flame: auraFlame, spectral: auraSpectral, storm: auraStorm,
  ward: auraWard, regen: auraRegen,
};

// ------------------------------------------------------------------- entry
export function drawEnemy(e) {
  const art = e.def.art || {};
  const r = e.radius;
  const lift = e.flying ? 18 : 0;      // flyers hover above their ground shadow
  const cy = e.y - lift;

  // ground shadow stays on the path; flyers cast a smaller, detached one
  if (e.flying) groundShadow(e.x + 3, e.y + 3, r * 1.0, r * 0.45);
  else groundShadow(e.x + 2, e.y + r * 0.75, r * 1.3, r * 0.5);

  // Stage masters get a standing ring of gold light regardless of what their
  // aura slot is doing. It's a marker rather than an effect: the one thing
  // every master has in common is that it is a master.
  if (e.def.role === "master") {
    const t = performance.now() / 500;
    const ring = ctx.createRadialGradient(e.x, cy + r * 0.5, r * 0.3, e.x, cy + r * 0.5, r * 1.9);
    ring.addColorStop(0, "rgba(255,206,90,0.30)");
    ring.addColorStop(1, "rgba(255,170,40,0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.ellipse(e.x, cy + r * 0.5, r * 1.9, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,214,110,${0.45 + 0.25 * Math.sin(t)})`;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(e.x, cy + r * 0.62, r * 1.45, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (art.aura && AURAS[art.aura]) AURAS[art.aura](e.x, cy, r);
  if (e.flying) drawWings(e.x, cy, r, e.colors);

  const frame = FRAMES[art.frame] || frameBiped;
  // The frame calls this the moment it has drawn its torso and before it draws
  // its head, which is what lets a skin use the real body — see the note above
  // the frames.
  const skinFn = art.skin && SKINS[art.skin];
  const paintSkin = skinFn
    ? (bx, by, brx, bry) => skinFn({ bx, by, brx, bry }, e.colors, e)
    : () => {};
  let head;
  if (art.scale && art.scale !== 1) {
    // Scale the whole figure about its feet so bigger creatures stand on the
    // same ground line rather than sinking into it.
    ctx.save();
    ctx.translate(e.x, cy + r * 0.9);
    ctx.scale(art.scale, art.scale);
    ctx.translate(-e.x, -(cy + r * 0.9));
    head = frame(e, cy, paintSkin);
  } else {
    head = frame(e, cy, paintSkin);
  }

  // Face, unless a helm, cowl or skull is standing in for one.
  const hidden = FACE_CRESTS.has(art.crest);
  if (!hidden) {
    if (art.eye === "single" || art.frame === "colossus") oneEye(head.hx, head.hy, head.hr);
    else {
      angryEyes(head.hx, head.hy - head.hr * 0.1, head.hr * 2,
        { size: 0.16, spread: 0.3, sclera: art.aura === "spectral" ? "#cfe4ff" : "#fff6e6" });
      if (art.frame !== "avian") toothyMouth(head.hx, head.hy + head.hr * 0.62, head.hr * 0.5, head.hr * 0.2, 3);
    }
  }
  // every crest takes (x, y, r, colors) — only some of them use the colours
  if (art.crest && CRESTS[art.crest]) CRESTS[art.crest](head.hx, head.hy, head.hr, e.colors);
  // Gear hangs off the grip point when the frame reports one, otherwise off
  // the body centre — and is sized by `gs`, since every carry is drawn in
  // units of the creature's radius and a compound frame's hands belong to a
  // limb much smaller than that.
  if (art.carry && CARRIES[art.carry])
    CARRIES[art.carry](e, head.gx ?? e.x, head.gy ?? cy, r * (head.gs ?? 1));

  if (art.scale && art.scale !== 1) ctx.restore();

  if (e.burning) drawBurning(e.x, cy, r);

  // hp bar (width scales with size; sits above horns/crests). The Field Guide
  // draws creatures as reference art rather than as live creeps, so it opts
  // out — a full green bar over every bestiary tile is pure clutter.
  if (e.hideHpBar) return;
  const w = Math.max(24, r * 2), h = e.boss ? 6 : 4;
  const barY = cy - r * (e.boss ? 1.75 : 1.45) - 8;
  const pct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(e.x - w / 2, barY, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
  ctx.fillRect(e.x - w / 2, barY, w * pct, h);
}

function drawBurning(x, y, r) {
  // a warm glow plus a flickering flame glyph riding on top of the body
  const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 70);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
  g.addColorStop(0, `rgba(255,140,40,${0.28 + 0.12 * flicker})`);
  g.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = (12 + flicker * 2) + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔥", x, y - r - 2);
}

// Feathered wings, tinted to the creature so a Ker and a Storm Eidolon don't
// share the same leathery bat pair.
function drawWings(x, y, r, colors) {
  const flap = Math.sin(performance.now() / 90) * 0.35;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s * (0.5 + flap));
    const g = ctx.createLinearGradient(0, -r * 0.4, s * r * 1.8, r * 0.4);
    g.addColorStop(0, colors.mid);
    g.addColorStop(1, colors.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s * r * 0.95, -2, r * 1.15, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,250,235,0.25)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.25, -1);
      ctx.lineTo(s * r * (0.55 + i * 0.45), -2 + (i - 2) * r * 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export { shadedSphere };
