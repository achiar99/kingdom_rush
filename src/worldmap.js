// The two level-select screens: the five stages of the campaign, and the ten
// levels inside whichever stage you opened.
//
// Fifty nodes will not fit on one board, and shouldn't — the campaign is told
// in five chapters, so the map is read the same way. `showMap()` lands on the
// stage list; `openStage()` drills into one. Both live inside the same
// #mapScreen view, swapping which board is visible.
//
// worldmap.js and ui.js import from each other (startLevel needs resetGame;
// ui's overlay and button wiring need showMap/startLevel). Safe circularity —
// see simulation.js for why.
import { LEVELS, STAGES, THEMES, LEVELS_PER_STAGE, levelsInStage } from "./data/levels.js";
import { el, setView } from "./dom.js";
import { state, loadLevel } from "./state.js";
import { progress, getStars } from "./save.js";
import { closeMenus, resetGame } from "./ui.js";
import { refreshStoreButton } from "./store.js";
import { refreshHeroPickButton } from "./heroPicker.js";

// Which stage board the player last had open, so returning from a battle puts
// them back where they were instead of at the top of the campaign.
let openStageIndex = null;

export function showMap() {
  state.paused = true;                 // freeze any in-progress game underneath
  el("overlay").classList.remove("show");
  closeMenus();
  setView("map");
  // Coming back from a level returns to that level's stage.
  if (openStageIndex !== null) renderStage(openStageIndex);
  else renderStages();
}

export function startLevel(idx) {
  openStageIndex = LEVELS[idx].stageIndex;
  loadLevel(idx);
  setView("play");
  resetGame();
}

// Re-render whichever board is currently showing — used after a purchase or
// a progress wipe changes what the screen should say.
export function renderMap() {
  if (openStageIndex !== null) renderStage(openStageIndex);
  else renderStages();
}

// ------------------------------------------------------------ stage select
function stageStats(stageIndex) {
  const levels = levelsInStage(stageIndex);
  const done = levels.filter((lv) => progress.done.includes(lv.id)).length;
  const stars = levels.reduce((a, lv) => a + getStars(lv.id), 0);
  // A stage opens once any of its levels has been unlocked.
  const unlocked = stageIndex * LEVELS_PER_STAGE < progress.unlocked;
  return { levels, done, stars, unlocked, maxStars: levels.length * 3 };
}

function renderStages() {
  openStageIndex = null;
  refreshStoreButton();
  refreshHeroPickButton();
  el("mapSub").textContent = "Choose a stage.";
  el("stageBoard").hidden = false;
  el("mapBoard").hidden = true;
  el("backToStages").hidden = true;

  const board = el("stageBoard");
  board.innerHTML = "";
  STAGES.forEach((stage, i) => {
    const { levels, done, stars, unlocked, maxStars } = stageStats(i);
    const card = document.createElement("button");
    card.className = "stage-card" + (unlocked ? "" : " locked");
    card.innerHTML =
      `<div class="st-icon">${unlocked ? stage.icon : "🔒"}</div>` +
      `<div class="st-num">STAGE ${stage.numeral}</div>` +
      `<div class="st-name">${stage.name}</div>` +
      `<div class="st-blurb">${unlocked ? stage.blurb : "Finish the stage before this one."}</div>` +
      `<div class="st-bar"><i style="width:${(done / levels.length) * 100}%"></i></div>` +
      `<div class="st-foot"><span>${done}/${levels.length} cleared</span>` +
      `<span class="st-stars">★ ${stars}/${maxStars}</span></div>`;
    if (unlocked) card.addEventListener("click", () => renderStage(i));
    board.appendChild(card);
  });
}

// ------------------------------------------------------------ level select
// Catmull-Rom spline through the node points → cubic beziers, so the trail
// reads as one flowing journey instead of a jagged polyline.
function trailD(p) {
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function renderStage(stageIndex) {
  openStageIndex = stageIndex;
  refreshStoreButton();
  refreshHeroPickButton();

  const stage = STAGES[stageIndex];
  const levels = levelsInStage(stageIndex);
  el("mapSub").textContent = `Stage ${stage.numeral} · ${stage.name} — ${stage.blurb}`;
  el("stageBoard").hidden = true;
  el("mapBoard").hidden = false;
  el("backToStages").hidden = false;

  // blurred terrain glow per level (tinted with its theme) + the dashed trail
  const svg = el("mapTrail");
  const pts = levels.map((lv) => [(lv.node.x / 100) * 900, (lv.node.y / 100) * 560]);
  svg.innerHTML =
    `<defs><filter id="regionBlur" x="-80%" y="-80%" width="260%" height="260%">` +
    `<feGaussianBlur stdDeviation="20"/></filter></defs>` +
    levels.map((lv, i) =>
      `<ellipse cx="${pts[i][0]}" cy="${pts[i][1]}" rx="78" ry="58" ` +
      `fill="${THEMES[lv.theme].grass[0]}" opacity="0.26" filter="url(#regionBlur)"/>`).join("") +
    `<path d="${trailD(pts)}" fill="none" stroke="rgba(255,243,208,0.4)" ` +
    `stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>`;

  const nodes = el("mapNodes");
  nodes.innerHTML = "";
  levels.forEach((lv) => {
    const unlocked = lv.index < progress.unlocked;
    const done = progress.done.includes(lv.id);
    const stars = getStars(lv.id);
    const btn = document.createElement("button");
    btn.className = "map-node" + (unlocked ? "" : " locked") + (done ? " done" : "");
    btn.style.left = lv.node.x + "%";
    btn.style.top = lv.node.y + "%";
    const starsRow = done
      ? `<div class="node-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>` : "";
    btn.innerHTML =
      `<div class="disc">${unlocked ? lv.levelInStage + 1 : "🔒"}</div>` +
      `<div class="label">${lv.name}</div><div class="diff">${lv.difficulty}</div>${starsRow}`;
    if (unlocked) btn.addEventListener("click", () => startLevel(lv.index));
    nodes.appendChild(btn);
  });
}

el("backToStages").addEventListener("click", renderStages);
