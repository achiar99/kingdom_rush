// DOM-facing glue: HUD, build/manage popup menus, canvas input handling,
// control buttons, and the win/lose overlay.
//
// ui.js imports from simulation.js and worldmap.js, both of which import
// back from ui.js. Safe circularity — see simulation.js for why.
import { CONFIG, MAX_LEVEL } from "./config.js";
import { TOWER_TYPES, TYPE_LIST } from "./data/towerTypes.js";
import { LEVELS, WAVES } from "./data/levels.js";
import { el } from "./dom.js";
import { dist, nearestPointOnPath } from "./geometry.js";
import { state, PATH, BUILD_SPOTS, LEVEL, spotOccupied } from "./state.js";
import { makeTower, computeStats, upgradeCost, sellValue, relocateRally, makeHero, commandHero } from "./entities.js";
import { canvas } from "./render.js";
import { startNextWave } from "./simulation.js";
import { markComplete, unlockLevel, exportProgress, importProgressFromFile, wipeProgress, getDifficulty } from "./save.js";
import { showMap, startLevel } from "./worldmap.js";
import { showSlotSelect } from "./slots.js";

// ---------------------------------------------------------------- popup menus
const buildMenu = document.getElementById("buildMenu");
const towerMenu = document.getElementById("towerMenu");

function positionMenu(menuEl, x, y) {
  menuEl.style.left = (x / CONFIG.width) * 100 + "%";
  menuEl.style.top = (y / CONFIG.height) * 100 + "%";
}

export function closeMenus() { closeBuildMenu(); closeManageMenu(); }

// --- build menu (empty spot) ---
function openBuildMenu(spot) {
  closeManageMenu();
  state.menuSpot = spot;
  buildMenu.innerHTML = "";
  for (const key of TYPE_LIST) {
    const def = TOWER_TYPES[key];
    const btn = document.createElement("button");
    btn.className = "tower-opt";
    btn.disabled = state.gold < def.cost;
    btn.title = def.name + " — " + def.cost + " gold";
    btn.innerHTML =
      `<span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="ct">💰${def.cost}</span>`;
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); buildTower(spot, key); });
    buildMenu.appendChild(btn);
  }
  positionMenu(buildMenu, spot.x, spot.y);
  buildMenu.classList.add("show");
}

function closeBuildMenu() {
  state.menuSpot = null;
  buildMenu.classList.remove("show");
}

function buildTower(spot, key) {
  const def = TOWER_TYPES[key];
  if (spotOccupied(spot)) return closeBuildMenu();
  if (state.gold < def.cost) { setTip("Not enough gold for " + def.name + " (need " + def.cost + ")."); return; }
  state.gold -= def.cost;
  state.towers.push(makeTower(spot, key));
  setTip("");
  closeBuildMenu();
  updateHud();
}

// --- manage menu (existing tower): upgrade / sell ---
function openManageMenu(tower) {
  closeBuildMenu();
  state.selected = tower;
  const def = tower.def;
  const maxed = tower.level >= MAX_LEVEL;
  const upCost = upgradeCost(tower);
  const stars = "★".repeat(tower.level) + "☆".repeat(MAX_LEVEL - tower.level);
  towerMenu.innerHTML = "";

  const head = document.createElement("div");
  head.className = "thead";
  head.innerHTML = `<b>${def.icon} ${def.name}</b><div class="stars">${stars}</div>`;
  towerMenu.appendChild(head);

  const up = document.createElement("button");
  up.className = "up";
  up.disabled = maxed || state.gold < upCost;
  up.textContent = maxed ? "Max level" : `⬆ Upgrade  💰${upCost}`;
  up.addEventListener("click", (ev) => { ev.stopPropagation(); upgradeTower(tower); });
  towerMenu.appendChild(up);

  if (tower.type === "barracks") {
    const move = document.createElement("button");
    move.className = "move";
    move.textContent = "🚩 Move rally point";
    move.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeManageMenu();
      state.repositioning = tower;
      setTip("Click inside the glowing circle to relocate the rally point. Esc to cancel.");
    });
    towerMenu.appendChild(move);
  }

  const sell = document.createElement("button");
  sell.className = "sell";
  sell.textContent = `Sell  💰${sellValue(tower)}`;
  sell.addEventListener("click", (ev) => { ev.stopPropagation(); sellTower(tower); });
  towerMenu.appendChild(sell);

  positionMenu(towerMenu, tower.x, tower.y);
  towerMenu.classList.add("show");
}

function closeManageMenu() {
  state.selected = null;
  towerMenu.classList.remove("show");
}

function upgradeTower(t) {
  if (t.level >= MAX_LEVEL) return;
  const cost = upgradeCost(t);
  if (state.gold < cost) { setTip("Not enough gold to upgrade (need " + cost + ")."); return; }
  state.gold -= cost;
  t.level++;
  t.invested += cost;
  computeStats(t);
  setTip("");
  updateHud();
  openManageMenu(t); // refresh the panel with new level / costs
}

function sellTower(t) {
  const refund = sellValue(t);
  state.gold += refund;
  state.towers = state.towers.filter((x) => x !== t);
  closeManageMenu();
  updateHud();
  setTip("Sold " + t.def.name + " for " + refund + " gold.");
}

// ---------------------------------------------------------------- input
canvas.addEventListener("mousemove", (ev) => {
  const { x, y } = canvasPos(ev);
  state.hoverSpot = BUILD_SPOTS.find((s) => dist(x, y, s.x, s.y) <= 18) || null;
  const overHero = state.hero && state.hero.alive && dist(x, y, state.hero.x, state.hero.y) <= 20;
  canvas.style.cursor = state.hoverSpot || overHero || state.heroSelected ? "pointer" : "default";
});

canvas.addEventListener("click", (ev) => {
  if (state.over) return;
  const { x, y } = canvasPos(ev);

  if (state.repositioning) {
    const tower = state.repositioning;
    const snapped = nearestPointOnPath(PATH, x, y);
    if (dist(tower.x, tower.y, snapped.x, snapped.y) <= tower.def.rallyReach) {
      relocateRally(tower, snapped);
      state.repositioning = null;
      setTip("");
    } else {
      setTip("Too far — click somewhere inside the glowing circle.");
    }
    return;
  }

  const spot = BUILD_SPOTS.find((s) => dist(x, y, s.x, s.y) <= 18);
  if (spot) {
    state.heroSelected = false;
    if (spotOccupied(spot)) openManageMenu(state.towers.find((t) => t.spot === spot));
    else openBuildMenu(spot);
    return;
  }

  closeMenus();

  // hero movement is two-step: click the hero to select it, then click
  // wherever you want it to go. A ground click while nothing is selected
  // does nothing (this used to move the hero on any click, which made it
  // too easy to send it somewhere by accident while just clicking around).
  const hero = state.hero;
  if (!hero || !hero.alive) return;
  if (state.heroSelected) {
    commandHero(hero, x, y);
    state.effects.push({ x, y, maxR: 26, life: 0.4, maxLife: 0.4, kind: "ping" });
    state.heroSelected = false;
  } else if (dist(x, y, hero.x, hero.y) <= 20) {
    state.heroSelected = true;
  }
});

// click anywhere else / Escape closes any open menu (or cancels repositioning)
document.addEventListener("click", (ev) => {
  if (!buildMenu.contains(ev.target) && !towerMenu.contains(ev.target) && ev.target !== canvas)
    closeMenus();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (state.repositioning) { state.repositioning = null; setTip(""); }
  state.heroSelected = false;
  closeMenus();
});

function canvasPos(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * (canvas.width / rect.width),
    y: (ev.clientY - rect.top) * (canvas.height / rect.height),
  };
}

// ---------------------------------------------------------------- ui
export function updateHud() {
  el("gold").textContent = state.gold;
  el("lives").textContent = state.lives;
  el("wave").textContent = Math.max(0, state.waveIndex + 1);
  const h = state.hero;
  el("heroHp").textContent = !h ? "—"
    : h.alive ? Math.ceil(h.hp) + "/" + h.maxHp
    : "💀 " + Math.ceil(h.respawn) + "s";
  refreshManageMenu();
}

// Keep the open manage-menu's Upgrade button in sync as gold changes live
// (e.g. from kills while the panel is open), without rebuilding the panel.
function refreshManageMenu() {
  if (!state.selected || !towerMenu.classList.contains("show")) return;
  const t = state.selected;
  const up = towerMenu.querySelector(".up");
  if (!up) return;
  const maxed = t.level >= MAX_LEVEL;
  up.disabled = maxed || state.gold < upgradeCost(t);
}

export function updateButtons() {
  const btn = el("startBtn");
  if (state.over) { btn.disabled = true; return; }
  btn.disabled = state.running || state.waveIndex + 1 >= WAVES.length;
  btn.textContent = state.waveIndex === -1 ? "Start wave 1" : "Start wave " + (state.waveIndex + 2);
  if (state.waveIndex + 1 >= WAVES.length && !state.running) btn.textContent = "All waves done";
}

export function setTip(msg) { el("tip").textContent = msg; }

export function endGame(won) {
  state.over = true;
  state.running = false;
  closeMenus();
  const nextIdx = LEVEL.index + 1;
  if (won) { markComplete(LEVEL.id); unlockLevel(nextIdx); }

  el("overlayTitle").textContent = won ? "🏆 Victory!" : "💀 Defeated";
  el("overlaySub").textContent = won
    ? LEVEL.name + " defended against every wave!"
    : "The creeps overran " + LEVEL.name + ".";

  const btns = el("overlayBtns");
  btns.innerHTML = "";
  const mk = (label, cls, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener("click", fn);
    btns.appendChild(b);
  };
  if (won && LEVELS[nextIdx]) mk("Next level ▶", "", () => startLevel(nextIdx));
  mk(won ? "Replay" : "Retry", "secondary", () => startLevel(LEVEL.index));
  mk("🗺 World map", "secondary", showMap);
  el("overlay").classList.add("show");
  updateButtons();
}

el("startBtn").addEventListener("click", startNextWave);
el("resetBtn").addEventListener("click", () => startLevel(LEVEL.index));
el("mapBtn").addEventListener("click", showMap);
el("speedBtn").addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
  el("speedBtn").textContent = "Speed: " + state.speed + "×";
});
el("pauseBtn").addEventListener("click", () => {
  if (state.over) return;
  state.paused = !state.paused;
  el("pauseBtn").textContent = state.paused ? "▶ Resume" : "⏸ Pause";
});

el("exportBtn").addEventListener("click", exportProgress);
el("importBtn").addEventListener("click", () => el("importFile").click());
el("importFile").addEventListener("change", (ev) => {
  const file = ev.target.files[0];
  if (file) importProgressFromFile(file);
  ev.target.value = ""; // allow re-importing the same filename later
});
el("wipeBtn").addEventListener("click", wipeProgress);
el("slotsBtn").addEventListener("click", showSlotSelect);

export function resetGame() {
  const diff = getDifficulty();
  const endP = PATH[PATH.length - 1];
  Object.assign(state, {
    gold: Math.round(LEVEL.startGold * diff.goldMul),
    lives: Math.round(LEVEL.startLives * diff.livesMul),
    waveIndex: -1,
    enemies: [], towers: [], projectiles: [], effects: [],
    hero: makeHero({ x: endP.x - 70, y: endP.y }), // starts guarding the castle
    spawnQueue: [], spawnTimer: 0,
    running: false, over: false, paused: false, speed: 1,
    hoverSpot: null, menuSpot: null, selected: null, repositioning: null,
    heroSelected: false,
  });
  el("levelName").textContent = LEVEL.name + " · " + diff.icon + " " + diff.name;
  el("speedBtn").textContent = "Speed: 1×";
  el("pauseBtn").textContent = "⏸ Pause";
  el("overlay").classList.remove("show");
  el("waveMax").textContent = WAVES.length;
  closeMenus();
  setTip("Place towers, then start wave 1.");
  updateHud();
  updateButtons();
}
