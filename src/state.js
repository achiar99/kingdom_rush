// The single mutable "world" every other module reads/writes: the active
// level's geometry/theme, and the live game state (gold, entities, etc).
//
// PATH/BUILD_SPOTS/PATH_LEN/THEME/LEVEL are exported as `let` bindings —
// ES module imports are live references, so when loadLevel() reassigns them
// here, every module that imported them sees the new value automatically.
import { LEVELS, THEMES } from "./data/levels.js";
import { pathLength } from "./geometry.js";

export let PATH = [];
export let BUILD_SPOTS = [];
export let PATH_LEN = 0;
export let THEME = null;
export let LEVEL = null; // current level def

export function loadLevel(idx) {
  LEVEL = LEVELS[idx];
  LEVEL.index = idx;
  PATH = LEVEL.path;
  BUILD_SPOTS = LEVEL.spots;
  THEME = THEMES[LEVEL.theme];
  PATH_LEN = pathLength(PATH);
}

export const state = {
  gold: 0, lives: 0, waveIndex: -1,
  enemies: [], towers: [], projectiles: [], effects: [],
  spawnQueue: [], spawnTimer: 0,
  running: false, over: false, paused: false, speed: 1,
  hoverSpot: null, menuSpot: null, selected: null,
};

export function spotOccupied(spot) {
  return state.towers.some((t) => t.spot === spot);
}
