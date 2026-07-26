// All canvas drawing: the shared canvas/ctx, shading helpers, and every
// draw* function for the ground, path, towers, enemies, effects and castle.
import { CONFIG } from "./config.js";
import { TOWER_TYPES } from "./data/towerTypes.js";
import { HERO } from "./data/hero.js";
import { SUMMON, FIRE } from "./data/abilities.js";
import { state, PATH, PATH_LEN, BUILD_SPOTS, THEME, spotOccupied } from "./state.js";
import { pointAtDistance } from "./geometry.js";
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

  // castle sits at the path's exit; clamp y so bottom-exit levels still show
  // it beside the road instead of pushing it off the canvas edge
  const endP = PATH[PATH.length - 1];
  drawCastle(endP.x - 26, Math.min(endP.y, CONFIG.height - 40));

  // rally flags + soldiers (draw under towers/enemies mixing by y)
  for (const t of state.towers) if (t.def.attack === "none") drawRally(t);

  for (const t of state.towers) drawTower(t);

  // soldiers + hero + enemies sorted together by y for depth layering
  const walkers = [];
  for (const e of state.enemies) walkers.push({ y: e.y, kind: "enemy", ref: e });
  for (const t of state.towers)
    if (t.def.attack === "none")
      for (const s of t.soldiers) if (s.alive) walkers.push({ y: s.y, kind: "soldier", ref: s });
  for (const s of state.summonedSoldiers) if (s.alive) walkers.push({ y: s.y, kind: "summon", ref: s });
  if (state.hero) {
    const h = state.hero;
    walkers.push({ y: h.alive ? h.y : h.commandPos.y, kind: "hero", ref: h });
  }
  walkers.sort((a, b) => a.y - b.y);
  for (const w of walkers) {
    if (w.kind === "enemy") drawEnemy(w.ref);
    else if (w.kind === "soldier") drawSoldier(w.ref);
    else if (w.kind === "summon") drawSummonedSoldier(w.ref);
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

  // preview for the two targeted hero abilities, following the cursor
  if (state.placingAbility && state.hoverPos) {
    const { x, y } = state.hoverPos;
    if (state.placingAbility === "fire") {
      ctx.beginPath();
      ctx.arc(x, y, FIRE.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,120,40,0.14)";
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(255,140,60,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (state.placingAbility === "soldiers") {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(90,209,165,0.14)";
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(90,209,165,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
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

// Like shadedSphere but elliptical — the basic "body blob" for characters.
function shadedEllipse(cx, cy, rx, ry, light, mid, dark) {
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

// -------------------------------------------------------------- knight figure
// One rig for soldiers, summons and the hero: legs, tunic torso, shield arm,
// sword arm, helmeted head. Origin (x,y) is the torso center — same spot the
// old sphere sat, so shadows, hp bars and selection rings stay aligned.
// o: { s: scale, dir: ±1 facing, fighting, tunic: [light,mid,dark],
//      helm: [light,dark], plume?, cape? }
function drawKnight(x, y, o) {
  const now = performance.now();
  const dir = o.dir || 1;
  // walk/idle cycle, de-synced per unit by position so a squad doesn't march in lockstep
  const step = Math.sin(now / 140 + x * 0.31 + y * 0.17);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * o.s, o.s);

  if (o.cape) {
    ctx.fillStyle = o.cape;
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.quadraticCurveTo(-9, -2, -7.5 - step * 1.2, 8.5);
    ctx.lineTo(-1, 6);
    ctx.closePath();
    ctx.fill();
  }

  // legs (alternate with the walk cycle)
  ctx.fillStyle = "#2c3350";
  ctx.beginPath(); ctx.roundRect(-4.4, 4 + step * 1.4, 3.2, 5.2, 1.5); ctx.fill();
  ctx.beginPath(); ctx.roundRect(1.2, 4 - step * 1.4, 3.2, 5.2, 1.5); ctx.fill();

  // tunic torso + belt
  shadedEllipse(0, 0, 6.5, 7, o.tunic[0], o.tunic[1], o.tunic[2]);
  ctx.fillStyle = "rgba(28,22,14,0.5)";
  ctx.fillRect(-5.6, 2.4, 11.2, 2);

  // shield on the off-hand
  const sg = ctx.createLinearGradient(-11, -5, -5, 5);
  sg.addColorStop(0, "#d7dde8");
  sg.addColorStop(1, "#77809a");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(-7.8, 0.4, 3.4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#3c4356";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(-7.8, 0.4, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#3c4356"; ctx.fill();

  // sword arm: swings while fighting, rests at the shoulder otherwise
  const swing = o.fighting ? -0.5 + Math.sin(now / 90) * 0.65 : -0.95 + step * 0.07;
  ctx.save();
  ctx.translate(6.3, -1);
  ctx.rotate(swing);
  ctx.fillStyle = "#f2c79b";
  ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, Math.PI * 2); ctx.fill();
  const bg = ctx.createLinearGradient(0, -2, 0, -14);
  bg.addColorStop(0, "#9aa3b8");
  bg.addColorStop(1, "#eef2fa");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-1.1, -2); ctx.lineTo(-1.1, -12); ctx.lineTo(0, -14); ctx.lineTo(1.1, -12); ctx.lineTo(1.1, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a6a30";
  ctx.fillRect(-2.9, -2.7, 5.8, 1.8);
  ctx.restore();

  // head, face, helmet
  ctx.fillStyle = "#f2c79b";
  ctx.beginPath(); ctx.arc(0, -9.5, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#26232b";
  ctx.beginPath();
  ctx.arc(-1.7, -8.9, 0.7, 0, Math.PI * 2);
  ctx.arc(1.7, -8.9, 0.7, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createLinearGradient(0, -15, 0, -9);
  hg.addColorStop(0, o.helm[0]);
  hg.addColorStop(1, o.helm[1]);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, -9.8, 4.9, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(-5.2, -10.6, 10.4, 1.7);   // brim
  ctx.fillRect(-0.7, -10, 1.4, 3.4);      // nose guard
  if (o.plume) {
    ctx.fillStyle = o.plume;
    ctx.beginPath(); ctx.roundRect(-1.3, -17.8, 2.6, 5, 1.3); ctx.fill();
  }
  ctx.restore();
}

function smallHpBar(x, y, hp, maxHp) {
  const w = 16, h = 3, pct = Math.max(0, hp / maxHp);
  if (pct >= 1) return;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = "#5ad1a5";
  ctx.fillRect(x - w / 2, y, w * pct, h);
}

// face whatever we're fighting; default to facing right
const faceTarget = (u) => (u.target && u.target.x < u.x ? -1 : 1);

function drawSoldier(s) {
  groundShadow(s.x + 1, s.y + 8, 9, 4);
  drawKnight(s.x, s.y, {
    s: 0.85, dir: faceTarget(s), fighting: !!s.target,
    tunic: ["#bcd0ff", "#5b78c8", "#2f4788"], helm: ["#dfe6f2", "#8892a8"],
  });
  smallHpBar(s.x, s.y - 18, s.hp, s.maxHp);
}

// "Reinforcements" ability units — same rig as a Barracks soldier but in
// green, so a temporary summon reads as distinct from a permanent one
function drawSummonedSoldier(s) {
  groundShadow(s.x + 1, s.y + 8, 9, 4);
  drawKnight(s.x, s.y, {
    s: 0.85, dir: faceTarget(s), fighting: !!s.target,
    tunic: [SUMMON.colors.light, SUMMON.colors.mid, SUMMON.colors.dark], helm: ["#dfe6f2", "#8892a8"],
  });
  smallHpBar(s.x, s.y - 18, s.hp, s.maxHp);
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
  groundShadow(hero.x + 2, hero.y + r * 0.8, r * 1.1, r * 0.45);
  // gold-armored champion: red cape + plume set the hero apart from soldiers
  drawKnight(hero.x, hero.y, {
    s: 1.35, dir: faceTarget(hero), fighting: !!hero.target,
    tunic: [HERO.colors.light, HERO.colors.mid, HERO.colors.dark],
    helm: ["#ffe9a8", "#d9a222"], plume: "#c0392b", cape: "#a02c20",
  });

  const w = 34, h = 5, pct = Math.max(0, hero.hp / hero.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 13, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 13, w * pct, h);
}

// ------------------------------------------------------------ monster figures
// Small shared pieces, all sized off the creep's radius so wave/level scaling
// keeps working. Walk cycles key off e.dist (distance travelled), so monsters
// stop mid-stride when a soldier blocks them.

// which way is this creep headed? (for lean/facing; 0 when moving vertically)
function pathDirX(e) {
  const ahead = pointAtDistance(PATH, PATH_LEN, Math.min(e.dist + 4, PATH_LEN));
  const dx = ahead.x - e.x;
  return Math.abs(dx) < 0.3 ? 0 : Math.sign(dx);
}

function monsterFeet(x, cy, r, phase, color) {
  const sw = Math.sin(phase);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, cy + r * 0.8 + sw * r * 0.09, r * 0.26, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.42, cy + r * 0.8 - sw * r * 0.09, r * 0.26, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
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

// dark mouth with a row of pointy teeth
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

// wooden club held out to one side, swings while fighting
function monsterClub(x, y, r, e, baseAngle) {
  const swing = e.engaged ? Math.sin(performance.now() / 90) * 0.55 : Math.sin(e.dist / 5) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(baseAngle + swing);
  const g = ctx.createLinearGradient(0, 0, 0, -r * 1.1);
  g.addColorStop(0, "#6e4a26");
  g.addColorStop(1, "#4a2f14");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-r * 0.11, -r * 1.05, r * 0.22, r * 1.05, r * 0.11);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 1.0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// grunt: a squat goblin with big ears and a club
function drawGrunt(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 5;
  monsterFeet(x, cy, r, ph, c.dark);
  ctx.fillStyle = c.mid;                       // pointy ears
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.5, cy - r * 0.45);
    ctx.lineTo(x + sgn * r * 1.25, cy - r * 0.95);
    ctx.lineTo(x + sgn * r * 0.78, cy - r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  shadedEllipse(x, cy, r * 0.95, r * 0.88, c.light, c.mid, c.dark);
  ctx.fillStyle = c.mid;                       // off-hand
  ctx.beginPath();
  ctx.arc(x - r * 0.85, cy + r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  monsterClub(x + r * 0.85, cy + r * 0.1, r, e, -0.75);
  ctx.fillStyle = c.mid;                       // club hand on top of the grip
  ctx.beginPath();
  ctx.arc(x + r * 0.85, cy + r * 0.1, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  angryEyes(x, cy - r * 0.25, r, { sclera: "#ffe9c9" });
  toothyMouth(x, cy + r * 0.38, r * 0.42, r * 0.18, 2);
}

// runner: a lean imp leaning into its sprint
function drawRunner(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 3.5;
  monsterFeet(x, cy + r * 0.12, r * 1.15, ph, c.dark);
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(pathDirX(e) * 0.16);              // lean into the direction of travel
  ctx.fillStyle = c.mid;                       // little horns
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sgn * r * 0.25, -r * 0.75);
    ctx.lineTo(sgn * r * 0.55, -r * 1.25);
    ctx.lineTo(sgn * r * 0.6, -r * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  shadedEllipse(0, 0, r * 0.8, r * 0.95, c.light, c.mid, c.dark);
  angryEyes(0, -r * 0.28, r, { size: 0.24, spread: 0.3 });
  toothyMouth(0, r * 0.35, r * 0.3, r * 0.14, 2);
  ctx.restore();
}

// armored: a faceless plate-helmed brute, eyes glowing through the slit
function drawArmored(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 5;
  monsterFeet(x, cy, r, ph, "#2e3440");
  shadedEllipse(x, cy, r * 0.95, r * 0.9, c.light, c.mid, c.dark);
  ctx.save();                                  // dark plate skirt + rivets
  ctx.beginPath();
  ctx.ellipse(x, cy, r * 0.95, r * 0.9, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(18,24,36,0.4)";
  ctx.fillRect(x - r, cy + r * 0.25, r * 2, r);
  ctx.restore();
  for (const sgn of [-1, 1]) {                 // shoulder pads
    shadedEllipse(x + sgn * r * 0.8, cy - r * 0.22, r * 0.3, r * 0.26, "#d7dde8", "#8b97a8", "#4f5a6b");
  }
  const hg = ctx.createLinearGradient(x, cy - r, x, cy);   // full helm
  hg.addColorStop(0, "#e6ecf6");
  hg.addColorStop(1, "#79839a");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(x, cy - r * 0.15, r * 0.62, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - r * 0.66, cy - r * 0.22, r * 1.32, r * 0.16);
  ctx.fillStyle = "#141a26";                   // eye slit
  ctx.beginPath();
  ctx.roundRect(x - r * 0.42, cy - r * 0.5, r * 0.84, r * 0.2, r * 0.1);
  ctx.fill();
  ctx.fillStyle = "#ffcf52";                   // glowing eyes inside
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sgn * r * 0.2, cy - r * 0.4, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const sgn of [-0.5, 0.5]) {             // rivets on the skirt
    ctx.beginPath();
    ctx.arc(x + sgn * r, cy + r * 0.25, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#eef2fa";
    ctx.fill();
  }
}

// tank: a huge ogre — tiny tusked head on a massive body, club on shoulder
function drawTank(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 6;
  monsterFeet(x, cy + r * 0.05, r, ph, c.dark);
  monsterClub(x + r * 0.72, cy - r * 0.25, r * 1.15, e, 0.85);  // resting over the shoulder
  shadedEllipse(x, cy + r * 0.05, r, r * 0.9, c.light, c.mid, c.dark);
  ctx.fillStyle = "rgba(255,235,200,0.28)";    // lighter belly
  ctx.beginPath();
  ctx.ellipse(x, cy + r * 0.4, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const sgn of [-1, 1]) {                 // heavy arms
    shadedEllipse(x + sgn * r * 0.92, cy + r * 0.15, r * 0.28, r * 0.36, c.light, c.mid, c.dark);
  }
  shadedEllipse(x, cy - r * 0.78, r * 0.34, r * 0.3, c.light, c.mid, c.dark);  // head
  ctx.fillStyle = "#26232b";                   // beady eyes
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sgn * r * 0.13, cy - r * 0.82, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f5f0e2";                   // tusks pointing up
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.2, cy - r * 0.62);
    ctx.lineTo(x + sgn * r * 0.26, cy - r * 0.82);
    ctx.lineTo(x + sgn * r * 0.1, cy - r * 0.66);
    ctx.closePath();
    ctx.fill();
  }
}

// flyer: a bat — big ears, glowing eyes, fangs, wings drawn by the caller
function drawFlyer(e, cy) {
  const r = e.radius, c = e.colors, x = e.x;
  ctx.fillStyle = c.dark;                      // tall ears
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.2, cy - r * 0.6);
    ctx.lineTo(x + sgn * r * 0.55, cy - r * 1.45);
    ctx.lineTo(x + sgn * r * 0.7, cy - r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  shadedEllipse(x, cy, r * 0.9, r * 0.85, c.light, c.mid, c.dark);
  angryEyes(x, cy - r * 0.2, r, { sclera: "#ffd23f", pupil: "#3d1450", size: 0.18 });
  ctx.fillStyle = "#f5f0e2";                   // fangs
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.22, cy + r * 0.32);
    ctx.lineTo(x + sgn * r * 0.15, cy + r * 0.62);
    ctx.lineTo(x + sgn * r * 0.05, cy + r * 0.32);
    ctx.closePath();
    ctx.fill();
  }
}

// boss: a horned demon king — bone horns, glowing eyes, wide toothy grin
function drawBoss(e, cy) {
  const r = e.radius, c = e.colors, x = e.x, ph = e.dist / 7;
  monsterFeet(x, cy, r, ph, c.dark);
  for (const sgn of [-1, 1]) {                 // curved bone horns
    ctx.fillStyle = "#e8dcc4";
    ctx.beginPath();
    ctx.moveTo(x + sgn * r * 0.35, cy - r * 0.6);
    ctx.quadraticCurveTo(x + sgn * r * 0.95, cy - r * 0.85, x + sgn * r * 0.85, cy - r * 1.45);
    ctx.quadraticCurveTo(x + sgn * r * 0.62, cy - r * 0.95, x + sgn * r * 0.62, cy - r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,20,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  shadedEllipse(x, cy, r, r * 0.92, c.light, c.mid, c.dark);
  for (const sgn of [-1, 1]) {                 // shoulder spikes
    ctx.fillStyle = "#e8dcc4";
    for (let i = 0; i < 2; i++) {
      const sx = x + sgn * r * (0.68 + i * 0.2), sy = cy - r * (0.35 - i * 0.14);
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.08, sy + r * 0.12);
      ctx.lineTo(sx + sgn * r * 0.1, sy - r * 0.22);
      ctx.lineTo(sx + r * 0.1, sy + r * 0.14);
      ctx.closePath();
      ctx.fill();
    }
  }
  angryEyes(x, cy - r * 0.28, r, { sclera: "#ffd23f", pupil: "#7a1408", size: 0.16, spread: 0.3 });
  toothyMouth(x, cy + r * 0.32, r * 0.5, r * 0.18, 4);
  drawCrown(x, cy, r);
}

const MONSTER_DRAWS = {
  grunt: drawGrunt, runner: drawRunner, armored: drawArmored,
  tank: drawTank, flyer: drawFlyer, boss: drawBoss,
};

function drawEnemy(e) {
  const r = e.radius;
  const lift = e.flying ? 18 : 0;      // flyers hover above their ground shadow
  const cy = e.y - lift;

  // ground shadow stays on the path; flyers cast a smaller, detached one
  if (e.flying) groundShadow(e.x + 3, e.y + 3, r * 1.0, r * 0.45);
  else groundShadow(e.x + 2, e.y + r * 0.75, r * 1.3, r * 0.5);

  if (e.flying) drawWings(e.x, cy, r);

  const draw = MONSTER_DRAWS[e.type];
  if (draw) {
    draw(e, cy);
  } else {
    // unknown type: fall back to the classic shaded sphere
    const col = e.colors;
    shadedSphere(e.x, cy, r, col.light, col.mid, col.dark);
    if (e.armor) drawArmor(e.x, cy, r);
    if (e.boss) drawCrown(e.x, cy, r);
  }

  if (e.burning) drawBurning(e.x, cy, r);

  // hp bar (width scales with size; sits above horns/ears)
  const w = Math.max(24, r * 2), h = e.boss ? 6 : 4;
  const barY = cy - r * (e.boss ? 1.55 : 1.3) - 8;
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
