// Enemy figures, assembled rather than hand-drawn.
//
// Five stages × six roles is thirty creatures, and thirty bespoke draw
// functions would be thirty places to fix a bug. Instead each creature in
// data/enemyKits.js carries an `art` recipe — a frame (the silhouette), a
// crest (what's on its head), something it carries, and an aura — and this
// module composes the figure from those parts. A new stage is a new kit
// entry, not new rendering code.
//
// Everything is sized off the creep's radius so wave/level scaling keeps
// working, and walk cycles key off e.dist (distance travelled), so monsters
// stop mid-stride when a hoplite blocks them.
import { pointAtDistance } from "../geometry.js";
import { PATH, PATH_LEN } from "../state.js";
import { ctx, groundShadow, shadedSphere, shadedEllipse } from "./canvas.js";

// which way is this creep headed? (for lean/facing; 0 when moving vertically)
function pathDirX(e) {
  if (!PATH.length) return 0;      // drawn outside a level, e.g. in the guide
  const ahead = pointAtDistance(PATH, PATH_LEN, Math.min(e.dist + 4, PATH_LEN));
  const dx = ahead.x - e.x;
  return Math.abs(dx) < 0.3 ? 0 : Math.sign(dx);
}

// ------------------------------------------------------------- shared parts
function monsterFeet(x, cy, r, phase, color, spread = 0.42) {
  const sw = Math.sin(phase);
  ctx.fillStyle = color;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sgn * r * spread, cy + r * 0.8 + sgn * sw * r * 0.09,
      r * 0.26, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
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
// A frame draws the body and returns where the head sits, so crests and
// carried gear can be placed without every recipe knowing the anatomy.

function frameBiped(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 5;
  monsterFeet(x, cy, r, ph, c.dark);
  shadedEllipse(x, cy + r * 0.12, r * 0.72, r * 0.78, c.light, c.mid, c.dark); // torso
  shadedEllipse(x, cy - r * 0.62, r * 0.5, r * 0.46, c.light, c.mid, c.dark);  // head
  return { hx: x, hy: cy - r * 0.62, hr: r * 0.5 };
}

// Long low body on four legs — boars, lions, Cerberus, centaur barrels.
function frameQuadruped(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 4;
  const dir = pathDirX(e) || 1;
  const sw = Math.sin(ph);
  ctx.fillStyle = c.dark;                                    // four legs
  for (const [ox, phase] of [[-0.62, sw], [-0.3, -sw], [0.3, sw], [0.62, -sw]]) {
    ctx.beginPath();
    ctx.ellipse(x + ox * r, cy + r * 0.72 + phase * r * 0.08, r * 0.15, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  shadedEllipse(x, cy + r * 0.15, r * 1.02, r * 0.6, c.light, c.mid, c.dark);  // barrel
  const hx = x + dir * r * 0.85, hy = cy - r * 0.22;
  shadedEllipse(hx, hy, r * 0.44, r * 0.4, c.light, c.mid, c.dark);            // head
  ctx.strokeStyle = c.dark;                                                    // tail
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(x - dir * r * 0.95, cy);
  ctx.quadraticCurveTo(x - dir * r * 1.35, cy - r * 0.3 + sw * r * 0.12, x - dir * r * 1.2, cy + r * 0.25);
  ctx.stroke();
  return { hx, hy, hr: r * 0.44 };
}

// Compact body, wings supplied separately by drawEnemy.
function frameAvian(e, cy) {
  const r = e.radius, c = e.colors, x = e.x;
  const dir = pathDirX(e) || 1;
  shadedEllipse(x, cy, r * 0.72, r * 0.82, c.light, c.mid, c.dark);
  ctx.fillStyle = c.dark;                                    // tail feathers
  ctx.beginPath();
  ctx.moveTo(x - dir * r * 0.5, cy + r * 0.5);
  ctx.lineTo(x - dir * r * 1.15, cy + r * 0.95);
  ctx.lineTo(x - dir * r * 0.38, cy + r * 0.2);
  ctx.closePath();
  ctx.fill();
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
function frameSerpent(e, cy) {
  const r = e.radius, c = e.colors, x = e.x;
  const dir = pathDirX(e) || 1;
  const wave = Math.sin(e.dist / 9);
  ctx.fillStyle = c.dark;                                    // coil on the ground
  ctx.beginPath();
  ctx.ellipse(x, cy + r * 0.55, r * 1.0, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  shadedEllipse(x, cy + r * 0.5, r * 0.85, r * 0.32, c.light, c.mid, c.dark);
  ctx.strokeStyle = c.mid;                                   // rearing neck
  ctx.lineWidth = r * 0.44;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, cy + r * 0.4);
  ctx.quadraticCurveTo(x + wave * r * 0.3, cy - r * 0.2, x + dir * r * 0.18, cy - r * 0.62);
  ctx.stroke();
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
function frameColossus(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 6;
  const sw = Math.sin(ph);
  ctx.fillStyle = c.dark;                                    // pillar legs
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + sgn * r * 0.34 - r * 0.16, cy + r * 0.42 + sgn * sw * r * 0.06,
      r * 0.32, r * 0.6, r * 0.08);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(x - r, cy - r, x + r, cy + r);
  g.addColorStop(0, c.light); g.addColorStop(0.5, c.mid); g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - r * 0.72, cy - r * 0.5, r * 1.44, r * 1.05, r * 0.14);  // torso block
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  for (const sgn of [-1, 1]) {                               // rivets
    ctx.fillStyle = "rgba(255,245,215,0.75)";
    ctx.beginPath();
    ctx.arc(x + sgn * r * 0.5, cy - r * 0.28, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  const hy = cy - r * 0.78;
  ctx.fillStyle = c.mid;
  ctx.beginPath();
  ctx.roundRect(x - r * 0.34, hy - r * 0.3, r * 0.68, r * 0.6, r * 0.1);    // head block
  ctx.fill();
  return { hx: x, hy, hr: r * 0.36 };
}

const FRAMES = {
  biped: frameBiped, quadruped: frameQuadruped, avian: frameAvian,
  serpent: frameSerpent, colossus: frameColossus,
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

const CRESTS = {
  plume: crestPlume, horns: crestHorns, snakes: crestSnakes,
  crown: crestCrown, wisp: crestWisp, wreath: crestWreath,
};

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

const CARRIES = {
  spearShield: carrySpearShield, club: carryClub, bow: carryBow,
  scythe: carryScythe, torch: carryTorch, urn: carryUrn,
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
  let head;
  if (art.scale && art.scale !== 1) {
    // Scale the whole figure about its feet so bigger creatures stand on the
    // same ground line rather than sinking into it.
    ctx.save();
    ctx.translate(e.x, cy + r * 0.9);
    ctx.scale(art.scale, art.scale);
    ctx.translate(-e.x, -(cy + r * 0.9));
    head = frame(e, cy);
  } else {
    head = frame(e, cy);
  }

  // Face, unless a full helm or a wisp is standing in for one.
  const hidden = art.crest === "plume" || art.crest === "wisp";
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
  if (art.carry && CARRIES[art.carry]) CARRIES[art.carry](e, e.x, cy, r);

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
