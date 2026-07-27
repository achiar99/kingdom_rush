// Transient visuals: projectiles, explosion/ping effects, the paused banner.
import { CONFIG } from "../config.js";
import { ctx, groundShadow, FIGURE_INK } from "./canvas.js";

// Every projectile used to be the same glowing blob, distinguished only by
// colour and radius, so a Toxotai and an Oracle and a catapult all shot the
// same ball of light. What a tower throws is half of what it IS, so each one
// now throws the thing it actually holds:
//
//   archer      an arrow, fletched, pointing where it's going
//   artillery   a tumbling boulder, lobbed along a visible arc — except the
//               Scorpion, which is a bolt-thrower and shoots an iron bolt
//   magic       an arcane mote with a comet tail
//
// Direction comes from the target rather than being stored, since a projectile
// homes and its heading changes in flight.
function heading(p) {
  const t = p.target;
  if (!t) return 0;
  return Math.atan2(t.y - p.y, t.x - p.x);
}

function arrow(p, len, headColour) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading(p));
  ctx.strokeStyle = "#7a5628";                      // shaft
  ctx.lineWidth = 1.8;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len * 0.55, 0);
  ctx.stroke();
  ctx.fillStyle = headColour;                       // head
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len * 0.5, -2.1);
  ctx.lineTo(len * 0.5, 2.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = "#e8e2cc";                        // fletching
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(-len - 3.4, sgn * 2.6);
    ctx.lineTo(-len + 2.4, sgn * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function bolt(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading(p));
  ctx.fillStyle = "#6a6258";                        // heavy iron shaft
  ctx.fillRect(-7, -1.5, 12, 3);
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-7, -1.5, 12, 3);
  ctx.fillStyle = "#dfe7ec";                        // pyramidal head
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(4.6, -3);
  ctx.lineTo(4.6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// A boulder, tumbling, lifted off its own flight line so it reads as lobbed
// rather than fired flat. The lift is cosmetic only — the projectile's real
// position is untouched, so nothing about hit detection changes.
function boulder(p, r) {
  const flight = p.flight || 1;
  const travelled = Math.hypot(p.x - (p.x0 ?? p.x), p.y - (p.y0 ?? p.y));
  const prog = Math.max(0, Math.min(1, travelled / flight));
  const lift = Math.sin(prog * Math.PI) * Math.min(34, flight * 0.22);
  const by = p.y - lift;

  groundShadow(p.x, p.y + 2, r * (1 - lift / 90), r * 0.42);
  ctx.save();
  ctx.translate(p.x, by);
  ctx.rotate(prog * 7);
  ctx.beginPath();                                  // deliberately irregular
  ctx.moveTo(-r, -r * 0.32);
  ctx.lineTo(-r * 0.36, -r);
  ctx.lineTo(r * 0.62, -r * 0.74);
  ctx.lineTo(r, r * 0.22);
  ctx.lineTo(r * 0.3, r);
  ctx.lineTo(-r * 0.7, r * 0.66);
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, "#b8b2a6");
  g.addColorStop(1, "#6d675c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";          // catch-light
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.38, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mote(p, R) {
  const a = heading(p);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
  g.addColorStop(0, "rgba(255,255,245,0.95)");
  g.addColorStop(0.35, p.color);
  g.addColorStop(1, p.color + "00");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();                                       // comet tail, trailing behind
  ctx.translate(p.x, p.y);
  ctx.rotate(a);
  const tg = ctx.createLinearGradient(0, 0, -R * 2.6, 0);
  tg.addColorStop(0, p.color);
  tg.addColorStop(1, p.color + "00");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.42);
  ctx.lineTo(-R * 2.6, 0);
  ctx.lineTo(0, R * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(p.x, p.y, R * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = "#fffbe0";
  ctx.fill();
}

export function drawProjectile(p) {
  if (p.kind === "archer") {
    // The Amazons shoot a longer, brighter-headed shaft — the one path whose
    // whole point is reach.
    arrow(p, p.spec === "amazon" ? 8.5 : 6.5,
      p.spec === "amazon" ? "#fff4c0" : "#e4dcc2");
    return;
  }
  if (p.kind === "artillery") {
    if (p.spec === "scorpion") { bolt(p); return; }
    boulder(p, p.spec === "siege" ? 7.5 : 5.5);
    return;
  }
  // magic, and anything unrecognised
  mote(p, p.attack === "splash" ? 11 : 8);
}

export function drawEffect(fx) {
  const t = 1 - fx.life / fx.maxLife;
  if (fx.kind === "levelup") {
    // hero level-up: expanding double gold ring
    for (const [r, w] of [[fx.maxR * t, 4], [fx.maxR * t * 0.65, 2.5]]) {
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,207,82,${0.9 * (1 - t)})`;
      ctx.lineWidth = w;
      ctx.stroke();
    }
    return;
  }
  if (fx.kind === "ping") {
    // hero move-command acknowledgement: a thin expanding ring, no fill
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.maxR * t, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,209,165,${0.8 * (1 - t)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  // A boulder landing should not look like an arrow connecting. The kind is
  // set by whatever caused the hit — see onProjectileHit.
  if (fx.kind === "sparks") {
    // A hard strike: a few short streaks flung out from the point of impact.
    const n = 5;
    ctx.strokeStyle = `rgba(255,238,190,${0.9 * (1 - t)})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + fx.x * 0.1;
      const r0 = fx.maxR * 0.25 * (0.3 + t);
      const r1 = fx.maxR * (0.45 + t * 0.7);
      ctx.beginPath();
      ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
      ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    return;
  }
  if (fx.kind === "rubble") {
    // A boulder landing: a low dust cloud that spreads and settles, with
    // fragments thrown clear of it.
    const r = fx.maxR * (0.35 + 0.75 * t);
    const dust = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, r);
    dust.addColorStop(0, `rgba(214,201,176,${0.5 * (1 - t)})`);
    dust.addColorStop(1, "rgba(190,175,150,0)");
    ctx.fillStyle = dust;
    ctx.beginPath();
    ctx.ellipse(fx.x, fx.y, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(120,110,96,${0.85 * (1 - t)})`;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const d = fx.maxR * (0.3 + t * 0.85);
      const fy = fx.y + Math.sin(a) * d * 0.5 - Math.sin(t * Math.PI) * 9;
      ctx.beginPath();
      ctx.ellipse(fx.x + Math.cos(a) * d, fy, 2.2 * (1 - t * 0.5), 1.7 * (1 - t * 0.5),
        a, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (fx.kind === "arcane") {
    // Sorcery: a thin ring in the caster's own colour, not a fireball. The
    // Oracle ignores armour, so its hit shouldn't read as a physical blast.
    const r = fx.maxR * (0.3 + 0.8 * t);
    ctx.strokeStyle = fx.color;
    ctx.globalAlpha = 0.85 * (1 - t);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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

// Drawn in CANVAS space, after the world transform is restored, so it has to
// cover the sky band too.
export function drawPausedBanner() {
  const h = CONFIG.height + CONFIG.skyHeight;
  ctx.fillStyle = "rgba(10,12,18,0.5)";
  ctx.fillRect(0, 0, CONFIG.width, h);
  ctx.fillStyle = "#e8ecf4";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⏸ Paused", CONFIG.width / 2, h / 2);
}
