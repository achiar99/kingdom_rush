// All canvas drawing: the shared canvas/ctx, shading helpers, and every
// draw* function for the ground, path, towers, enemies, effects and castle.
import { CONFIG } from "./config.js";
import { TOWER_TYPES } from "./data/towerTypes.js";
import { HERO } from "./data/hero.js";
import { state, PATH, BUILD_SPOTS, THEME, spotOccupied } from "./state.js";
import { acquireTarget } from "./simulation.js";

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

// The look is "2.5D": everything is still drawn on a flat top-down plane,
// but radial-gradient shading + soft ground shadows + top highlights make
// towers and creeps read as rounded volumes lit from the upper-left.
const LIGHT = { x: -0.5, y: -0.6 }; // light direction (upper-left)

// Soft elliptical shadow cast on the ground beneath an object.
function groundShadow(cx, cy, rx, ry) {
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
function shadedSphere(cx, cy, r, light, mid, dark) {
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

export function render() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  drawGround();
  drawPath();
  drawBuildSpots();

  const endP = PATH[PATH.length - 1];
  drawCastle(endP.x - 26, endP.y);

  // rally flags + soldiers (draw under towers/enemies mixing by y)
  for (const t of state.towers) if (t.def.attack === "none") drawRally(t);

  for (const t of state.towers) drawTower(t);

  // soldiers + hero + enemies sorted together by y for depth layering
  const walkers = [];
  for (const e of state.enemies) walkers.push({ y: e.y, kind: "enemy", ref: e });
  for (const t of state.towers)
    if (t.def.attack === "none")
      for (const s of t.soldiers) if (s.alive) walkers.push({ y: s.y, kind: "soldier", ref: s });
  if (state.hero) {
    const h = state.hero;
    walkers.push({ y: h.alive ? h.y : h.commandPos.y, kind: "hero", ref: h });
  }
  walkers.sort((a, b) => a.y - b.y);
  for (const w of walkers) {
    if (w.kind === "enemy") drawEnemy(w.ref);
    else if (w.kind === "soldier") drawSoldier(w.ref);
    else drawHero(w.ref);
  }

  for (const fx of state.effects) drawEffect(fx);
  for (const p of state.projectiles) drawProjectile(p);

  // range ring for a selected tower (manage mode)
  if (state.selected) {
    ctx.beginPath();
    ctx.arc(state.selected.x, state.selected.y, state.selected.range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,209,165,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(90,209,165,0.55)";
    ctx.stroke();
  }

  // range preview when hovering a buildable spot or the build menu is open
  const previewSpot = state.menuSpot || (state.hoverSpot && !spotOccupied(state.hoverSpot) ? state.hoverSpot : null);
  if (previewSpot && !spotOccupied(previewSpot)) {
    ctx.beginPath();
    ctx.arc(previewSpot.x, previewSpot.y, TOWER_TYPES.archer.range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,209,165,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(90,209,165,0.4)";
    ctx.stroke();
  }

  // allowed placement area while relocating a barracks' rally point
  if (state.repositioning) {
    const t = state.repositioning;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.def.rallyReach, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,207,82,0.12)";
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(255,207,82,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.paused && !state.over) drawPausedBanner();
}

function drawPausedBanner() {
  ctx.fillStyle = "rgba(10,12,18,0.5)";
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = "#e8ecf4";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⏸ Paused", CONFIG.width / 2, CONFIG.height / 2);
}

function drawGround() {
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

function drawPath() {
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

function drawBuildSpots() {
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

function towerBase(t) {
  groundShadow(t.x + 4, t.y + 10, 22, 9);
  shadedSphere(t.x, t.y + 6, 18, "#9aa2b8", "#5c6685", "#39415c");
  shadedSphere(t.x, t.y, 16, "#aeb6cc", "#6b769a", "#454e70");
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  // level pips: gold dots along the bottom of the base for levels above 1
  for (let i = 0; i < t.level - 1; i++) {
    ctx.beginPath();
    ctx.arc(t.x - 4 + i * 8, t.y + 15, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf52";
    ctx.fill();
  }
}

function barrel(t, len, w, color, light) {
  const target = acquireTarget(t);
  let ang = -Math.PI / 4;
  if (target) ang = Math.atan2(target.y - (t.y - 7), target.x - t.x);
  ctx.save();
  ctx.translate(t.x, t.y - 7);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.fillRect(0, -w / 2, len, w);
  ctx.fillStyle = light;
  ctx.fillRect(0, -w / 2, len, 2);
  ctx.restore();
}

function drawTower(t) {
  const p = t.def.palette;
  if (t.type === "barracks") {
    // squat keep with a flag instead of a turret
    towerBase(t);
    ctx.fillStyle = "#6a5334";
    ctx.fillRect(t.x - 2, t.y - 24, 4, 20);
    ctx.fillStyle = t.def.palette.dark;
    ctx.beginPath();
    ctx.moveTo(t.x + 2, t.y - 24);
    ctx.lineTo(t.x + 18, t.y - 20);
    ctx.lineTo(t.x + 2, t.y - 14);
    ctx.closePath();
    ctx.fill();
    return;
  }
  towerBase(t);
  if (t.type === "magic") {
    // floating glowing orb, no barrel
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    const gr = ctx.createRadialGradient(t.x, t.y - 9, 1, t.x, t.y - 9, 16);
    gr.addColorStop(0, "rgba(230,200,255,0.9)");
    gr.addColorStop(1, "rgba(150,90,220,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 9, 14 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    shadedSphere(t.x, t.y - 9, 9, p.light, p.mid, p.dark);
    return;
  }
  if (t.type === "artillery") {
    shadedSphere(t.x, t.y - 6, 11, p.light, p.mid, p.dark);
    barrel(t, 20, 9, "#4a3a24", "#7a6038");
    return;
  }
  // archer
  shadedSphere(t.x, t.y - 7, 10, p.light, p.mid, p.dark);
  barrel(t, 17, 5, "#3a4260", "#565f82");
}

function drawRally(t) {
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

function drawSoldier(s) {
  groundShadow(s.x + 1, s.y + 6, 9, 4);
  shadedSphere(s.x, s.y, 7, "#bcd0ff", "#5b78c8", "#2f4788");
  ctx.beginPath();
  ctx.arc(s.x + LIGHT.x * 3, s.y + LIGHT.y * 3, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();
  // small hp bar
  const w = 16, h = 3, pct = Math.max(0, s.hp / s.maxHp);
  if (pct < 1) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(s.x - w / 2, s.y - 14, w, h);
    ctx.fillStyle = "#5ad1a5";
    ctx.fillRect(s.x - w / 2, s.y - 14, w * pct, h);
  }
}

function drawHero(hero) {
  if (!hero.alive) {
    // downed: a small marker + countdown at the last commanded spot
    const p = hero.commandPos;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,24,34,0.55)";
    ctx.fill();
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💀", p.x, p.y - 1);
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#ffcf52";
    ctx.fillText(Math.ceil(hero.respawn) + "s", p.x, p.y + 15);
    return;
  }

  const r = 14;
  if (state.heroSelected) {
    // pulsing ring: click somewhere to send the hero there
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, r + 6 + pulse * 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,209,165,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  groundShadow(hero.x + 2, hero.y + r * 0.7, r * 1.2, r * 0.5);
  shadedSphere(hero.x, hero.y, r, HERO.colors.light, HERO.colors.mid, HERO.colors.dark);
  ctx.beginPath();
  ctx.arc(hero.x + LIGHT.x * r * 0.5, hero.y + LIGHT.y * r * 0.5, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  // star marker distinguishes the hero from soldiers/enemies at a glance
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#4a2f06";
  ctx.fillText("★", hero.x, hero.y - 1);

  const w = 34, h = 5, pct = Math.max(0, hero.hp / hero.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 13, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 13, w * pct, h);
}

function drawEnemy(e) {
  const r = e.radius;
  const lift = e.flying ? 18 : 0;      // flyers hover above their ground shadow
  const cy = e.y - lift;
  const col = e.colors;

  // ground shadow stays on the path; flyers cast a smaller, detached one
  if (e.flying) groundShadow(e.x + 3, e.y + 3, r * 1.0, r * 0.45);
  else groundShadow(e.x + 2, e.y + r * 0.7, r * 1.3, r * 0.5);

  if (e.flying) drawWings(e.x, cy, r);

  // shaded body
  shadedSphere(e.x, cy, r, col.light, col.mid, col.dark);
  // glossy rim + specular highlight
  ctx.beginPath();
  ctx.arc(e.x, cy, r, Math.PI * 0.15, Math.PI * 0.75);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(e.x + LIGHT.x * r * 0.5, cy + LIGHT.y * r * 0.5, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fill();

  if (e.armor) drawArmor(e.x, cy, r);
  if (e.boss) drawCrown(e.x, cy, r);

  // hp bar (width scales with size)
  const w = Math.max(24, r * 2), h = e.boss ? 6 : 4;
  const pct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(e.x - w / 2, cy - r - 12, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
  ctx.fillRect(e.x - w / 2, cy - r - 12, w * pct, h);
}

function drawWings(x, y, r) {
  const flap = Math.sin(performance.now() / 90) * 0.35;
  ctx.fillStyle = "rgba(60,40,90,0.85)";
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s * (0.5 + flap));
    ctx.beginPath();
    ctx.ellipse(s * r * 0.9, -2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawArmor(x, y, r) {
  // steel plate band across the body with rivets
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(230,238,250,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.15);
  ctx.lineTo(x + r, y - r * 0.15);
  ctx.stroke();
  ctx.fillStyle = "rgba(20,26,38,0.35)";
  ctx.fillRect(x - r, y + r * 0.15, r * 2, r * 0.85);
  ctx.restore();
  for (const rx of [-0.5, 0.5]) {
    ctx.beginPath();
    ctx.arc(x + rx * r, y - r * 0.15, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#eef2fa";
    ctx.fill();
  }
}

function drawCrown(x, y, r) {
  const top = y - r - 4;
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, top);
  ctx.lineTo(x - r * 0.6, top - 7);
  ctx.lineTo(x - r * 0.3, top - 2);
  ctx.lineTo(x, top - 9);
  ctx.lineTo(x + r * 0.3, top - 2);
  ctx.lineTo(x + r * 0.6, top - 7);
  ctx.lineTo(x + r * 0.6, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawProjectile(p) {
  const R = p.attack === "splash" ? 12 : 9;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
  g.addColorStop(0, "rgba(255,255,235,0.95)");
  g.addColorStop(0.4, p.color);
  g.addColorStop(1, p.color + "00"); // hex + "00" = fully transparent outer edge
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.attack === "splash" ? 4.5 : 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fffbe0";
  ctx.fill();
}

function drawEffect(fx) {
  const t = 1 - fx.life / fx.maxLife;
  if (fx.kind === "ping") {
    // hero move-command acknowledgement: a thin expanding ring, no fill
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.maxR * t, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,209,165,${0.8 * (1 - t)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  const r = fx.maxR * (0.4 + 0.6 * t);
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,176,87,${0.4 * (1 - t)})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,230,150,${0.8 * (1 - t)})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCastle(x, y) {
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
