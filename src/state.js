// The single mutable "world" every other module reads/writes: the active
// level's geometry/theme, and the live game state (gold, entities, etc).
//
// PATH/BUILD_SPOTS/PATH_LEN/THEME/LEVEL are exported as `let` bindings —
// ES module imports are live references, so when loadLevel() reassigns them
// here, every module that imported them sees the new value automatically.
import { LEVELS, THEMES } from "./data/levels.js";
import { ENEMY_KITS } from "./data/enemyKits.js";
import { pathLength } from "./geometry.js";

export let PATH = [];
export let BUILD_SPOTS = [];
export let PATH_LEN = 0;
export let THEME = null;
export let LEVEL = null; // current level def
// The creature roster for this level's stage, keyed by role. Wave tables name
// roles; this is what turns "swift" into a peltast or a Scylla hound.
export let KIT = null;

export function loadLevel(idx) {
  LEVEL = LEVELS[idx];
  PATH = LEVEL.path;
  BUILD_SPOTS = LEVEL.spots;
  THEME = THEMES[LEVEL.theme];
  KIT = ENEMY_KITS[LEVEL.kit].creatures;
  PATH_LEN = pathLength(PATH);
}

export const state = {
  gold: 0, lives: 0, waveIndex: -1,
  enemies: [], towers: [], projectiles: [], effects: [], hero: null,
  summonedSoldiers: [], abilityCooldowns: { soldiers: 0, fire: 0 },
  spawnQueue: [],  // pending spawns, each stamped with the battle-clock time it is due
  clock: 0,        // seconds of battle elapsed; spawns are scheduled against it
  wavePaid: [],    // wavePaid[i] once wave i's clear bonus has been handed over
  nextWaveIn: 0,   // seconds until the next wave launches itself
  running: false, over: false, paused: false, speed: 1,
  hoverSpot: null, menuSpot: null, selected: null, repositioning: null,
  heroSelected: false,
  placingAbility: null, hoverPos: null, // "soldiers" | "fire" | null
};

export function spotOccupied(spot) {
  return state.towers.some((t) => t.spot === spot);
}
