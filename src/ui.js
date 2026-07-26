// DOM-facing glue: HUD, build/manage popup menus, canvas input handling,
// control buttons, and the win/lose overlay.
//
// ui.js imports from simulation.js and worldmap.js, both of which import
// back from ui.js. Safe circularity — see simulation.js for why.
import { CONFIG, MAX_LEVEL } from "./config.js";
import { TOWER_TYPES, TYPE_LIST } from "./data/towerTypes.js";
import { LEVELS, wavesFor } from "./data/levels.js";
import { currentWave, towerUnlockWave, abilityUnlockWave, maxTowerLevelFor } from "./data/unlocks.js";
import { summonCountBonus, fireDpsMul, fireDurationBonus } from "./data/store.js";
import { ABILITY_COOLDOWN, SUMMON, FIRE } from "./data/abilities.js";
import { HEROES, DEFAULT_HERO, HERO_LEVELING } from "./data/hero.js";
import { el } from "./dom.js";
import { dist, nearestPointOnPath } from "./geometry.js";
import { state, PATH, BUILD_SPOTS, LEVEL, spotOccupied } from "./state.js";
import {
  makeTower, computeStats, upgradeCost, sellValue, relocateRally,
  makeHero, commandHero, makeSummonedSoldier,
} from "./entities.js";
import { canvas } from "./render.js";
import { startNextWave } from "./simulation.js";
import { progress, markComplete, unlockLevel, wipeProgress, getDifficulty } from "./save.js";
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
// The menu is built once on open, then kept live by syncBuildMenu (called
// every frame from updateHud): affordability tracks gold as it changes, and
// lock labels flip in place the moment a wave unlock lands. Click handlers
// are attached unconditionally — buildTower re-validates lock + gold.
function openBuildMenu(spot) {
  closeManageMenu();
  state.menuSpot = spot;
  buildMenu.innerHTML = "";
  for (const key of TYPE_LIST) {
    const def = TOWER_TYPES[key];
    const btn = document.createElement("button");
    btn.className = "tower-opt";
    btn.dataset.key = key;
    btn.innerHTML = `<span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="ct"></span>`;
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); buildTower(spot, key); });
    buildMenu.appendChild(btn);
  }
  syncBuildMenu(true);
  positionMenu(buildMenu, spot.x, spot.y);
  buildMenu.classList.add("show");
}

function syncBuildMenu(force = false) {
  if (!force && (!state.menuSpot || !buildMenu.classList.contains("show"))) return;
  for (const btn of buildMenu.querySelectorAll(".tower-opt")) {
    const def = TOWER_TYPES[btn.dataset.key];
    const unlockAt = towerUnlockWave(LEVEL.index, btn.dataset.key);
    const locked = unlockAt === null || currentWave(state) < unlockAt;
    btn.disabled = locked || state.gold < def.cost;      // cheap, safe to set every frame
    const lockState = locked ? (unlockAt === null ? "realm" : "w" + unlockAt) : "open";
    if (btn.dataset.lockState === lockState) continue;   // label/tooltip already right
    btn.dataset.lockState = lockState;
    btn.title = locked
      ? def.name + (unlockAt === null ? " — unlocks in a later realm" : " — unlocks at wave " + unlockAt)
      : def.name + " — " + def.cost + " gold";
    btn.querySelector(".ct").innerHTML = locked
      ? `🔒${unlockAt === null ? "" : " w" + unlockAt}`
      : `💰${def.cost}`;
  }
}

function closeBuildMenu() {
  state.menuSpot = null;
  buildMenu.classList.remove("show");
}

function buildTower(spot, key) {
  const def = TOWER_TYPES[key];
  const unlockAt = towerUnlockWave(LEVEL.index, key);
  if (unlockAt === null || currentWave(state) < unlockAt) return;
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
  const levelCap = maxTowerLevelFor(LEVEL.index);
  const maxed = tower.level >= MAX_LEVEL;
  const capped = !maxed && tower.level >= levelCap;   // held back by this realm, not truly maxed
  const upCost = upgradeCost(tower);
  const stars = "★".repeat(tower.level) + "☆".repeat(MAX_LEVEL - tower.level);
  towerMenu.innerHTML = "";

  const head = document.createElement("div");
  head.className = "thead";
  head.innerHTML = `<b>${def.icon} ${def.name}</b><div class="stars">${stars}</div>`;
  towerMenu.appendChild(head);

  const up = document.createElement("button");
  up.className = "up";
  up.disabled = maxed || capped || state.gold < upCost;
  up.textContent = maxed ? "Max level"
    : capped ? "🔒 Upgrades unlock in later realms"
    : `⬆ Upgrade  💰${upCost}`;
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
  if (t.level >= maxTowerLevelFor(LEVEL.index)) return;
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
  state.hoverPos = { x, y };
  state.hoverSpot = BUILD_SPOTS.find((s) => dist(x, y, s.x, s.y) <= 18) || null;
  const overHero = state.hero && state.hero.alive && dist(x, y, state.hero.x, state.hero.y) <= 20;
  canvas.style.cursor = state.placingAbility || state.hoverSpot || overHero || state.heroSelected
    ? "pointer" : "default";
});

canvas.addEventListener("click", (ev) => {
  if (state.over) return;
  const { x, y } = canvasPos(ev);

  // ability placement takes priority over everything else — clicking
  // anywhere on the field (even a build spot) commits the ability there
  if (state.placingAbility === "soldiers") {
    const count = SUMMON.count + summonCountBonus();
    for (let i = 0; i < count; i++)
      state.summonedSoldiers.push(makeSummonedSoldier({ x, y }, (i / count) * Math.PI * 2));
    state.abilityCooldowns.soldiers = ABILITY_COOLDOWN;
    state.placingAbility = null;
    setTip("");
    return;
  }
  if (state.placingAbility === "fire") {
    for (const e of state.enemies) {
      if (e.dead || dist(x, y, e.x, e.y) > FIRE.radius) continue;
      e.burning = true;
      e.burnFor = FIRE.duration + fireDurationBonus();
      e.burnDps = FIRE.dps * fireDpsMul();
    }
    state.effects.push({ x, y, maxR: FIRE.radius, life: 0.4, maxLife: 0.4 });
    state.abilityCooldowns.fire = ABILITY_COOLDOWN;
    state.placingAbility = null;
    setTip("");
    return;
  }

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
  if (state.placingAbility) { state.placingAbility = null; setTip(""); }
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
    : h.alive ? "Lv" + h.level + " · " + Math.ceil(h.hp) + "/" + h.maxHp
    : "💀 " + Math.ceil(h.respawn) + "s";

  const portrait = el("heroPortrait");
  portrait.classList.toggle("downed", !!h && !h.alive);
  portrait.classList.toggle("selected", state.heroSelected);
  if (h) {
    el("heroPortraitHp").style.width = Math.max(0, (h.hp / h.maxHp) * 100) + "%";
    el("heroPortraitDowned").textContent = h.alive ? "" : "💀 " + Math.ceil(h.respawn) + "s";
    el("heroLvl").textContent = h.level;
    const atCap = h.level >= HERO_LEVELING.maxLevel;
    el("heroPortraitXp").style.width = (atCap ? 100 : (h.xp / HERO_LEVELING.xpForNext(h.level)) * 100) + "%";
    portrait.title = atCap
      ? "Hero — level " + h.level + " (max)"
      : "Hero — level " + h.level + " · " + Math.floor(h.xp) + "/" + HERO_LEVELING.xpForNext(h.level) + " XP";
  }

  syncAbilityButton("abilitySoldiers", "abilitySoldiersCd", state.abilityCooldowns.soldiers, "soldiers");
  syncAbilityButton("abilityFire", "abilityFireCd", state.abilityCooldowns.fire, "fire");

  syncBuildMenu();
  refreshManageMenu();
}

// null when usable now; otherwise the lock label ("🔒" for the whole level,
// "🔒w4" when it opens up at a later wave of this one)
function abilityLock(key) {
  if (!LEVEL) return "🔒";
  const at = abilityUnlockWave(LEVEL.index, key);
  if (at === null) return "🔒";
  return currentWave(state) < at ? "🔒w" + at : null;
}

// Grey out an ability square while locked or cooling down, with a label why.
function syncAbilityButton(btnId, cdId, cooldown, key) {
  const lock = abilityLock(key);
  const onCooldown = cooldown > 0;
  el(btnId).classList.toggle("cooling", onCooldown || !!lock);
  el(cdId).textContent = lock ? lock : onCooldown ? Math.ceil(cooldown) + "s" : "";
}

// Keep the open manage-menu's Upgrade button in sync as gold changes live
// (e.g. from kills while the panel is open), without rebuilding the panel.
function refreshManageMenu() {
  if (!state.selected || !towerMenu.classList.contains("show")) return;
  const t = state.selected;
  const up = towerMenu.querySelector(".up");
  if (!up) return;
  const maxed = t.level >= maxTowerLevelFor(LEVEL.index);
  up.disabled = maxed || state.gold < upgradeCost(t);
}

export function updateButtons() {
  const btn = el("startBtn");
  if (state.over) { btn.disabled = true; return; }
  const waveCount = wavesFor(LEVEL).length;
  btn.disabled = state.running || state.waveIndex + 1 >= waveCount;
  btn.textContent = state.waveIndex === -1 ? "Start wave 1" : "Start wave " + (state.waveIndex + 2);
  if (state.waveIndex + 1 >= waveCount && !state.running) btn.textContent = "All waves done";
}

export function setTip(msg) { el("tip").textContent = msg; }

// Star rating is based on % of that playthrough's starting lives left at the
// end — thresholds scale with the level/difficulty's actual life total
// instead of a fixed number, so e.g. Emberfall (18 lives) or Hard (×0.8)
// rate fairly against the same bar as a standard 20-life Normal run.
function starsForRun() {
  const startingLives = Math.round(LEVEL.startLives * getDifficulty().livesMul);
  const pct = state.lives / startingLives;
  return pct >= 0.9 ? 3 : pct >= 0.55 ? 2 : 1;
}

export function endGame(won) {
  state.over = true;
  state.running = false;
  closeMenus();
  const nextIdx = LEVEL.index + 1;
  const stars = won ? starsForRun() : 0;
  if (won) { markComplete(LEVEL.id, stars); unlockLevel(nextIdx); }

  el("overlayTitle").textContent = won ? "🏆 Victory!" : "💀 Defeated";
  el("overlaySub").textContent = won
    ? LEVEL.name + " defended against every wave! " + "★".repeat(stars) + "☆".repeat(3 - stars)
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

el("wipeBtn").addEventListener("click", wipeProgress);
el("slotsBtn").addEventListener("click", showSlotSelect);

// bottom-left hero portrait: selects the hero, same as clicking it on the
// battlefield — a fixed, always-reachable stand-in for a unit that's small
// and constantly moving around the map.
el("heroPortrait").addEventListener("click", () => {
  const hero = state.hero;
  if (!hero || !hero.alive) return;
  state.heroSelected = !state.heroSelected; // click again to cancel the selection
});

// Both ability squares arm a "placement" mode instead of casting instantly —
// the actual effect happens wherever the player clicks next (see the canvas
// click handler above, which checks state.placingAbility first).
el("abilitySoldiers").addEventListener("click", () => {
  const lock = abilityLock("soldiers");
  if (lock) { setTip(lock === "🔒" ? "Reinforcements aren't available in this realm yet." : "Reinforcements unlock at wave " + lock.slice(2) + "."); return; }
  if (state.abilityCooldowns.soldiers > 0) return;
  state.repositioning = null;
  state.heroSelected = false;
  closeMenus();
  state.placingAbility = "soldiers";
  setTip("Click where to send in reinforcements. Esc to cancel.");
});

el("abilityFire").addEventListener("click", () => {
  const lock = abilityLock("fire");
  if (lock) { setTip(lock === "🔒" ? "Ignite isn't available in this realm yet." : "Ignite unlocks at wave " + lock.slice(2) + "."); return; }
  if (state.abilityCooldowns.fire > 0) return;
  state.repositioning = null;
  state.heroSelected = false;
  closeMenus();
  state.placingAbility = "fire";
  setTip("Click where to set enemies ablaze. Esc to cancel.");
});

export function resetGame() {
  const diff = getDifficulty();
  const endP = PATH[PATH.length - 1];
  const heroDef = HEROES[progress.hero] || HEROES[DEFAULT_HERO];
  el("heroPortrait").querySelector(".icon").textContent = heroDef.icon;
  Object.assign(state, {
    gold: Math.round(LEVEL.startGold * diff.goldMul),
    lives: Math.round(LEVEL.startLives * diff.livesMul),
    waveIndex: -1,
    enemies: [], towers: [], projectiles: [], effects: [],
    hero: makeHero({ x: endP.x - 70, y: endP.y }, heroDef), // starts guarding the castle
    summonedSoldiers: [], abilityCooldowns: { soldiers: 0, fire: 0 },
    spawnQueue: [], spawnTimer: 0,
    running: false, over: false, paused: false, speed: 1,
    hoverSpot: null, menuSpot: null, selected: null, repositioning: null,
    heroSelected: false, placingAbility: null, hoverPos: null,
  });
  el("levelName").textContent = LEVEL.name + " · " + diff.icon + " " + diff.name;
  el("speedBtn").textContent = "Speed: 1×";
  el("pauseBtn").textContent = "⏸ Pause";
  el("overlay").classList.remove("show");
  el("waveMax").textContent = wavesFor(LEVEL).length;
  closeMenus();
  setTip("Place towers, then start wave 1.");
  updateHud();
  updateButtons();
}
