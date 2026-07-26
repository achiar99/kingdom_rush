// The star Upgrade Store: permanent, per-save-slot upgrade tracks bought with
// the stars earned by beating levels. Ranks live in `progress.upgrades`
// ({ trackKey: rank }), persist with the save slot, and apply globally —
// combat code multiplies its stats through the helpers at the bottom.
//
// Imports `progress` from save.js at call time only (safe circularity — see
// simulation.js for why that's fine in this codebase).
import { progress } from "../save.js";

export const MAX_RANK = 3;
export const RANK_COSTS = [1, 2, 3]; // stars for rank 1, 2, 3 — 6 to max a track

// The first four keys deliberately match TOWER_TYPES keys, so tower stat code
// can look ranks up by tower type directly.
export const TRACKS = [
  { key: "archer",    icon: "🏹", name: "Archer Doctrine",   per: "+12% Archer damage" },
  { key: "artillery", icon: "💣", name: "Bigger Bombs",      per: "+12% damage · +8% blast radius" },
  { key: "magic",     icon: "🔮", name: "Arcane Focus",      per: "+12% Magic damage" },
  { key: "barracks",  icon: "⚔️", name: "Veteran Training",  per: "+15% soldier HP · +12% soldier damage" },
  { key: "summon",    icon: "🪖", name: "Reserve Battalion", per: "+1 reinforcement · +20% their HP" },
  { key: "fire",      icon: "🔥", name: "Hotter Flames",     per: "+25% burn damage · +0.5s burn" },
];

export const rankOf = (key) => (progress.upgrades && progress.upgrades[key]) || 0;

const costOfRanks = (rank) => {
  let sum = 0;
  for (let i = 0; i < rank; i++) sum += RANK_COSTS[i];
  return sum;
};

export const starsEarned = () =>
  Object.values(progress.stars || {}).reduce((a, b) => a + b, 0);
export const starsSpent = () =>
  Object.values(progress.upgrades || {}).reduce((a, r) => a + costOfRanks(r), 0);
export const starsAvailable = () => starsEarned() - starsSpent();

// ---- combat effect helpers (all no-ops at rank 0) ----
export const towerDamageMul = (typeKey) => 1 + 0.12 * rankOf(typeKey);
export const splashRadiusMul = () => 1 + 0.08 * rankOf("artillery");
export const soldierHpMul = () => 1 + 0.15 * rankOf("barracks");
export const soldierDamageMul = () => 1 + 0.12 * rankOf("barracks");
export const summonCountBonus = () => rankOf("summon");
export const summonHpMul = () => 1 + 0.2 * rankOf("summon");
export const fireDpsMul = () => 1 + 0.25 * rankOf("fire");
export const fireDurationBonus = () => 0.5 * rankOf("fire");
