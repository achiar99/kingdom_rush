// Tower buildings.
//
// The one rule this file exists to enforce: every tower must be identifiable
// by SILHOUETTE alone. At this size nobody reads detail — they read outline.
// An earlier pass gave three of the four the same white marble box under the
// same red triangular roof, and the only way to tell a Toxotai from an Oracle
// was to squint at what was standing inside it.
//
//   Toxotai   tall and narrow, crenellated top, no roof   — a vertical bar
//   Catapult  timber, low, one long arm angled up          — a diagonal
//   Oracle    circular, domed, glowing                     — a dome
//   Phalanx   wide and squat, open front, shields          — a horizontal bar
//
// Specialisations change the structure again rather than just the palette, so
// a specialised spot is also readable without clicking it.
//
// Imports acquireTarget from simulation.js, which (via ui.js) imports back
// from the render package. Safe circularity — every cross-reference is only
// called inside a function body (see simulation.js for the full note).
import { acquireTarget } from "../simulation.js";
import { ctx, groundShadow } from "./canvas.js";

// -------------------------------------------------------------- ink & form
// What separates a toy-looking tower from a good one is mostly not the shape.
// The silhouettes below were already distinct and the buildings still read as
// pale smudges, because four things were missing:
//
//   1. an INK LINE around every mass — by far the biggest single factor
//   2. a warm palette with real value contrast (cream on pale grass has none)
//   3. a lit top face, so a box reads as a solid and not a rectangle
//   4. one or two saturated accents — terracotta, gold, crimson cloth
//
// Everything in this section exists to make those cheap to apply consistently.
const INK = "#31241a";

// Warm, high-contrast, and deliberately not white: the old marble topped out
// at #f7f2e6 and bottomed at #a8a08e, barely two stops apart.
const MARBLE = { lit: "#fff8e8", mid: "#e2d3ae", dark: "#9c8664", deep: "#6d5941" };
const TIMBER = { lit: "#b98a4e", mid: "#8a5f30", dark: "#553719", deep: "#33200e" };
const TERRA  = { lit: "#e0764a", mid: "#bc4f2b", dark: "#822f18", deep: "#511a0c" };
const NIGHT  = { lit: "#9a86b4", mid: "#5f4c7c", dark: "#3a2a52", deep: "#221636" };
const GOLD   = "#f2c14e", GOLD_DARK = "#a9762a";

function ink(w = 1.8) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = "round";
}

// Trace a polygon, fill it, and ink it. The workhorse.
function shape(pts, fill, lw = 1.8) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ink(lw); ctx.stroke(); }
}

function vgrad(x, y, w, h, pal) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, pal.lit);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.dark);
  void w;
  return g;
}

// A box seen slightly from above: front face, a lighter top face skewed to the
// right, and one ink outline around the pair. `d` is how much of the top shows.
function block(x, y, w, h, pal, d = 5, lw = 1.8) {
  ctx.fillStyle = vgrad(x, y, w, h, pal);
  ctx.fillRect(x, y, w, h);
  shape([[x, y], [x + d, y - d * 0.62], [x + w + d, y - d * 0.62], [x + w, y]], pal.lit, 0);
  ctx.fillStyle = "rgba(0,0,0,0.16)";                     // contact shade
  ctx.fillRect(x, y + h - h * 0.16, w, h * 0.16);
  shape([[x, y + h], [x, y], [x + d, y - d * 0.62], [x + w + d, y - d * 0.62],
         [x + w, y], [x + w, y + h]], null, lw);
  ctx.beginPath();                                        // the top's near edge
  ctx.moveTo(x, y); ctx.lineTo(x + w, y);
  ink(lw * 0.7); ctx.stroke();
}

// Individual masonry blocks rather than ruled lines. Reads as built rather
// than extruded, and gives the eye something at small size.
function coursing(x, y, w, h, rows, cols = 3) {
  ctx.strokeStyle = "rgba(70,54,36,0.28)";
  ctx.lineWidth = 0.9;
  const rh = h / rows;
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * rh); ctx.lineTo(x + w, y + r * rh);
    ctx.stroke();
  }
  for (let r = 0; r < rows; r++)
    for (let c = 1; c < cols; c++) {
      const off = r % 2 ? w / (cols * 2) : 0;
      const jx = x + c * (w / cols) + off;
      if (jx >= x + w - 1) continue;
      ctx.beginPath();
      ctx.moveTo(jx, y + r * rh); ctx.lineTo(jx, y + (r + 1) * rh);
      ctx.stroke();
    }
}

// Terracotta pantiles with visible barrel courses — the roof is the loudest
// colour on the board, which is what makes the buildings pop off the grass.
function tiledRoof(cx, eaveY, halfW, h, pal = TERRA) {
  const peakY = eaveY - h;
  shape([[cx - halfW, eaveY], [cx - halfW * 0.52, peakY], [cx + halfW * 0.52, peakY],
         [cx + halfW, eaveY]], vgrad(cx, peakY, 0, h, pal), 1.9);
  ctx.strokeStyle = "rgba(255,220,180,0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 2; i++) {
    const f = i / 3, yy = peakY + h * f;
    const hw = halfW * (0.52 + 0.48 * f);
    ctx.beginPath();
    ctx.moveTo(cx - hw, yy); ctx.lineTo(cx + hw, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(90,30,12,0.35)";                // pantile ribs
  ctx.lineWidth = 0.9;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * halfW * 0.17, peakY);
    ctx.lineTo(cx + i * halfW * 0.31, eaveY);
    ctx.stroke();
  }
  shape([[cx - halfW - 2, eaveY], [cx + halfW + 2, eaveY],
         [cx + halfW + 2, eaveY + 3], [cx - halfW - 2, eaveY + 3]], pal.lit, 1.6);
}

// A hanging cloth pennant with a lazy wave. Pure decoration, and the single
// cheapest thing that makes a building look inhabited.
function banner(x, y, w, h, colour, phase = 0) {
  const t = performance.now() / 520 + phase;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  for (let i = 0; i <= 4; i++) {
    const f = 1 - i / 4;
    ctx.lineTo(x + w / 2 + Math.sin(t + f * 2.6) * 1.6 * (1 - f),
      y + h * f + (i === 0 ? 0 : 0));
  }
  ctx.lineTo(x + Math.sin(t + 1.3) * 2, y + h + 3);       // swallowtail
  ctx.lineTo(x - w / 2 + Math.sin(t + 2.2) * 1.6, y + h);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ink(1.3); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(x - w / 2 + 1, y + 1, w - 2, 1.4);
}

// Rock and turf under the building. Grounds it instead of letting a flat slab
// float on the grass.
//
// Deliberately restrained. The first attempt stacked a brown earth mound, a
// bright turf lip, scattered rocks AND the marble plinth on top of each other,
// and the result read as the building standing on a green shelf. Ground
// dressing works by suggestion: a soft shadow, two pebbles and a few blades
// poking out from behind the stone are enough to seat it.
function rockBase(x, y, wide) {
  groundShadow(x + 5, y + 13, wide + 9, 9);
  for (const [rx, rr] of [[-wide - 3, 2.6], [wide + 4, 2], [-wide * 0.2, 1.6]]) {
    shape([[x + rx - rr, y + 12.5], [x + rx - rr * 0.5, y + 12.5 - rr],
           [x + rx + rr * 0.6, y + 12.5 - rr * 0.8], [x + rx + rr, y + 12.5]],
      "#9c8a70", 1.1);
  }
  ctx.strokeStyle = "rgba(66,102,48,0.85)";               // blades behind the stone
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  for (const gx of [-wide - 4, wide + 4]) {
    for (const lean of [-1, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(x + gx, y + 13);
      ctx.quadraticCurveTo(x + gx + lean * 1.2, y + 10.5, x + gx + lean * 2.2, y + 9.4);
      ctx.stroke();
    }
  }
}

function column(cx, baseY, h, w = 7) {
  const x = cx - w / 2, y = baseY - h;
  ctx.fillStyle = vgrad(x, y, w, h, MARBLE);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(120,98,66,0.35)";               // flutes
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (i * w) / 3, y + 1); ctx.lineTo(x + (i * w) / 3, y + h - 1);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,252,240,0.5)";
  ctx.fillRect(x, y, 1.5, h);
  ink(1.4);
  ctx.strokeRect(x, y, w, h);
  shape([[x - 1.8, y], [x + w + 1.8, y], [x + w + 1.8, y - 3.2], [x - 1.8, y - 3.2]],
    MARBLE.lit, 1.4);                                     // capital
  shape([[x - 1.4, baseY], [x + w + 1.4, baseY], [x + w + 1.4, baseY - 2.2],
         [x - 1.4, baseY - 2.2]], MARBLE.mid, 1.3);       // base
}

// Stepped footing + level pips. `wide` lets a squat building sit on a broader
// base than a narrow tower, which is half of what separates their outlines.
function footing(t, wide = 16) {
  rockBase(t.x, t.y, wide);
  shape([[t.x - wide - 2, t.y + 6], [t.x + wide + 2, t.y + 6],
         [t.x + wide + 2, t.y + 13], [t.x - wide - 2, t.y + 13]],
    vgrad(0, t.y + 6, 0, 7, MARBLE), 1.7);
  shape([[t.x - wide, t.y + 1], [t.x + wide, t.y + 1],
         [t.x + wide, t.y + 7], [t.x - wide, t.y + 7]],
    vgrad(0, t.y + 1, 0, 6, MARBLE), 1.7);
  levelPips(t, wide);
}

// Gold studs for tower level, and a laurel sprig once it's specialised.
//
// Both sit ON the plinth face rather than below it. Floating them under the
// stone left a row of loose dots and two green arcs hanging in the grass with
// nothing to belong to.
function levelPips(t, wide) {
  for (let i = 0; i < t.level - 1; i++) {
    const px = t.x - (t.level - 2) * 4 + i * 8;
    ctx.beginPath();
    ctx.arc(px, t.y + 9.5, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = GOLD; ctx.fill();
    ink(1.1); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(px - 0.7, t.y + 8.8, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!t.spec) return;
  for (const s of [-1, 1]) {                        // a sprig at each corner
    const bx = t.x + s * (wide - 1.5), by = t.y + 10;
    ctx.strokeStyle = "#3f7a34";
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by + 2.5);
    ctx.quadraticCurveTo(bx + s * 1.4, by - 1, bx + s * 0.6, by - 4.5);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ly = by + 1.5 - i * 2.2;
      ctx.fillStyle = i % 2 ? "#8fce74" : "#57a044";
      ctx.beginPath();
      ctx.ellipse(bx + s * (1.4 + i * 0.2), ly, 2, 1, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function aimAngle(t, pivotY) {
  const target = acquireTarget(t);
  if (!target) return -0.5;
  return Math.atan2(target.y - (t.y + pivotY), target.x - t.x);
}

// 1 immediately after firing, easing to 0 as the tower comes back to ready —
// the clock the catapult's throwing arm is animated against.
function recoil(t) {
  if (!t.fireRate) return 0;
  return Math.max(0, Math.min(1, (t.cooldown || 0) * t.fireRate));
}

// ------------------------------------------------------------------ Toxotai
// A tall, narrow watchtower with an open crenellated top — no roof at all, so
// its outline is a plain vertical bar and can't be confused with the buildings
// that do have roofs.
function drawArcherTower(t) {
  const x = t.x, y = t.y;
  const tall = t.spec === "amazon";
  const cretan = t.spec === "cretan";
  const h = tall ? 58 : 46;
  const w = 11;                                   // half-width: deliberately slim

  footing(t, 14);

  // Shaft in two stages, the upper slightly inset so the tower tapers.
  block(x - w, y - h * 0.55, w * 2, h * 0.55 + 5, MARBLE, 4);
  coursing(x - w, y - h * 0.55, w * 2, h * 0.55 + 5, 3);
  block(x - w + 1.4, y - h, w * 2 - 2.8, h * 0.45, MARBLE, 3.6);
  coursing(x - w + 1.4, y - h, w * 2 - 2.8, h * 0.45, 2);

  // Arrow slit — a dark note halfway up that stops the shaft reading blank.
  shape([[x - 2, y - h * 0.42], [x + 2, y - h * 0.42],
         [x + 2, y - h * 0.18], [x - 2, y - h * 0.18]], "#2c2318", 1.2);

  // Corbelled gallery that oversails the shaft, gold band under it.
  shape([[x - w - 5, y - h - 6], [x + w + 5, y - h - 6],
         [x + w + 5, y - h], [x - w - 5, y - h]], vgrad(0, y - h - 6, 0, 6, MARBLE), 1.8);
  ctx.fillStyle = GOLD_DARK;
  ctx.fillRect(x - w - 5, y - h - 1.6, (w + 5) * 2, 1.6);


  // Pennant on a staff — the inhabited signal, and it moves.
  const cloth = cretan ? "#2f6f9a" : tall ? "#b8452e" : "#8a1f3a";
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + w + 4, y - h - 6); ctx.lineTo(x + w + 4, y - h - 26);
  ctx.stroke();
  banner(x + w + 8.5, y - h - 25, 9, 8, cloth);

  // The bowman, drawn BEFORE the merlons so the parapet crops his legs and he
  // reads as standing behind it. Drawn after, at the height needed to clear
  // the teeth, he floated on top of the wall like an ornament.
  const ang = aimAngle(t, -h - 8);
  ctx.save();
  ctx.translate(x, y - h - 8);
  shape([[-4.6, 4], [-3.4, -2], [3.4, -2], [4.6, 4]], cloth, 1.4);   // cloak
  ctx.fillStyle = "#e8c9a0";                                          // face
  ctx.beginPath();
  ctx.arc(0, -3.4, 3, 0, Math.PI * 2);
  ctx.fill();
  ink(1.3); ctx.stroke();
  shape([[-3.4, -4.4], [3.4, -4.4], [2.4, -7.4], [-2.4, -7.4]], "#c9a24a", 1.3); // helm
  ctx.fillStyle = cloth;                                              // crest
  ctx.beginPath();
  ctx.moveTo(-2.2, -7.2);
  ctx.quadraticCurveTo(0, -12.5, 2.2, -7.2);
  ctx.closePath();
  ctx.fill();
  ink(1.1); ctx.stroke();
  ctx.rotate(ang);
  ctx.strokeStyle = "#6b4a24";                                        // bow
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(7, 0, 6, -1.25, 1.25);
  ctx.stroke();
  ctx.strokeStyle = "rgba(250,245,225,0.9)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8.9, -5.7); ctx.lineTo(8.9, 5.7);
  ctx.stroke();
  ctx.restore();

  // Merlons last, so they overlap him. Three wide teeth, not four narrow ones:
  // at four the gaps matched the stone and it stopped reading as crenellation.
  for (let i = 0; i < 3; i++) {
    const mx = x - w - 4.5 + i * 9.6;
    shape([[mx, y - h - 6], [mx + 7, y - h - 6],
           [mx + 7, y - h - 13], [mx, y - h - 13]], MARBLE.lit, 1.6);
  }
}

// ----------------------------------------------------------------- Catapult
// An onager: a heavy timber chassis with one long throwing arm that snaps
// forward when it fires and winds slowly back. No marble, no roof — the
// diagonal arm is the whole silhouette, and it's the only tower that moves
// enough to catch the eye.
//
// The Scorpion specialisation is a genuinely different machine — a light
// swivel-mounted bolt thrower, which is why it's the one that can point up.
function drawArtilleryTower(t) {
  const x = t.x, y = t.y;
  const scorpion = t.spec === "scorpion";
  const siege = t.spec === "siege";

  rockBase(x, y, 20);

  // Timber deck with visible planks and iron straps, all inked. No marble on
  // this one at all — the material is half of what tells it apart.
  block(x - 19, y - 5, 38, 13, TIMBER, 4);
  ctx.strokeStyle = "rgba(30,18,6,0.45)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 19 + i * 9.5, y - 5); ctx.lineTo(x - 19 + i * 9.5, y + 8);
    ctx.stroke();
  }
  for (const sx of [-13, 13]) {                   // iron straps
    ctx.fillStyle = "#5c5348";
    ctx.fillRect(x + sx - 1.4, y - 5, 2.8, 13);
    ink(1); ctx.strokeRect(x + sx - 1.4, y - 5, 2.8, 13);
  }

  for (const sx of [-15, 15]) {                   // spoked wheels
    ctx.beginPath();
    ctx.arc(x + sx, y + 9, 5.6, 0, Math.PI * 2);
    ctx.fillStyle = TIMBER.mid; ctx.fill();
    ink(1.6); ctx.stroke();
    ctx.strokeStyle = "rgba(40,24,8,0.55)";
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + sx - Math.cos(a) * 4.6, y + 9 - Math.sin(a) * 4.6);
      ctx.lineTo(x + sx + Math.cos(a) * 4.6, y + 9 + Math.sin(a) * 4.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + sx, y + 9, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = GOLD_DARK; ctx.fill();
    ink(1); ctx.stroke();
  }

  // A little pile of shot beside the machine — the detail that says "crewed".
  for (const [ox, oy, rr] of [[-25, 9, 3.4], [-20, 11, 3], [-23.5, 5.5, 2.8]]) {
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, rr, 0, Math.PI * 2);
    ctx.fillStyle = "#9a948a"; ctx.fill();
    ink(1.3); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(x + ox - rr * 0.35, y + oy - rr * 0.4, rr * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  levelPips(t, 20);

  const pivotY = scorpion ? -18 : -10;
  const ang = aimAngle(t, pivotY);
  ctx.save();
  ctx.translate(x, y + pivotY);
  ctx.rotate(ang);

  if (scorpion) {
    // light bolt thrower: two short arms and a bowstring on a swivel post
    ctx.fillStyle = TIMBER.mid;
    ctx.beginPath();
    ctx.roundRect(-10, -3, 22, 6, 2);
    ctx.fill();
    ink(1.5); ctx.stroke();
    for (const ay of [-1, 1]) {
      ctx.strokeStyle = "#7a5228";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(6, ay * 3);
      ctx.quadraticCurveTo(12, ay * 8, 9, ay * 13);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(240,232,205,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, -13);
    ctx.lineTo(9, 13);
    ctx.stroke();
    ctx.fillStyle = "#d8cdb0";                    // bolt in the groove
    ctx.fillRect(0, -1, 15, 2);
  } else {
    // A-frame the arm pivots in
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, 9); ctx.lineTo(2, -7);
    ctx.moveTo(8, 9);  ctx.lineTo(2, -7);
    ctx.stroke();
    // torsion bundle at the pivot
    ctx.fillStyle = "#c9902c";
    ctx.beginPath();
    ctx.arc(2, -7, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ink(1.5); ctx.stroke();
    ctx.strokeStyle = "rgba(90,58,16,0.55)";      // twisted rope skein
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(2, -7, 4.6, k * 0.5 - 0.4, k * 0.5 + 0.3);
      ctx.stroke();
    }

    // the throwing arm: snaps forward on release, winds back as it reloads
    const r = recoil(t);
    const cocked = 2.5, released = 0.5;           // radians from the deck
    const armAng = released + (cocked - released) * Math.pow(1 - r, 0.65);
    const len = siege ? 30 : 25;
    ctx.save();
    ctx.translate(2, -7);
    ctx.rotate(-armAng);
    ctx.fillStyle = vgrad(0, -2.4, 0, 4.8, TIMBER);
    ctx.fillRect(-2, -2.4, len, 4.8);
    ink(1.6); ctx.strokeRect(-2, -2.4, len, 4.8);
    // sling cup at the tip, with a stone in it while the arm is cocked
    ctx.fillStyle = TIMBER.dark;
    ctx.beginPath();
    ctx.arc(len, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ink(1.5); ctx.stroke();
    if (r < 0.55) {
      ctx.fillStyle = "#9a948a";
      ctx.beginPath();
      ctx.arc(len, -1.5, siege ? 4 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ink(1.3); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(len - 1.2, -2.6, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (siege) {                                  // counterweight box at the rear
      ctx.fillStyle = TIMBER.deep;
      ctx.beginPath();
      ctx.roundRect(-16, -6, 11, 11, 2);
      ctx.fill();
      ink(1.6); ctx.stroke();
      ctx.strokeStyle = GOLD_DARK;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-14, -4, 7, 7);
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------------- Oracle
// A round tholos under a DOME — the only curved roof in the game, so its
// outline can't be mistaken for the pitched-roof Phalanx or the flat-topped
// Toxotai. The Shrine of Hekate is the same form in black marble.
function drawMagicTower(t) {
  const x = t.x, y = t.y;
  const dark = t.spec === "hekate";
  const stone = dark ? NIGHT : MARBLE;
  const domeC = dark ? ["#a86ad0", "#3a2050"] : ["#8fd4ee", "#25607f"];
  const flame = dark ? ["#e2a8ff", "#a050d8"] : ["#bfe8ff", "#4d9fd0"];

  footing(t, 17);

  // Circular stylobate, drawn as an inked ellipse so the base reads as round
  // even before the columns go on.
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 17, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = stone.dark; ctx.fill();
  ink(1.7); ctx.stroke();

  // Cella wall behind the colonnade. Without it the gaps between the columns
  // were simply background, and the tripod inside vanished into a dark hole.
  shape([[x - 12, y - 4], [x + 12, y - 4], [x + 12, y - 27], [x - 12, y - 27]],
    vgrad(0, y - 27, 0, 23, dark
      ? { lit: "#4a3a66", mid: "#33254c", dark: "#1e1434" }
      : { lit: "#c9b891", mid: "#a8906a", dark: "#7d6647" }), 1.5);

  // Ring of columns — five, the outer two foreshortened.
  for (const [cx, ch] of [[-13, 15], [-7, 21], [0, 23], [7, 21], [13, 15]]) {
    const cw = cx === 0 ? 6 : 5.2;
    const bx = x + cx - cw / 2, by = y - 4 - ch;
    ctx.fillStyle = vgrad(bx, by, cw, ch, stone);
    ctx.fillRect(bx, by, cw, ch);
    ctx.fillStyle = "rgba(255,252,240,0.42)";
    ctx.fillRect(bx, by, 1.4, ch);
    ink(1.4); ctx.strokeRect(bx, by, cw, ch);
    shape([[bx - 1.6, by], [bx + cw + 1.6, by],
           [bx + cw + 1.6, by - 2.8], [bx - 1.6, by - 2.8]], stone.lit, 1.3);
  }

  // Entablature ring, with a gold fillet.
  ctx.beginPath();
  ctx.ellipse(x, y - 28.5, 16.5, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = stone.mid; ctx.fill();
  ink(1.7); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y - 30, 16.5, 5.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = stone.lit; ctx.fill();
  ink(1.5); ctx.stroke();
  ctx.strokeStyle = GOLD_DARK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y - 27.5, 15, 5, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // THE DOME — the signature of this building, inked hard against the sky.
  const dg = ctx.createRadialGradient(x - 5, y - 41, 2, x, y - 32, 18);
  dg.addColorStop(0, domeC[0]);
  dg.addColorStop(1, domeC[1]);
  ctx.beginPath();
  ctx.ellipse(x, y - 30, 15.5, 16, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = dg; ctx.fill();
  ink(1.9); ctx.stroke();
  ctx.strokeStyle = "rgba(255,246,220,0.42)";     // gilded meridian ribs
  ctx.lineWidth = 1.2;
  for (const rx of [-10, -5, 0, 5, 10]) {
    ctx.beginPath();
    ctx.ellipse(x, y - 30, Math.abs(rx) || 0.6, 16, 0, Math.PI, 0);
    ctx.stroke();
  }
  ctx.beginPath();                                 // finial
  ctx.arc(x, y - 47, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = GOLD; ctx.fill();
  ink(1.4); ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y - 50.5); ctx.lineTo(x, y - 46);
  ctx.stroke();

  // Tripod flame glowing out of the open front.
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 260);
  const fg = ctx.createRadialGradient(x, y - 16, 0, x, y - 16, 17 * pulse);
  fg.addColorStop(0, flame[0]);
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(x, y - 16, 17 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6520";                     // tripod legs
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 5); ctx.lineTo(x + dx * 0.35, y - 15);
    ctx.stroke();
  }
  ctx.beginPath();                                 // bowl
  ctx.ellipse(x, y - 15.5, 5.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = GOLD_DARK; ctx.fill();
  ink(1.3); ctx.stroke();
  // The flame itself. Built from two teardrops with a live wobble rather than
  // a symmetric triangle — a straight-sided cone read as a party hat sitting on
  // the tripod, which is exactly what it looked like.
  const flick = Math.sin(performance.now() / 130);
  const lean = flick * 1.6;
  const tip = y - 25 - 4 * pulse;
  ctx.beginPath();
  ctx.moveTo(x - 4.2, y - 16);
  ctx.bezierCurveTo(x - 5.2, y - 20, x - 2.6 + lean, y - 21, x + lean * 0.6, tip);
  ctx.bezierCurveTo(x + 3.4 + lean, y - 21, x + 5, y - 19.5, x + 4.2, y - 16);
  ctx.quadraticCurveTo(x, y - 14.2, x - 4.2, y - 16);
  ctx.closePath();
  ctx.fillStyle = flame[1];
  ctx.fill();
  ctx.beginPath();                                 // hot core, leaning the other way
  ctx.moveTo(x - 2.1, y - 16.4);
  ctx.bezierCurveTo(x - 2.6, y - 19, x - 1.2 - lean * 0.5, y - 19.6,
    x - lean * 0.4, y - 21.5 - 2.5 * pulse);
  ctx.bezierCurveTo(x + 1.6 - lean * 0.5, y - 19.6, x + 2.6, y - 18.6, x + 2.1, y - 16.4);
  ctx.quadraticCurveTo(x, y - 15.4, x - 2.1, y - 16.4);
  ctx.closePath();
  ctx.fillStyle = flame[0];
  ctx.fill();

  // Prophecy motes rising off the flame — the one thing on the board that
  // says "this building does magic" without a colour swap.
  const tt = performance.now() / 900;
  for (let i = 0; i < 3; i++) {
    const ph = (tt + i / 3) % 1;
    ctx.fillStyle = `rgba(${dark ? "226,168,255" : "191,232,255"},${0.7 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(tt * 5 + i * 2.2) * 7, y - 20 - ph * 22, 1.6 * (1 - ph * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------- Phalanx
// A low, WIDE muster yard: a long shallow-pitched roof on a colonnade, spears
// racked along the front and a shield hung on the wall. Squat and horizontal,
// so its outline is the opposite of the Toxotai's vertical bar.
function drawBarracksTower(t) {
  const x = t.x, y = t.y;
  const spartiate = t.spec === "spartiate";
  const myrmidon = t.spec === "myrmidon";

  footing(t, 21);

  // Back wall, deliberately low, with a dark open front cut into it.
  block(x - 21, y - 21, 42, 23, MARBLE, 5);
  coursing(x - 21, y - 21, 42, 23, 3, 4);
  shape([[x - 12, y - 15], [x + 12, y - 15], [x + 12, y + 1], [x - 12, y + 1]],
    "#33291c", 1.6);
  const inner = ctx.createLinearGradient(0, y - 15, 0, y + 1);   // depth in the doorway
  inner.addColorStop(0, "rgba(255,200,120,0.20)");
  inner.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = inner;
  ctx.fillRect(x - 12, y - 15, 24, 16);

  // Four short columns across the front.
  for (const cx of [-18, -6, 6, 18]) column(x + cx, y + 1, 17, 5.4);

  // Long shallow gable — wide and flat, not the archer's tall cap.
  shape([[x - 25, y - 23], [x + 25, y - 23], [x + 25, y - 19], [x - 25, y - 19]],
    MARBLE.lit, 1.7);
  tiledRoof(x, y - 23, 25, 10);

  // Akroterion at the peak, and a pennant, so the roofline isn't just a wedge.
  shape([[x - 3, y - 33], [x, y - 38], [x + 3, y - 33]], GOLD, 1.4);
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 20, y - 27); ctx.lineTo(x + 20, y - 42);
  ctx.stroke();
  banner(x + 24, y - 41, 8, 7, spartiate ? "#8a1f1f" : myrmidon ? "#3c2a52" : "#20304a", 1.1);

  // Hung hoplon, blazon by specialisation.
  const face = ctx.createRadialGradient(x - 16, y - 12, 1, x - 14, y - 10, 9);
  face.addColorStop(0, "#f0cd80");
  face.addColorStop(1, "#7d4f10");
  ctx.beginPath();
  ctx.arc(x - 14, y - 10, 7.6, 0, Math.PI * 2);
  ctx.fillStyle = face; ctx.fill();
  ink(1.7); ctx.stroke();
  ctx.strokeStyle = "rgba(60,38,10,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x - 14, y - 10, 4.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = spartiate ? "#8a1f1f" : myrmidon ? "#3c2a52" : "#20304a";
  ctx.font = "bold 9px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spartiate ? "\u039b" : myrmidon ? "\u039c" : "\u0391", x - 14, y - 9.5);

  // Racked spears along the right of the front.
  const spears = myrmidon ? 4 : 3;
  for (let i = 0; i < spears; i++) {
    const sx = x + 8 + i * 3.8;
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, y + 1); ctx.lineTo(sx + 1.6, y - 25);
    ctx.stroke();
    shape([[sx + 1.6, y - 29], [sx + 3.2, y - 24], [sx, y - 24]], "#e4dcc2", 1.1);
  }
}

export function drawTower(t) {
  if (t.type === "barracks") drawBarracksTower(t);
  else if (t.type === "magic") drawMagicTower(t);
  else if (t.type === "artillery") drawArtilleryTower(t);
  else drawArcherTower(t);
}

export function drawRally(t) {
  const r = t.rally;
  ctx.strokeStyle = "rgba(90,209,165,0.5)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(r.x, r.y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#caa15f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y - 12);
  ctx.lineTo(r.x, r.y + 4);
  ctx.stroke();
  ctx.fillStyle = "#5ad1a5";
  ctx.beginPath();
  ctx.moveTo(r.x, r.y - 12);
  ctx.lineTo(r.x + 10, r.y - 9);
  ctx.lineTo(r.x, r.y - 6);
  ctx.closePath();
  ctx.fill();
}
