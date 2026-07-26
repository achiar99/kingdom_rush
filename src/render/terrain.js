// Static scenery: themed ground, the road, empty build spots and the castle
// at the path's exit.
import { CONFIG } from "../config.js";
import { TOWER_TYPES } from "../data/towerTypes.js";
import { state, PATH, BUILD_SPOTS, THEME, spotOccupied } from "../state.js";
import { ctx, groundShadow, shadedSphere } from "./canvas.js";

export function drawGround() {
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
  g.addColorStop(0, THEME.grass[0]);
  g.addColorStop(1, THEME.grass[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = THEME.checker;
  for (let y = 0; y < CONFIG.height; y += 40)
    for (let x = 0; x < CONFIG.width; x += 40)
      if (((x + y) / 40) % 2 === 0) ctx.fillRect(x, y, 40, 40);
  const v = ctx.createRadialGradient(
    CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.3,
    CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
}

function strokePath(width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
}

export function drawPath() {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.save();
  ctx.translate(0, 3);
  strokePath(46, "rgba(0,0,0,0.25)");
  ctx.restore();
  strokePath(44, THEME.path.rim);
  strokePath(38, THEME.path.body);
  strokePath(26, THEME.path.track);
  strokePath(6, "rgba(255,240,200,0.12)");
}

export function drawBuildSpots() {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  for (const s of BUILD_SPOTS) {
    if (spotOccupied(s)) continue;
    const affordable = state.gold >= TOWER_TYPES.archer.cost;
    groundShadow(s.x, s.y + 3, 20, 8);
    shadedSphere(s.x, s.y, 15, "#8a8f9c", "#6c7280", "#474c58");
    ctx.beginPath();
    ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = affordable ? `rgba(255,207,82,${0.55 + 0.4 * pulse})` : "rgba(255,255,255,0.25)";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = affordable ? `rgba(255,207,82,${0.5 + 0.3 * pulse})` : "rgba(255,255,255,0.3)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", s.x, s.y);
  }
}

export function drawCastle(x, y) {
  groundShadow(x + 32, y + 24, 42, 14);
  const block = (bx, by, bw, bh, base, top) => {
    const g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, top);
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(bx + bw - 3, by, 3, bh);
  };
  block(x, y - 26, 52, 52, "#4a5160", "#8a93a6");
  for (let i = 0; i < 4; i++) block(x + i * 14, y - 36, 9, 12, "#3f4654", "#7d879b");
  const dg = ctx.createLinearGradient(x + 20, y - 6, x + 20, y + 26);
  dg.addColorStop(0, "#5a3320");
  dg.addColorStop(1, "#2e190f");
  ctx.fillStyle = dg;
  ctx.fillRect(x + 20, y - 6, 12, 32);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(x + 23, y - 46, 6, 14);
  ctx.fillStyle = "#8a2820";
  ctx.fillRect(x + 23, y - 46, 6, 3);
}
