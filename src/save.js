// Progress persistence: 3 independent save slots, auto-saved in two places —
// localStorage (fast, synchronous) and, via the dev server's POST /api/save,
// save-slot-<n>.json files next to the game. On boot syncFromDisk() pulls in
// any disk copy that's newer than the local one, so progress survives cleared
// browser storage and follows the project directory around.
//
// save.js and worldmap.js import from each other (worldmap reads `progress`
// to render the map; save calls renderMap() after import/wipe so the map
// reflects the change immediately). Safe circularity — see simulation.js
// for why.
import { LEVELS } from "./data/levels.js";
import { DIFFICULTIES } from "./data/difficulties.js";
import { el } from "./dom.js";
import { renderMap } from "./worldmap.js";

export const SLOT_COUNT = 3;
const ACTIVE_KEY = "towerRealm.activeSlot";
const LEGACY_KEY = "towerRealm.progress"; // pre-slots single save, migrated below
const SAVE_VERSION = 1;

const slotKey = (i) => `towerRealm.slot.${i}`;

// Upgrade-store track keys — mirrors TRACKS in data/store.js (kept as a
// literal here so sanitizing at module-load time never races the circular
// store.js → save.js import).
const UPGRADE_KEYS = ["archer", "artillery", "magic", "barracks", "summon", "fire"];
const UPGRADE_MAX_RANK = 3;

// difficultyKey is chosen once, when a slot is first created (see selectSlot).
function defaultProgress(difficultyKey) {
  return {
    unlocked: 1, done: [], updatedAt: null,
    difficulty: DIFFICULTIES[difficultyKey] ? difficultyKey : "normal",
    stars: {},    // { [levelId]: 1|2|3 } — best star rating ever earned per level
    upgrades: {}, // { [trackKey]: rank } — star Upgrade Store purchases
  };
}

// Accepts a bare {unlocked,done,difficulty,stars} object OR a wrapped export
// file ({ app, version, progress }); returns null if the shape is unusable.
function sanitizeProgress(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = raw.progress && typeof raw.progress === "object" ? raw.progress : raw;
  const validIds = new Set(LEVELS.map((lv) => lv.id));
  const unlocked = Math.min(LEVELS.length, Math.max(1, Number(src.unlocked) || 1));
  const done = Array.isArray(src.done) ? src.done.filter((id) => validIds.has(id)) : [];
  const updatedAt = Number(src.updatedAt) || Date.now();
  const difficulty = DIFFICULTIES[src.difficulty] ? src.difficulty : "normal";
  const starsRaw = src.stars && typeof src.stars === "object" ? src.stars : {};
  const stars = {};
  for (const id of Object.keys(starsRaw)) {
    if (!validIds.has(id)) continue;
    const n = Math.round(Number(starsRaw[id]));
    if (n >= 1 && n <= 3) stars[id] = n;
  }
  const upgRaw = src.upgrades && typeof src.upgrades === "object" ? src.upgrades : {};
  const upgrades = {};
  for (const key of UPGRADE_KEYS) {
    const n = Math.round(Number(upgRaw[key]));
    if (n >= 1) upgrades[key] = Math.min(UPGRADE_MAX_RANK, n);
  }
  return { unlocked, done, updatedAt, difficulty, stars, upgrades };
}

function readSlotRaw(i) {
  try { return sanitizeProgress(JSON.parse(localStorage.getItem(slotKey(i)))); }
  catch (e) { return null; }
}

// A one-time upgrade for anyone with data from before save slots existed:
// drop it into slot 0 and make that the active slot, so nothing is lost.
function migrateLegacySave() {
  if (localStorage.getItem(ACTIVE_KEY) !== null) return;
  if ([0, 1, 2].some((i) => readSlotRaw(i))) return;
  const legacy = sanitizeProgress(JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"));
  if (legacy) {
    localStorage.setItem(slotKey(0), JSON.stringify(legacy));
    localStorage.setItem(ACTIVE_KEY, "0");
  }
  localStorage.removeItem(LEGACY_KEY);
}
migrateLegacySave();

// Which slot (if any) was last explicitly opened — lets the game resume
// straight into it on the next visit instead of showing slot-select again.
export function getActiveSlot() {
  const stored = localStorage.getItem(ACTIVE_KEY);
  if (stored === null) return null; // Number(null) is 0, so this check can't be skipped
  const raw = Number(stored);
  return Number.isInteger(raw) && raw >= 0 && raw < SLOT_COUNT ? raw : null;
}

export function getSlotInfo(i) {
  const data = readSlotRaw(i);
  return data
    ? { index: i, exists: true, unlocked: data.unlocked, doneCount: data.done.length,
        updatedAt: data.updatedAt, difficulty: data.difficulty,
        totalStars: Object.values(data.stars).reduce((a, b) => a + b, 0) }
    : { index: i, exists: false };
}

export let activeSlot = null;
export let progress = defaultProgress();

// Silent resume on boot: populate `progress` from a slot without writing
// anything (a page reload shouldn't bump the slot's "last played" time).
export function loadActiveSlotSilently(i) {
  activeSlot = i;
  progress = readSlotRaw(i) || defaultProgress();
}

// Explicit user action (clicking Play/New-game on the slot-select screen):
// remembers this as the active slot for next time, and writes it to disk
// immediately. `difficultyKey` only matters for a genuinely new slot — an
// existing slot always keeps the difficulty it was created with.
export function selectSlot(i, difficultyKey) {
  const existing = readSlotRaw(i);
  activeSlot = i;
  progress = existing || defaultProgress(difficultyKey);
  localStorage.setItem(ACTIVE_KEY, String(i));
  saveProgress();
}

export function deleteSlot(i) {
  localStorage.removeItem(slotKey(i));
  pushSlotToDisk(i, null); // null deletes the slot's json file
  if (i === activeSlot) progress = defaultProgress();
}

export function getDifficulty() {
  return DIFFICULTIES[progress.difficulty] || DIFFICULTIES.normal;
}

export function saveProgress() {
  if (activeSlot === null) return;
  progress.updatedAt = Date.now();
  try { localStorage.setItem(slotKey(activeSlot), JSON.stringify(progress)); } catch (e) {}
  pushSlotToDisk(activeSlot, {
    app: "tower-realm-save", version: SAVE_VERSION,
    savedAt: new Date().toISOString(), progress,
  });
}

// ---------------------------------------------------------- disk auto-save
// Fire-and-forget write through the dev server; losing it is fine because
// localStorage always has the same data (this is the durable backup copy).
function pushSlotToDisk(i, data) {
  try {
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: i, data }),
    }).catch(() => {});
  } catch (e) { /* not served by serve.py (e.g. file://) — local-only mode */ }
}

// Boot-time pull: for each slot, if the json file on disk is newer than (or
// missing from) localStorage, adopt it. Called by main.js before the first
// screen renders.
export async function syncFromDisk() {
  await Promise.all([0, 1, 2].map(async (i) => {
    try {
      const res = await fetch(`/save-slot-${i + 1}.json`, { cache: "no-store" });
      if (!res.ok) return;
      const clean = sanitizeProgress(await res.json());
      if (!clean) return;
      const local = readSlotRaw(i);
      if (!local || (clean.updatedAt || 0) > (local.updatedAt || 0))
        localStorage.setItem(slotKey(i), JSON.stringify(clean));
    } catch (e) { /* no dev server / offline — localStorage still works */ }
  }));
}

// stars is optional — pass it whenever a level was just won to record (and
// only ever improve) the best rating earned for it.
export function markComplete(id, stars) {
  if (!progress.done.includes(id)) progress.done.push(id);
  if (stars) progress.stars[id] = Math.max(progress.stars[id] || 0, stars);
  saveProgress();
}
export function getStars(id) { return progress.stars[id] || 0; }
export function unlockLevel(idx) {
  if (idx < LEVELS.length && idx + 1 > progress.unlocked) { progress.unlocked = idx + 1; saveProgress(); }
}

export function wipeProgress() {
  if (!confirm("Erase progress in Slot " + (activeSlot + 1) + "? This can't be undone.")) return;
  progress = defaultProgress(progress.difficulty); // keep the slot's difficulty, just reset progress
  saveProgress();
  renderMap();
  setSaveTip("Slot " + (activeSlot + 1) + " erased.");
}

function setSaveTip(msg) { el("saveTip").textContent = msg; }
