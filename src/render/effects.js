// Transient visuals: projectiles, explosion/ping effects, the paused banner.
import { CONFIG } from "../config.js";
import { ctx } from "./canvas.js";

export function drawProjectile(p) {
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

export function drawEffect(fx) {
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

export function drawPausedBanner() {
  ctx.fillStyle = "rgba(10,12,18,0.5)";
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = "#e8ecf4";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⏸ Paused", CONFIG.width / 2, CONFIG.height / 2);
}
