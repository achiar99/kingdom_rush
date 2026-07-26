// The star Upgrade Store: permanent, per-save-slot upgrade tracks bought with
// the stars earned by beating levels. Ranks live in `progress.upgrades`
// ({ trackKey: rank }), persist with the save slot, and apply globally —
// combat code multiplies its stats through the helpers at the bottom.
//
// Sizing note: a fifty-level campaign pays out 150 stars. Twelve tracks at
// five ranks costs 180, so one save can buy about five-sixths of the board —
// everything is reachable, but not all at once. (The six-track, three-rank
// version this replaced cost 36 in total, so it finished itself after twelve
// good runs and left 114 stars with nothing to spend on.)
//
// Imports `progress` from save.js at call time only (safe circularity — see
// simulation.js for why that's fine in this codebase).
import { progress } from "../save.js";
import { UNLOCK_ALL } from "../devFlags.js";

export const MAX_RANK = 5;
export const RANK_COSTS = [1, 2, 3, 4, 5]; // 15 stars to max a single track

// The first four keys deliberately match TOWER_TYPES keys, so tower stat code
// can look ranks up by tower type directly. The rest are campaign-wide, and
// cover the things that had no upgrade path at all before.
export const TRACKS = [
  { key: "archer",    icon: "🏹", name: "Cretan Doctrine", per: "+12% Toxotai damage",
    colors: ["#efe0bc", "#7d6430"] },
  { key: "artillery", icon: "🎯", name: "Siegecraft",      per: "+12% Ballista damage · +8% blast radius",
    colors: ["#d9b98a", "#4e3316"] },
  { key: "magic",     icon: "🔮", name: "Delphic Insight", per: "+12% Oracle damage",
    colors: ["#f4f0e4", "#6c7a78"] },
  { key: "barracks",  icon: "🛡️", name: "Agoge Training",  per: "+15% hoplite HP · +12% hoplite damage",
    colors: ["#e0c07a", "#5e400e"] },
  { key: "summon",    icon: "🪖", name: "Reserve Levy",    per: "+1 reinforcement · +20% their HP",
    colors: ["#9ff0c8", "#2c7a5c"] },
  { key: "fire",      icon: "🔥", name: "Promethean Fire", per: "+25% burn damage · +0.5s burn",
    colors: ["#ffb073", "#a02c10"] },
  { key: "hero",      icon: "⚔️", name: "Heroic Legend",   per: "+10% champion HP and damage",
    colors: ["#ffe9a8", "#8a5c14"] },
  { key: "treasury",  icon: "💰", name: "War Treasury",    per: "+8% starting gold",
    colors: ["#ffd98a", "#8a6a10"] },
  { key: "walls",     icon: "🏛️", name: "City Walls",      per: "+1 starting life",
    colors: ["#e8e0cc", "#6a6050"] },
  { key: "range",     icon: "👁️", name: "Watchtowers",     per: "+5% range on every tower",
    colors: ["#cfe4f2", "#3a5f78"] },
  { key: "haste",     icon: "⏱️", name: "Drilled Crews",   per: "+6% fire rate on every tower",
    colors: ["#d8f0c8", "#436b2a"] },
  { key: "salvage",   icon: "♻️", name: "Salvage Rights",  per: "+5% sell refund · +1 gold/sec for calling waves early",
    colors: ["#c8d0e8", "#3c4870"] },
];

// With UNLOCK_ALL every track reads as maxed. Deliberately a read-time
// override rather than a write into progress.upgrades — switching the flag
// off has to leave the save untouched.
export const rankOf = (key) =>
  UNLOCK_ALL ? MAX_RANK : ((progress.upgrades && progress.upgrades[key]) || 0);

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

// ---- per-tower tracks (all no-ops at rank 0) ----
export const towerDamageMul = (typeKey) => 1 + 0.12 * rankOf(typeKey);
export const splashRadiusMul = () => 1 + 0.08 * rankOf("artillery");
export const soldierHpMul = () => 1 + 0.15 * rankOf("barracks");
export const soldierDamageMul = () => 1 + 0.12 * rankOf("barracks");
export const summonCountBonus = () => rankOf("summon");
export const summonHpMul = () => 1 + 0.2 * rankOf("summon");
export const fireDpsMul = () => 1 + 0.25 * rankOf("fire");
export const fireDurationBonus = () => 0.5 * rankOf("fire");

// ---- campaign-wide tracks ----
export const heroPowerMul = () => 1 + 0.10 * rankOf("hero");
export const startGoldMul = () => 1 + 0.08 * rankOf("treasury");
export const startLivesBonus = () => rankOf("walls");
export const towerRangeMul = () => 1 + 0.05 * rankOf("range");
export const towerFireRateMul = () => 1 + 0.06 * rankOf("haste");
export const sellRefundBonus = () => 0.05 * rankOf("salvage");
export const earlyCallGoldBonus = () => rankOf("salvage");
