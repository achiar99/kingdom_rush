// Progress persistence: 3 independent save slots, auto-saved in two places —
// localStorage (fast, synchronous) and, via the dev server's POST /api/save,
// save-slot-<n>.json files next to the game. On boot syncFromDisk() pulls in
// any disk copy that's newer than the local one, so progress survives cleared
// browser storage and follows the project directory around.
//
// This module is deliberately DOM-free (the confirm-and-redraw half of
// "erase slot" lives in ui.js), so the balance harness in tools/sim can
// import it under Node to set a run's difficulty, hero and star upgrades.
import { LEVELS } from "./data/levels.js";
import { DIFFICULTIES } from "./data/difficulties.js";
import { HEROES, DEFAULT_HERO } from "./data/hero.js";

// Outside a browser there is no localStorage; an in-memory stand-in keeps
// every read/write below working unchanged (and un-persisted, which is what
// a headless simulation run wants anyway).
const store = typeof localStorage !== "undefined" ? localStorage : (() => {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
})();

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
    hero: DEFAULT_HERO, // which champion this slot fields (picked on the map)
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
  const hero = HEROES[src.hero] ? src.hero : DEFAULT_HERO;
  return { unlocked, done, updatedAt, difficulty, stars, upgrades, hero };
}

function readSlotRaw(i) {
  try { return sanitizeProgress(JSON.parse(store.getItem(slotKey(i)))); }
  catch (e) { return null; }
}

// A one-time upgrade for anyone with data from before save slots existed:
// drop it into slot 0 and make that the active slot, so nothing is lost.
function migrateLegacySave() {
  if (store.getItem(ACTIVE_KEY) !== null) return;
  if ([0, 1, 2].some((i) => readSlotRaw(i))) return;
  const legacy = sanitizeProgress(JSON.parse(store.getItem(LEGACY_KEY) || "null"));
  if (legacy) {
    store.setItem(slotKey(0), JSON.stringify(legacy));
    store.setItem(ACTIVE_KEY, "0");
  }
  store.removeItem(LEGACY_KEY);
}
migrateLegacySave();

// Which slot (if any) the game can resume straight into on the next visit,
// instead of showing slot-select again.
//
// "Was last opened" isn't enough on its own: the remembered slot may since
// have been deleted, and resuming into one that no longer holds any data
// would drop the player on the world map looking at a phantom empty save.
// With nothing real to resume, boot belongs on the slot screen.
export function getActiveSlot() {
  const stored = store.getItem(ACTIVE_KEY);
  if (stored === null) return null; // Number(null) is 0, so this check can't be skipped
  const raw = Number(stored);
  const inRange = Number.isInteger(raw) && raw >= 0 && raw < SLOT_COUNT;
  return inRange && readSlotRaw(raw) ? raw : null;
}

// True when every slot is empty — a first-ever visit, or one where the player
// has deleted everything. Either way there is nothing to resume.
export const noSlotsExist = () =>
  !Array.from({ length: SLOT_COUNT }, (_, i) => readSlotRaw(i)).some(Boolean);

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
  store.setItem(ACTIVE_KEY, String(i));
  saveProgress();
}

export function deleteSlot(i) {
  store.removeItem(slotKey(i));
  pushSlotToDisk(i, null); // null deletes the slot's json file
  if (i === activeSlot) {
    // Drop the resume pointer too — leaving it aimed at a slot that no
    // longer exists is what used to boot the game into a phantom save.
    activeSlot = null;
    store.removeItem(ACTIVE_KEY);
    progress = defaultProgress();
  }
}

export function getDifficulty() {
  return DIFFICULTIES[progress.difficulty] || DIFFICULTIES.normal;
}

export function saveProgress() {
  if (activeSlot === null) return;
  progress.updatedAt = Date.now();
  try { store.setItem(slotKey(activeSlot), JSON.stringify(progress)); } catch (e) {}
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
        store.setItem(slotKey(i), JSON.stringify(clean));
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

// Blank the active slot, keeping the difficulty it was created with. The
// confirm prompt and the map redraw are ui.js's job (see the wipeBtn handler).
export function resetProgress() {
  progress = defaultProgress(progress.difficulty);
  saveProgress();
}

// Used by the balance harness to configure a run — difficulty, hero and star
// upgrade ranks all read through `progress`, and nothing is persisted while
// activeSlot is null (saveProgress bails out early).
export function setProgressForSimulation(partial) {
  progress = sanitizeProgress({ ...defaultProgress(), ...partial }) || defaultProgress();
}
