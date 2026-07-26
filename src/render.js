// Render orchestrator: composes the scene each frame from the render/
// package (terrain → castle → towers → units/monsters → effects → UI
// overlays). The actual drawing lives in:
//   render/canvas.js   — shared canvas/ctx + shading vocabulary
//   render/terrain.js  — ground, road, build spots, castle
//   render/towers.js   — tower buildings + rally flag
//   render/units.js    — knight rig: soldiers, summons, hero
//   render/monsters.js — enemy figures
//   render/effects.js  — projectiles, effects, paused banner
import { CONFIG } from "./config.js";
import { TOWER_TYPES } from "./data/towerTypes.js";
import { FIRE } from "./data/abilities.js";
import { state, PATH, spotOccupied } from "./state.js";
import { canvas, ctx } from "./render/canvas.js";
import { drawGround, drawPath, drawBuildSpots, drawCastle } from "./render/terrain.js";
import { drawTower, drawRally } from "./render/towers.js";
import { drawSoldier, drawSummonedSoldier, drawHero } from "./render/units.js";
import { drawEnemy } from "./render/monsters.js";
import { drawProjectile, drawEffect, drawPausedBanner } from "./render/effects.js";

// re-exported so the rest of the game (ui.js input handling, main.js) keeps
// importing them from here
export { canvas, ctx };

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

  drawOverlays();

  if (state.paused && !state.over) drawPausedBanner();
}

// Interactive UI drawn on top of the scene: range rings, placement previews,
// rally-relocation and ability-target indicators.
function drawOverlays() {
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
}
