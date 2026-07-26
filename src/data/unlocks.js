// Gradual campaign unlocks — the first levels introduce build options and
// hero abilities a few at a time instead of offering the full arsenal on
// wave 1 of level 1.
//
// UNLOCKS[levelIndex] describes that level:
//   towers:        { typeKey: waveNumber } — buildable once the player is
//                  PREPARING that wave (so `barracks: 2` appears the moment
//                  wave 1 is cleared). A type missing from the map is locked
//                  for the whole level.
//   maxTowerLevel: upgrade cap while playing that level.
//   abilities:     { soldiers?: waveNumber, fire?: waveNumber } — same wave
//                  rule; missing = locked for the whole level.
// Levels past the end of the array allow everything — the full arsenal has
// been earned by then.
import { MAX_LEVEL } from "../config.js";
import { UNLOCK_ALL } from "../devFlags.js";
import { TOWER_TYPES } from "./towerTypes.js";

// The first five levels of Stage I are the tutorial arc: one new thing each.
// Everything from level 6 of Stage I onward is the full arsenal — by then the
// player has met every tower, both abilities, and all three upgrade tiers,
// and the remaining forty-five levels are about using them well.
const UNLOCKS = [
  { // I·1 The Landing Beaches — just bowmen, and no upgrades to think about
    towers: { archer: 1, barracks: 2 },
    maxTowerLevel: 1,
    abilities: {},
  },
  { // I·2 Scamander Ford — the phalanx from the start; reinforcements appear
    towers: { archer: 1, barracks: 1 },
    maxTowerLevel: 2,
    abilities: { soldiers: 3 },
  },
  { // I·3 The Greek Camp — the ballista arrives
    towers: { archer: 1, barracks: 1, artillery: 2 },
    maxTowerLevel: 2,
    abilities: { soldiers: 1 },
  },
  { // I·4 Chryse Road — Ignite joins the ability bar
    towers: { archer: 1, barracks: 1, artillery: 1 },
    maxTowerLevel: 2,
    abilities: { soldiers: 1, fire: 2 },
  },
  { // I·5 Tenedos Strait — the Oracle, and the third upgrade tier
    towers: { archer: 1, barracks: 1, artillery: 1, magic: 1 },
    maxTowerLevel: MAX_LEVEL,
    abilities: { soldiers: 1, fire: 1 },
  },
];

const EVERYTHING = {
  towers: { archer: 1, artillery: 1, barracks: 1, magic: 1 },
  maxTowerLevel: MAX_LEVEL,
  abilities: { soldiers: 1, fire: 1 },
};

export const unlocksFor = (levelIndex) =>
  UNLOCK_ALL ? EVERYTHING : (UNLOCKS[levelIndex] || EVERYTHING);

// The wave the player is currently preparing (between waves) or fighting —
// the 1-based yardstick every unlock is measured against.
export const currentWave = (state) => state.waveIndex + (state.running ? 1 : 2);

// null = never in this level; otherwise the 1-based wave where it appears.
export const towerUnlockWave = (levelIndex, key) => unlocksFor(levelIndex).towers[key] ?? null;
export const abilityUnlockWave = (levelIndex, key) => unlocksFor(levelIndex).abilities[key] ?? null;

export const maxTowerLevelFor = (levelIndex) =>
  Math.min(MAX_LEVEL, unlocksFor(levelIndex).maxTowerLevel);

// Names of everything that becomes available exactly at `wave` — for the
// "🔓 Unlocked!" notice after a wave clears.
export function newUnlocksAt(levelIndex, wave) {
  const u = unlocksFor(levelIndex);
  const out = [];
  for (const [key, w] of Object.entries(u.towers))
    if (w === wave) out.push(TOWER_TYPES[key].name);
  if (u.abilities.soldiers === wave) out.push("Reinforcements");
  if (u.abilities.fire === wave) out.push("Ignite");
  return out;
}
