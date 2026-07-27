// DOM-facing glue: HUD, build/manage popup menus, canvas input handling,
// control buttons, and the win/lose overlay.
//
// simulation.js does NOT import this module — it talks to whatever screen is
// attached through simHooks, and the installSimHooks() call at the bottom of
// this file is what plugs the real DOM in. ui.js and worldmap.js still import
// from each other; safe circularity, since every cross-reference is only
// *called* inside a function body, long after both have finished loading.
import { CONFIG, MAX_LEVEL } from "./config.js";
import { TOWER_TYPES, TYPE_LIST, specDef, specsFor } from "./data/towerTypes.js";
import { LEVELS, wavesFor } from "./data/levels.js";
import { maxTowerLevelFor } from "./data/unlocks.js";
import { HERO_LEVELING } from "./data/hero.js";
import { el } from "./dom.js";
import { dist } from "./geometry.js";
import { state, BUILD_SPOTS, LEVEL, spotOccupied } from "./state.js";
import { upgradeCost, sellValue } from "./entities.js";
import * as act from "./actions.js";
import { withCanvas } from "./render/canvas.js";
import { drawTower } from "./render/towers.js";
import { canvas } from "./render.js";
import { startNextWave, resetRun, earlyCallBonus } from "./simulation.js";
import { installSimHooks } from "./simHooks.js";
import { activeSlot, resetProgress } from "./save.js";
import { showMap, startLevel, renderMap } from "./worldmap.js";
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
    const { locked, wave: unlockAt } = act.towerUnlockState(btn.dataset.key);
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
  if (act.towerUnlockState(key).locked) return;
  if (spotOccupied(spot)) return closeBuildMenu();
  const res = act.buildTower(spot, key);
  setTip(res.ok ? "" : res.reason);
  if (res.ok) closeBuildMenu();
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

  const spec = tower.spec ? specDef(tower.type, tower.spec) : null;
  const head = document.createElement("div");
  head.className = "thead";
  head.innerHTML = spec
    ? `<b>${spec.icon} ${spec.name}</b><div class="stars">specialised</div>`
    : `<b>${def.icon} ${def.name}</b><div class="stars">${stars}</div>`;
  towerMenu.appendChild(head);

  if (!spec) {
    const up = document.createElement("button");
    up.className = "up";
    up.disabled = maxed || capped || state.gold < upCost;
    up.textContent = maxed ? "Fully upgraded"
      : capped ? "🔒 Upgrades unlock in later realms"
      : `⬆ Upgrade  💰${upCost}`;
    up.addEventListener("click", (ev) => { ev.stopPropagation(); upgradeTower(tower); });
    towerMenu.appendChild(up);
  }

  // At full level the tower offers its two branches instead. Both are shown
  // even when unaffordable — knowing what you're saving for is the point.
  if (!spec && (maxed || capped)) {
    const note = document.createElement("div");
    note.className = "spec-note";
    note.textContent = "Choose a path — permanent";
    towerMenu.appendChild(note);
    for (const s of specsFor(tower.type)) {
      const btn = document.createElement("button");
      btn.className = "spec";
      btn.disabled = !act.canSpecialize(tower, s.key).ok;
      btn.innerHTML = `<canvas class="sp-art"></canvas>` +
        `<span class="sp-name">${s.icon} ${s.name}</span>` +
        `<span class="sp-cost">💰${s.cost}</span>` +
        `<span class="sp-blurb">${s.blurb}</span>`;
      btn.addEventListener("click", (ev) => { ev.stopPropagation(); specializeTower(tower, s.key); });
      towerMenu.appendChild(btn);
      paintSpecArt(btn.querySelector(".sp-art"), tower.type, s.key);
    }
  }

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
  const res = act.upgradeTower(t);
  setTip(res.ok ? "" : res.reason);
  updateHud();
  if (res.ok) openManageMenu(t); // refresh the panel with new level / costs
}

// Paint one path's building into its button, using the real tower renderer.
//
// Specialising is permanent, and the two branches are now genuinely different
// structures rather than recolours — a walled Spartiate blockhouse against an
// open Myrmidon court, a square siege bastion against a round swivel turret.
// A player choosing between those deserves to see them.
function paintSpecArt(cv, type, specKey) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = 46, h = 52;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  // Same per-type normalisation the Field Guide uses — an Amazon spire is
  // roughly twice a Ballista, so one shared scale leaves half the tiles empty.
  const TOWER_H = { archer: 108, artillery: 66, barracks: 58, magic: 76 };
  try {
    withCanvas(g, () => {
      g.translate(w / 2, h - 4);
      const k = Math.min(0.9, (h - 8) / (TOWER_H[type] || 80));
      g.scale(k, k);
      drawTower({ x: 0, y: 0, type, level: 3, spec: specKey,
                  fireRate: 1, cooldown: 0, range: 0, hitsAir: true });
    });
  } catch {
    // A thumbnail that cannot draw must never block the choice itself.
  }
}

function specializeTower(t, specKey) {
  const res = act.specializeTower(t, specKey);
  setTip(res.ok ? "" : res.reason);
  updateHud();
  if (res.ok) openManageMenu(t);   // redraw as the specialised tower
}

function sellTower(t) {
  const name = t.def.name;
  const refund = act.sellTower(t);
  closeManageMenu();
  updateHud();
  setTip("Sold " + name + " for " + refund + " gold.");
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
  if (state.placingAbility) {
    const res = state.placingAbility === "soldiers"
      ? act.castReinforcements(x, y)
      : act.castIgnite(x, y);
    state.placingAbility = null;
    setTip(res.ok ? "" : res.reason);
    return;
  }

  if (state.repositioning) {
    const res = act.relocateRallyPoint(state.repositioning, x, y);
    if (res.ok) state.repositioning = null;
    setTip(res.ok ? "" : res.reason);
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
    act.moveHero(x, y);
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
  updateButtons();   // the between-wave countdown lives on the Start button
}

// null when usable now; otherwise the lock label ("🔒" for the whole level,
// "🔒w4" when it opens up at a later wave of this one)
function abilityLock(key) {
  const { locked, wave } = act.abilityUnlockState(key);
  if (!locked) return null;
  return wave === null ? "🔒" : "🔒w" + wave;
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
  if (up) {
    const maxed = t.level >= maxTowerLevelFor(LEVEL.index);
    up.disabled = maxed || state.gold < upgradeCost(t);
  }
  // Specialisation buttons track affordability the same way, so a path
  // becomes clickable the moment the kill that pays for it lands.
  const specs = specsFor(t.type);
  towerMenu.querySelectorAll(".spec").forEach((btn, i) => {
    if (specs[i]) btn.disabled = !act.canSpecialize(t, specs[i].key).ok;
  });
}

export function updateButtons() {
  const btn = el("startBtn");
  if (state.over) { btn.disabled = true; return; }
  const waveCount = wavesFor(LEVEL).length;
  const allSent = state.waveIndex + 1 >= waveCount;
  btn.disabled = allSent;

  if (allSent) {
    btn.textContent = state.running ? "Final wave — hold the line" : "All waves done";
    return;
  }

  // Wave 1 has no clock and no bonus — it waits for the player, so the button
  // is phrased as the thing that starts the battle rather than as hurrying it.
  if (state.waveIndex === -1) { btn.textContent = "▶ Begin — start wave 1"; return; }

  // The countdown to the next wave runs during the current one, so this label
  // is live for the whole battle rather than only in the gaps. It used to read
  // "Wave 7 incoming…" with no clock at all while a wave was up, which left no
  // way to see how long you had — that is what this display is for.
  const label = "Send wave " + (state.waveIndex + 2);
  const bonus = earlyCallBonus();
  btn.textContent = `${label} ⏱${Math.ceil(state.nextWaveIn)}s` +
    (bonus > 0 ? `  +💰${bonus}` : "");
}

export function setTip(msg) { el("tip").textContent = msg; }

// The win/lose overlay. Installed as simHooks.onGameOver, so simulation.js
// fires it after it has already frozen the run and banked the star rating.
function showGameOverOverlay(won, stars) {
  const nextIdx = LEVEL.index + 1;
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
}

// Hand the running game its screen. Everything here is presentation only —
// the rules in simulation.js work the same with these left as no-ops, which
// is exactly how the balance harness (tools/sim) drives them.
installSimHooks({
  closeMenus, updateHud, updateButtons, setTip,
  onGameOver: showGameOverOverlay,
});

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

el("wipeBtn").addEventListener("click", () => {
  if (!confirm("Erase progress in Slot " + (activeSlot + 1) + "? This can't be undone.")) return;
  resetProgress();
  renderMap();
  el("saveTip").textContent = "Slot " + (activeSlot + 1) + " erased.";
});
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
function armAbility(key, copy) {
  const { locked, wave } = act.abilityUnlockState(key);
  if (locked) {
    setTip(wave === null ? copy.realmLocked : copy.waveLocked(wave));
    return;
  }
  if (state.abilityCooldowns[key] > 0) return;
  state.repositioning = null;
  state.heroSelected = false;
  closeMenus();
  state.placingAbility = key;
  setTip(copy.prompt);
}

el("abilitySoldiers").addEventListener("click", () => armAbility("soldiers", {
  realmLocked: "Reinforcements aren't available in this realm yet.",
  waveLocked: (w) => "Reinforcements unlock at wave " + w + ".",
  prompt: "Click where to send in reinforcements. Esc to cancel.",
}));

el("abilityFire").addEventListener("click", () => armAbility("fire", {
  realmLocked: "Ignite isn't available in this realm yet.",
  waveLocked: (w) => "Ignite unlocks at wave " + w + ".",
  prompt: "Click where to set enemies ablaze. Esc to cancel.",
}));

export function resetGame() {
  const { diff, heroDef } = resetRun();
  el("heroPortrait").querySelector(".icon").textContent = heroDef.icon;
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
