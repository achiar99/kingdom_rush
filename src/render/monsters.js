// Enemy figures: one drawing per creep type, plus the shared pieces (feet,
// eyes, mouths, clubs) they're assembled from. All sized off the creep's
// radius so wave/level scaling keeps working. Walk cycles key off e.dist
// (distance travelled), so monsters stop mid-stride when a soldier blocks
// them.
import { pointAtDistance } from "../geometry.js";
import { PATH, PATH_LEN } from "../state.js";
import { ctx, groundShadow, shadedSphere, shadedEllipse } from "./canvas.js";

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

// flyer: a bat — big ears, glowing eyes, fangs, wings drawn by drawEnemy
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

export function drawEnemy(e) {
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

// steel plate band across the body with rivets (sphere-fallback only)
function drawArmor(x, y, r) {
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
