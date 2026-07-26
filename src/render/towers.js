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

// ------------------------------------------------------------------ helpers
function marble(x, y, w, h, lit = "#f7f2e6", mid = "#dcd5c4", dark = "#a8a08e") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, lit);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function timber(x, y, w, h, a = "#9a7040", b = "#4e3116") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function column(cx, baseY, h, w = 7) {
  marble(cx - w / 2, baseY - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillRect(cx - w / 2, baseY - h, 1.6, h);
  ctx.fillStyle = "rgba(80,72,58,0.26)";
  ctx.fillRect(cx + w / 2 - 1.4, baseY - h, 1.4, h);
  marble(cx - w / 2 - 1.6, baseY - h - 3.4, w + 3.2, 3.4, "#fbf7ec", "#e2dbca", "#b0a896");
}

// Stepped footing + level pips. `wide` lets a squat building sit on a broader
// base than a narrow tower, which is half of what separates their outlines.
function footing(t, wide = 16) {
  groundShadow(t.x + 4, t.y + 13, wide + 8, 9);
  marble(t.x - wide - 2, t.y + 6, (wide + 2) * 2, 7, "#e9e2d0", "#c5bda9", "#8f8776");
  marble(t.x - wide, t.y + 1, wide * 2, 6, "#f2ecdc", "#d0c8b4", "#9a9280");
  for (let i = 0; i < t.level - 1; i++) {
    ctx.beginPath();
    ctx.arc(t.x - 4 + i * 8, t.y + 16, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf52";
    ctx.fill();
  }
  if (t.spec) {                                   // laurel on a specialised spot
    ctx.strokeStyle = "#5ad18a";
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(t.x + s * (wide - 6), t.y + 16, 5, s > 0 ? -1.9 : 1.2, s > 0 ? 0.3 : 3.4);
      ctx.stroke();
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
  const h = tall ? 56 : 44;
  const w = 11;                                   // half-width: deliberately slim

  footing(t, 14);

  // shaft, slightly tapered by drawing the upper half a touch narrower
  marble(x - w, y - h * 0.55, w * 2, h * 0.55 + 4, "#efe8d6", "#cbc3ae", "#948c7a");
  marble(x - w + 1.2, y - h, w * 2 - 2.4, h * 0.45, "#f4eddc", "#d0c8b3", "#98907e");
  ctx.strokeStyle = "rgba(90,82,66,0.2)";         // coursed joints
  ctx.lineWidth = 1;
  for (let i = 1; i * 10 < h; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w, y - h + i * 10);
    ctx.lineTo(x + w, y - h + i * 10);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(x - w, y - h, 2, h + 4);

  // corbelled gallery that oversails the shaft, then merlons on top of it
  marble(x - w - 4, y - h - 6, (w + 4) * 2, 6, "#faf5ea", "#ddd6c5", "#a8a08e");
  for (let i = 0; i < 4; i++) {
    marble(x - w - 4 + i * ((w + 4) * 2 / 4) + 1, y - h - 12, 5.5, 6.5,
      "#fbf7ee", "#e0d9c8", "#aaa290");
  }

  // the bowman in the gallery
  const ang = aimAngle(t, -h - 3);
  ctx.save();
  ctx.translate(x, y - h - 3);
  ctx.fillStyle = "#b8452e";                      // crimson cloak
  ctx.beginPath();
  ctx.arc(0, 1, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a24a";                      // bronze helm
  ctx.beginPath();
  ctx.arc(0, -1.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ang);
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(7, 0, 5.5, -1.25, 1.25);
  ctx.stroke();
  ctx.strokeStyle = "rgba(250,245,225,0.85)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8.7, -5.2);
  ctx.lineTo(8.7, 5.2);
  ctx.stroke();
  ctx.restore();
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

  groundShadow(x + 4, y + 12, 26, 9);
  // timber deck rather than a marble plinth
  timber(x - 19, y - 4, 38, 12, "#8a6236", "#452a10");
  ctx.strokeStyle = "rgba(30,18,6,0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 19 + i * 9.5, y - 4);
    ctx.lineTo(x - 19 + i * 9.5, y + 8);
    ctx.stroke();
  }
  for (const sx of [-15, 15]) {                   // wheels
    ctx.fillStyle = "#5a3a1c";
    ctx.beginPath();
    ctx.arc(x + sx, y + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a6236";
    ctx.beginPath();
    ctx.arc(x + sx, y + 9, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < t.level - 1; i++) {
    ctx.beginPath();
    ctx.arc(x - 4 + i * 8, y + 17, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf52";
    ctx.fill();
  }

  const pivotY = scorpion ? -18 : -10;
  const ang = aimAngle(t, pivotY);
  ctx.save();
  ctx.translate(x, y + pivotY);
  ctx.rotate(ang);

  if (scorpion) {
    // light bolt thrower: two short arms and a bowstring on a swivel post
    ctx.fillStyle = "#6b4a24";
    ctx.beginPath();
    ctx.roundRect(-10, -3, 22, 6, 2);
    ctx.fill();
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
    ctx.arc(2, -7, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // the throwing arm: snaps forward on release, winds back as it reloads
    const r = recoil(t);
    const cocked = 2.5, released = 0.5;           // radians from the deck
    const armAng = released + (cocked - released) * Math.pow(1 - r, 0.65);
    const len = siege ? 30 : 25;
    ctx.save();
    ctx.translate(2, -7);
    ctx.rotate(-armAng);
    timber(-2, -2.4, len, 4.8, "#a87c46", "#5a3a1c");
    // sling cup at the tip, with a stone in it while the arm is cocked
    ctx.fillStyle = "#6b4a24";
    ctx.beginPath();
    ctx.arc(len, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    if (r < 0.55) {
      ctx.fillStyle = "#9a948a";
      ctx.beginPath();
      ctx.arc(len, -1.5, siege ? 4 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(len - 1.2, -2.6, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (siege) {                                  // counterweight box at the rear
      ctx.fillStyle = "#4a3118";
      ctx.beginPath();
      ctx.roundRect(-16, -6, 11, 11, 2);
      ctx.fill();
      ctx.strokeStyle = "#c9902c";
      ctx.lineWidth = 1.2;
      ctx.stroke();
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
  const stone = dark ? ["#7a6a88", "#4a3c58", "#281e34"] : ["#f7f2e6", "#dcd5c4", "#a8a08e"];
  const domeC = dark ? ["#8a5aa8", "#3a2050"] : ["#7fc4e0", "#2f6b8a"];
  const flame = dark ? ["#e2a8ff", "#a050d8"] : ["#bfe8ff", "#4d9fd0"];

  footing(t, 17);

  // circular stylobate, drawn as an ellipse so the base reads as round
  ctx.fillStyle = stone[2];
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 17, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // ring of columns — five, with the outer two foreshortened
  const cols = [[-13, 15], [-7, 21], [0, 23], [7, 21], [13, 15]];
  for (const [cx, ch] of cols) {
    marble(x + cx - 2.6, y - 4 - ch, 5.2, ch, stone[0], stone[1], stone[2]);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x + cx - 2.6, y - 4 - ch, 1.2, ch);
  }

  // entablature ring
  ctx.fillStyle = stone[1];
  ctx.beginPath();
  ctx.ellipse(x, y - 28, 16, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = stone[0];
  ctx.beginPath();
  ctx.ellipse(x, y - 29.5, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // THE DOME — a half-ellipse, the signature of this building
  const dg = ctx.createRadialGradient(x - 5, y - 40, 2, x, y - 32, 17);
  dg.addColorStop(0, domeC[0]);
  dg.addColorStop(1, domeC[1]);
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.ellipse(x, y - 30, 15, 15, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";     // meridian ribs
  ctx.lineWidth = 1;
  for (const rx of [-9, 0, 9]) {
    ctx.beginPath();
    ctx.ellipse(x, y - 30, Math.abs(rx) || 0.6, 15, 0, Math.PI, 0);
    ctx.stroke();
  }
  ctx.fillStyle = "#d9a222";                      // finial
  ctx.beginPath();
  ctx.arc(x, y - 46, 3, 0, Math.PI * 2);
  ctx.fill();

  // tripod flame glowing out of the open front
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 260);
  const fg = ctx.createRadialGradient(x, y - 16, 0, x, y - 16, 13 * pulse);
  fg.addColorStop(0, flame[0]);
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(x, y - 16, 13 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b8892c";
  ctx.lineWidth = 1.5;
  for (const dx of [-3.5, 0, 3.5]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 6);
    ctx.lineTo(x + dx * 0.4, y - 15);
    ctx.stroke();
  }
  ctx.fillStyle = flame[1];
  ctx.beginPath();
  ctx.moveTo(x - 2.4, y - 15);
  ctx.quadraticCurveTo(x, y - 22 - 3 * pulse, x + 2.4, y - 15);
  ctx.closePath();
  ctx.fill();
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

  // back wall, deliberately low
  marble(x - 21, y - 20, 42, 22, "#e6dfcc", "#c2baa5", "#8e8674");
  ctx.fillStyle = "rgba(52,42,28,0.55)";          // wide open front
  ctx.fillRect(x - 12, y - 14, 24, 16);

  // four short columns across the front
  for (const cx of [-18, -6, 6, 18]) column(x + cx, y + 1, 16, 5);

  // long shallow gable — wide and flat, not the archer's tall cap
  marble(x - 24, y - 22, 48, 4, "#f6f1e5", "#dcd5c4", "#aaa290");
  const rg = ctx.createLinearGradient(0, y - 32, 0, y - 22);
  rg.addColorStop(0, "#c9603a");
  rg.addColorStop(1, "#7a2f18");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(x - 25, y - 22);
  ctx.lineTo(x - 14, y - 31);
  ctx.lineTo(x + 14, y - 31);
  ctx.lineTo(x + 25, y - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,20,8,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 19, y - 26.5);
  ctx.lineTo(x + 19, y - 26.5);
  ctx.stroke();

  // hung hoplon, blazon by specialisation
  const face = ctx.createRadialGradient(x - 16, y - 12, 1, x - 14, y - 10, 8);
  face.addColorStop(0, "#e8c070");
  face.addColorStop(1, "#8a5a14");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x - 14, y - 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,24,8,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = spartiate ? "#8a1f1f" : myrmidon ? "#3c2a52" : "#20304a";
  ctx.font = "bold 8px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spartiate ? "Λ" : myrmidon ? "Μ" : "Α", x - 14, y - 9.5);

  // racked spears along the right of the front
  const spears = myrmidon ? 4 : 3;
  for (let i = 0; i < spears; i++) {
    const sx = x + 8 + i * 3.6;
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sx, y + 1);
    ctx.lineTo(sx + 1.6, y - 24);
    ctx.stroke();
    ctx.fillStyle = "#d8cdb0";
    ctx.beginPath();
    ctx.moveTo(sx + 1.6, y - 28);
    ctx.lineTo(sx + 3, y - 23.5);
    ctx.lineTo(sx + 0.2, y - 23.5);
    ctx.closePath();
    ctx.fill();
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
