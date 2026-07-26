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
import { drawGround, drawPath, drawBuildSpots, drawCastle, TEMPLE_EXTENT } from "./render/terrain.js";
import { drawTower, drawRally } from "./render/towers.js";
import { drawSoldier, drawSummonedSoldier, drawHero } from "./render/units.js";
import { drawEnemy } from "./render/monsters.js";
import { drawProjectile, drawEffect, drawPausedBanner } from "./render/effects.js";

// re-exported so the rest of the game (ui.js input handling, main.js) keeps
// importing them from here
export { canvas, ctx };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The hero portrait and ability squares are an HTML overlay pinned to the
// canvas's bottom-left corner (#abilityBar in index.html). In canvas
// coordinates that's roughly x 10-200, y 492-550, with a little slack here.
const UI_RESERVED = { x0: 0, y0: 484, x1: 210, y1: 560 };

// Where the temple stands.
//
// Paths deliberately end 30px OUTSIDE the canvas so creeps can walk off the
// edge, which means the exit point itself is never a legal place to put a
// building — it has to be clamped in. And since every road exits through the
// left or right edge, on low-exiting levels that clamp drops it straight
// under the ability bar, which is how it ended up invisible.
function templeSpot() {
  const { halfW, up, down } = TEMPLE_EXTENT;
  const exit = PATH[PATH.length - 1];
  let x = clamp(exit.x, halfW, CONFIG.width - halfW);
  let y = clamp(exit.y, up, CONFIG.height - down);

  const hidden = () =>
    x - halfW < UI_RESERVED.x1 && x + halfW > UI_RESERVED.x0 &&
    y - up < UI_RESERVED.y1 && y + down > UI_RESERVED.y0;

  if (hidden()) {
    // Lift it above the bar — that keeps it at the road's exit, just set back
    // from the verge. Sliding sideways is the fallback for a road so low that
    // there's no headroom.
    const lifted = UI_RESERVED.y0 - down;
    if (lifted >= up) y = lifted;
    else x = Math.min(CONFIG.width - halfW, UI_RESERVED.x1 + halfW);
  }
  return { x, y };
}

export function render() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  drawGround();
  drawPath();
  drawBuildSpots();

  // the temple the creeps are marching on — see templeSpot() for the placement
  const temple = templeSpot();
  drawCastle(temple.x, temple.y);

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
  // Range ring for a selected tower. A barracks' leash is measured from its
  // RALLY point, not from the building — drawing it around the building was
  // showing the player an area the soldiers don't actually cover.
  if (state.selected) {
    const t = state.selected;
    const c = t.def.attack === "none" && t.rally ? t.rally : t;
    ctx.beginPath();
    ctx.arc(c.x, c.y, t.range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,209,165,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(90,209,165,0.55)";
    ctx.stroke();
    // and a thin tether back to the building it belongs to
    if (c !== t) {
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(90,209,165,0.4)";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
