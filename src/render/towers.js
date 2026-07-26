// Tower buildings: one drawing per tower type, all standing on a shared
// stone plinth, plus the barracks' rally-point flag.
//
// Imports acquireTarget from simulation.js, which (via ui.js) imports back
// from the render package. Safe circularity — every cross-reference is only
// called inside a function body (see simulation.js for the full note).
import { acquireTarget } from "../simulation.js";
import { ctx, groundShadow, shadedSphere, shadedEllipse } from "./canvas.js";

// Shared stone plinth every tower stands on, plus the gold level pips.
function towerPlinth(t) {
  groundShadow(t.x + 4, t.y + 12, 24, 9);
  shadedEllipse(t.x, t.y + 8, 20, 8, "#9aa2b8", "#5c6685", "#39415c");
  shadedEllipse(t.x, t.y + 4, 17, 7, "#aeb6cc", "#6b769a", "#454e70");
  for (let i = 0; i < t.level - 1; i++) {
    ctx.beginPath();
    ctx.arc(t.x - 4 + i * 8, t.y + 14, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf52";
    ctx.fill();
  }
}

// vertical-gradient convex polygon — walls, spires, roofs
function towerBody(pts, yTop, yBot, light, dark) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

// where the tower's weapon points (idles up-left, toward the light)
function aimAngle(t, pivotY) {
  const target = acquireTarget(t);
  return target ? Math.atan2(target.y - pivotY, target.x - t.x) : -Math.PI / 4;
}

// archer: tapered timber watchtower, hooded lookout, bow tracking the target
function drawArcherTower(t) {
  towerPlinth(t);
  const x = t.x, y = t.y, p = t.def.palette;
  towerBody([[x - 13, y + 4], [x + 13, y + 4], [x + 9, y - 20], [x - 9, y - 20]],
    y - 20, y + 4, "#9a7040", "#5a3d20");
  ctx.strokeStyle = "rgba(40,24,10,0.4)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();                       // cross bracing
  ctx.moveTo(x - 11, y + 2); ctx.lineTo(x + 9, y - 18);
  ctx.moveTo(x + 11, y + 2); ctx.lineTo(x - 9, y - 18);
  ctx.stroke();
  shadedEllipse(x, y - 21, 12, 4.5, "#b98a52", "#8a6238", "#573a1e"); // platform
  ctx.fillStyle = "#6e4c28";             // wooden battlement teeth
  for (const dx of [-11, -4, 3, 8]) ctx.fillRect(x + dx, y - 27, 3.6, 6);
  ctx.fillStyle = p.mid;                 // hooded lookout
  ctx.beginPath(); ctx.arc(x, y - 31, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.dark;
  ctx.beginPath(); ctx.arc(x, y - 32.5, 4, Math.PI, 0); ctx.closePath(); ctx.fill();
  const ang = aimAngle(t, y - 30);       // bow + nocked arrow track the target
  ctx.save();
  ctx.translate(x, y - 30);
  ctx.rotate(ang);
  ctx.strokeStyle = "#e8d9b0";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(9, 0); ctx.stroke();
  ctx.fillStyle = "#eef2fa";
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(7, -3); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#6a4520";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 8, -Math.PI / 2.6, Math.PI / 2.6); ctx.stroke();
  const bx = 8 * Math.cos(Math.PI / 2.6), by = 8 * Math.sin(Math.PI / 2.6);
  ctx.strokeStyle = "rgba(240,240,255,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx, -by); ctx.lineTo(-3, 0); ctx.lineTo(bx, by); ctx.stroke();
  ctx.restore();
}

// artillery: squat sandstone bastion with an iron mortar that tracks targets
function drawArtilleryTower(t) {
  towerPlinth(t);
  const x = t.x, y = t.y, p = t.def.palette;
  shadedEllipse(x, y - 6, 15, 12, "#c9b294", "#98795a", "#5e4630");
  ctx.strokeStyle = "rgba(50,32,16,0.3)";  // brick courses
  ctx.lineWidth = 1;
  for (const yy of [-1, -9]) {
    ctx.beginPath();
    ctx.ellipse(x, y + yy, 14, 5, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  shadedEllipse(x, y - 16, 12, 4.5, p.light, p.mid, p.dark); // gun deck
  const ang = aimAngle(t, y - 16);
  ctx.save();
  ctx.translate(x, y - 16);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, "#6a7280");
  g.addColorStop(1, "#2c313c");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-3, -5, 21, 10, 4); ctx.fill();
  ctx.fillStyle = "#8a93a6";               // reinforcing band
  ctx.fillRect(5, -5, 3, 10);
  ctx.fillStyle = "#141821";               // muzzle
  ctx.beginPath(); ctx.ellipse(17.5, 0, 2.6, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// magic: slender spire, glowing window, pulsing orb hovering over the roof
function drawMagicTower(t) {
  towerPlinth(t);
  const x = t.x, y = t.y, p = t.def.palette;
  const now = performance.now();
  towerBody([[x - 11, y + 4], [x + 11, y + 4], [x + 6, y - 22], [x - 6, y - 22]],
    y - 22, y + 4, "#8f86b8", "#4a4270");
  ctx.fillStyle = "rgba(230,200,255,0.9)"; // glowing arrow-slit window
  ctx.beginPath(); ctx.roundRect(x - 1.5, y - 12, 3, 7, 1.5); ctx.fill();
  towerBody([[x - 8, y - 22], [x + 8, y - 22], [x, y - 34]], y - 34, y - 22, p.mid, p.dark);
  const pulse = 0.5 + 0.5 * Math.sin(now / 250);
  const orbY = y - 40 - pulse * 1.5;       // bobbing + pulsing orb
  const gr = ctx.createRadialGradient(x, orbY, 1, x, orbY, 14);
  gr.addColorStop(0, "rgba(230,200,255,0.9)");
  gr.addColorStop(1, "rgba(150,90,220,0)");
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(x, orbY, 12 + pulse * 2, 0, Math.PI * 2); ctx.fill();
  shadedSphere(x, orbY, 6, p.light, p.mid, p.dark);
  for (const k of [0, Math.PI]) {          // two orbiting sparks
    const a = now / 400 + k;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 10, orbY + Math.sin(a) * 3.5, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(235,210,255,0.85)";
    ctx.fill();
  }
}

// barracks: crenellated stone keep with a door and a waving banner
function drawBarracksTower(t) {
  towerPlinth(t);
  const x = t.x, y = t.y;
  towerBody([[x - 14, y + 4], [x + 14, y + 4], [x + 12, y - 18], [x - 12, y - 18]],
    y - 18, y + 4, "#b7bfd2", "#5c6478");
  ctx.fillStyle = "rgba(0,0,0,0.18)";      // corner shading
  ctx.fillRect(x + 8, y - 18, 4, 22);
  ctx.strokeStyle = "rgba(30,36,50,0.35)"; // masonry seams
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 4); ctx.lineTo(x + 13, y - 4);
  ctx.moveTo(x - 12, y - 11); ctx.lineTo(x + 12, y - 11);
  ctx.stroke();
  ctx.fillStyle = "#9aa3b8";               // crenellations
  for (const dx of [-12, -5, 2, 8.5]) ctx.fillRect(x + dx, y - 24, 4.5, 7);
  ctx.fillStyle = "#2e2417";               // arched door
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 4); ctx.lineTo(x - 4, y - 3);
  ctx.arc(x, y - 3, 4, Math.PI, 0);
  ctx.lineTo(x + 4, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6a5334";               // banner pole
  ctx.fillRect(x + 8, y - 37, 2, 13);
  const wave = Math.sin(performance.now() / 300) * 1.5;
  ctx.fillStyle = "#5ad1a5";               // pennant, same green as the rally flag
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 36);
  ctx.lineTo(x + 22, y - 32 + wave);
  ctx.lineTo(x + 10, y - 27);
  ctx.closePath();
  ctx.fill();
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
