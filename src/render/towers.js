// Tower buildings: Greek architecture, one drawing per tower type, all
// standing on a stepped marble footing.
//
// Each type also reads its specialisation (t.spec) and changes something
// structural rather than only its colour — a second ballista arm, a taller
// firing platform, a black shrine instead of a white tholos — so a specialised
// spot is recognisable on the board without clicking it.
//
// Imports acquireTarget from simulation.js, which (via ui.js) imports back
// from the render package. Safe circularity — every cross-reference is only
// called inside a function body (see simulation.js for the full note).
import { acquireTarget } from "../simulation.js";
import { ctx, groundShadow } from "./canvas.js";

// ------------------------------------------------------------------ helpers
// Vertical marble gradient — the workhorse for columns, walls and platforms.
function marble(x, y, w, h, lit = "#f7f2e6", mid = "#dcd5c4", dark = "#a8a08e") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, lit);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// A fluted Doric column with a capital, drawn from its base upward.
function column(cx, baseY, h, w = 7) {
  marble(cx - w / 2, baseY - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.42)";                 // lit side
  ctx.fillRect(cx - w / 2, baseY - h, 1.6, h);
  ctx.fillStyle = "rgba(80,72,58,0.26)";                    // shaded side
  ctx.fillRect(cx + w / 2 - 1.4, baseY - h, 1.4, h);
  marble(cx - w / 2 - 1.6, baseY - h - 3.4, w + 3.2, 3.4, "#fbf7ec", "#e2dbca", "#b0a896");
}

// Stepped footing every tower stands on, plus the gold level pips.
function footing(t) {
  groundShadow(t.x + 4, t.y + 13, 25, 9);
  marble(t.x - 18, t.y + 6, 36, 7, "#e9e2d0", "#c5bda9", "#8f8776");
  marble(t.x - 15, t.y + 1, 30, 6, "#f2ecdc", "#d0c8b4", "#9a9280");
  for (let i = 0; i < t.level - 1; i++) {
    ctx.beginPath();
    ctx.arc(t.x - 4 + i * 8, t.y + 16, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf52";
    ctx.fill();
  }
  // a laurel sprig on a specialised tower, in place of a fourth pip
  if (t.spec) {
    ctx.strokeStyle = "#5ad18a";
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(t.x + s * 9, t.y + 16, 5, s > 0 ? -1.9 : 1.2, s > 0 ? 0.3 : 3.4);
      ctx.stroke();
    }
  }
}

// A terracotta tiled roof: overlapping ridges, darker toward the eaves.
function tiledRoof(cx, y, halfW, h, light = "#c9603a", dark = "#7a2f18") {
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y);
  ctx.lineTo(cx, y - h);
  ctx.lineTo(cx + halfW, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,20,8,0.3)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * (1 - t), y - h * t);
    ctx.lineTo(cx + halfW * (1 - t), y - h * t);
    ctx.stroke();
  }
}

// Direction to whatever this tower is shooting at, for the pieces that swivel.
function aimAngle(t, pivotY) {
  const target = acquireTarget(t);
  if (!target) return -0.5;
  return Math.atan2(target.y - (t.y + pivotY), target.x - t.x);
}

// ------------------------------------------------------------------ Toxotai
// A stone archer post: two storeys of masonry, an open colonnaded gallery at
// the top under a tiled roof, and a bowman on the parapet.
function drawArcherTower(t) {
  const x = t.x, y = t.y;
  const tall = t.spec === "amazon";                 // Amazon Longbows stand higher
  const h = tall ? 46 : 36;

  footing(t);
  marble(x - 13, y - h, 26, h + 4, "#efe8d6", "#cbc3ae", "#948c7a");
  // coursed masonry joints
  ctx.strokeStyle = "rgba(90,82,66,0.22)";
  ctx.lineWidth = 1;
  for (let i = 1; i * 9 < h; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 13, y - h + i * 9);
    ctx.lineTo(x + 13, y - h + i * 9);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x - 13, y - h, 2, h + 4);

  // gallery: four short columns carrying the roof
  for (const cx of [-10, -3.5, 3.5, 10]) column(x + cx, y - h, 11, 5);
  marble(x - 14, y - h - 16, 28, 3.5, "#f8f3e7", "#ded7c6", "#aca492");
  tiledRoof(x, y - h - 16, 17, 11);

  // the archer, and his bow, aiming
  const ang = aimAngle(t, -h - 8);
  ctx.save();
  ctx.translate(x, y - h - 8);
  ctx.fillStyle = "#c9a24a";                        // helmed head + shoulders
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ang);
  ctx.strokeStyle = "#6b4a24";                      // bow
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(7, 0, 5.5, -1.25, 1.25);
  ctx.stroke();
  ctx.strokeStyle = "rgba(250,245,225,0.8)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8.7, -5.2);
  ctx.lineTo(8.7, 5.2);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ Ballista
// Timber frame on a low stone platform, with a bronze-wound bow that swivels
// to track its target. Siege Ballista gets a second arm; the Scorpion gets a
// raised swivel mount, since it's the one that can point at the sky.
function drawArtilleryTower(t) {
  const x = t.x, y = t.y;
  footing(t);
  marble(x - 15, y - 15, 30, 19, "#e6dfcc", "#c2baa5", "#8e8674");
  ctx.strokeStyle = "rgba(90,82,66,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 6);
  ctx.lineTo(x + 15, y - 6);
  ctx.stroke();

  const swivel = t.spec === "scorpion";
  const pivotY = swivel ? -26 : -20;

  if (swivel) {                                     // raised post for the swivel
    ctx.fillStyle = "#6b4a24";
    ctx.fillRect(x - 2.5, y - 26, 5, 13);
  }

  const ang = aimAngle(t, pivotY);
  ctx.save();
  ctx.translate(x, y + pivotY);
  ctx.rotate(ang);

  // stock
  const wood = ctx.createLinearGradient(0, -4, 0, 4);
  wood.addColorStop(0, "#9a7040");
  wood.addColorStop(1, "#5a3a1c");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(-11, -3, 24, 6, 2);
  ctx.fill();

  // bow arms — two pairs for the Siege version
  const arms = t.spec === "siege" ? [7, 11] : [9];
  for (const ax of arms) {
    ctx.strokeStyle = "#7a5228";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(ax, -11);
    ctx.quadraticCurveTo(ax + 5, 0, ax, 11);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,232,205,0.85)";     // sinew string
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax + 0.5, -10.5);
    ctx.lineTo(ax + 0.5, 10.5);
    ctx.stroke();
  }
  // bronze fittings + the bolt in the groove
  ctx.fillStyle = "#c9902c";
  ctx.fillRect(-4, -4.5, 5, 9);
  ctx.fillStyle = "#d8cdb0";
  ctx.fillRect(2, -1, 13, 2);
  ctx.restore();
}

// -------------------------------------------------------------------- Oracle
// A tholos: a circular colonnade with a conical roof and a tripod brazier
// smoking under it. The Shrine of Hekate is the same building in black marble
// with a violet flame.
function drawMagicTower(t) {
  const x = t.x, y = t.y;
  const dark = t.spec === "hekate";
  const stone = dark ? ["#6a5a78", "#4a3c58", "#2c2238"] : ["#f7f2e6", "#dcd5c4", "#a8a08e"];
  const flame = dark ? ["#e2a8ff", "#a050d8"] : ["#bfe8ff", "#4d9fd0"];

  footing(t);

  // drum wall behind the columns
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 2);
  g.addColorStop(0, stone[1]);
  g.addColorStop(1, stone[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 13, 9, 0, Math.PI, 0);
  ctx.rect(x - 13, y - 22, 26, 16);
  ctx.fill();

  // three visible columns of the ring
  for (const cx of [-10, 0, 10]) {
    marble(x + cx - 3, y - 30, 6, 26, stone[0], stone[1], stone[2]);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x + cx - 3, y - 30, 1.3, 26);
  }
  // entablature ring + conical roof
  marble(x - 15, y - 34, 30, 4, stone[0], stone[1], stone[2]);
  tiledRoof(x, y - 34, 16, 13, dark ? "#5c3a6e" : "#c9603a", dark ? "#2a1636" : "#7a2f18");

  // tripod brazier and its flame, pulsing
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 260);
  ctx.strokeStyle = "#b8892c";
  ctx.lineWidth = 1.6;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 8);
    ctx.lineTo(x + dx * 0.4, y - 18);
    ctx.stroke();
  }
  ctx.fillStyle = "#c9902c";
  ctx.beginPath();
  ctx.ellipse(x, y - 19, 6, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const fg = ctx.createRadialGradient(x, y - 23, 0, x, y - 23, 9 * pulse);
  fg.addColorStop(0, flame[0]);
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(x, y - 23, 9 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flame[1];
  ctx.beginPath();
  ctx.moveTo(x - 2.6, y - 20);
  ctx.quadraticCurveTo(x, y - 27 - 3 * pulse, x + 2.6, y - 20);
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------------- Phalanx
// A small stoa where the hoplites muster: an open porch with a shield hung on
// the wall and spears racked beside the door.
function drawBarracksTower(t) {
  const x = t.x, y = t.y;
  const spartiate = t.spec === "spartiate";
  const myrmidon = t.spec === "myrmidon";
  footing(t);

  // back wall + porch roof on two columns
  marble(x - 15, y - 28, 30, 32, "#e6dfcc", "#c2baa5", "#8e8674");
  ctx.fillStyle = "rgba(60,50,36,0.5)";                 // doorway
  ctx.fillRect(x - 5, y - 17, 11, 21);
  column(x - 12, y - 1, 20, 5.5);
  column(x + 12, y - 1, 20, 5.5);
  marble(x - 17, y - 25, 34, 4, "#f6f1e5", "#dcd5c4", "#aaa290");
  tiledRoof(x, y - 25, 19, 12);

  // the hung hoplon — blazon changes with the specialisation
  const shieldFace = ctx.createRadialGradient(x - 9, y - 10, 1, x - 7, y - 8, 8);
  shieldFace.addColorStop(0, "#e8c070");
  shieldFace.addColorStop(1, "#8a5a14");
  ctx.fillStyle = shieldFace;
  ctx.beginPath();
  ctx.arc(x - 7, y - 8, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,24,8,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = spartiate ? "#8a1f1f" : myrmidon ? "#3c2a52" : "#20304a";
  ctx.font = "bold 8px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spartiate ? "Λ" : myrmidon ? "Μ" : "Α", x - 7, y - 7.5);

  // racked spears — four for the Myrmidons, three otherwise
  const spears = myrmidon ? 4 : 3;
  for (let i = 0; i < spears; i++) {
    const sx = x + 6 + i * 3.4;
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sx, y + 2);
    ctx.lineTo(sx + 2, y - 26);
    ctx.stroke();
    ctx.fillStyle = "#d8cdb0";
    ctx.beginPath();
    ctx.moveTo(sx + 2, y - 30);
    ctx.lineTo(sx + 3.4, y - 25.5);
    ctx.lineTo(sx + 0.6, y - 25.5);
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
