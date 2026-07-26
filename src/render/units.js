// Friendly units: the knight rig shared by barracks soldiers, summoned
// reinforcements and the hero.
import { HERO } from "../data/hero.js";
import { SUMMON } from "../data/abilities.js";
import { state } from "../state.js";
import { ctx, groundShadow, shadedEllipse } from "./canvas.js";

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

export function drawSoldier(s) {
  groundShadow(s.x + 1, s.y + 8, 9, 4);
  drawKnight(s.x, s.y, {
    s: 0.85, dir: faceTarget(s), fighting: !!s.target,
    tunic: ["#bcd0ff", "#5b78c8", "#2f4788"], helm: ["#dfe6f2", "#8892a8"],
  });
  smallHpBar(s.x, s.y - 18, s.hp, s.maxHp);
}

// "Reinforcements" ability units — same rig as a Barracks soldier but in
// green, so a temporary summon reads as distinct from a permanent one
export function drawSummonedSoldier(s) {
  groundShadow(s.x + 1, s.y + 8, 9, 4);
  drawKnight(s.x, s.y, {
    s: 0.85, dir: faceTarget(s), fighting: !!s.target,
    tunic: [SUMMON.colors.light, SUMMON.colors.mid, SUMMON.colors.dark], helm: ["#dfe6f2", "#8892a8"],
  });
  smallHpBar(s.x, s.y - 18, s.hp, s.maxHp);
}

export function drawHero(hero) {
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
