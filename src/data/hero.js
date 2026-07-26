// The five playable heroes — one is chosen on the world map (saved per slot).
// A hero is a single free unit you direct by clicking the battlefield; it
// respawns after a cooldown when it dies, and levels 1→10 by fighting.
//
// attack: "melee" heroes chase and block ground creeps like barracks
// soldiers. "ranged" heroes stand their ground and shoot the furthest-along
// enemy in range — INCLUDING flyers, which no melee unit can touch — and
// only fight hand-to-hand when a creep walks right into them.
//
// Balance: everyone gets a similar power budget, spent differently —
//              HP   DPS   speed  reach          respawn
//   knight     220  28.6  100    melee          18s   the all-rounder
//   juggernaut 350  31.6   70    melee          24s   walking wall, slow everywhere
//   ranger     130  28.9  115    ranged 160     14s   fragile, kites, hits flyers
//   dancer     150  35.7  150    melee          12s   highest dps, dies fast
//   mage       180  33.3   85    ranged 130     20s   armor-ignoring magic bolts
export const HEROES = {
  knight: {
    key: "knight", name: "Sir Aldric", icon: "🛡️",
    tagline: "Balanced sword-and-board champion",
    attack: "melee", maxHp: 220, damage: 20, attackInterval: 0.7,
    speed: 100, meleeRange: 22, aggroRadius: 140,
    respawnTime: 18, regenDelay: 5, regenRate: 12,
    weapon: "sword", figureScale: 1.35,
    helm: ["#ffe9a8", "#d9a222"], plume: "#c0392b", cape: "#a02c20",
    colors: { light: "#fff4c2", mid: "#e0a83a", dark: "#8a5c14" },
  },
  juggernaut: {
    key: "juggernaut", name: "Bruk", icon: "🔨",
    tagline: "A slow walking wall with a crushing hammer",
    attack: "melee", maxHp: 350, damage: 30, attackInterval: 0.95,
    speed: 70, meleeRange: 24, aggroRadius: 130,
    respawnTime: 24, regenDelay: 5, regenRate: 14,
    weapon: "hammer", figureScale: 1.55,
    helm: ["#c8ccd8", "#6a7080"], plume: null, cape: "#4a3220",
    colors: { light: "#e8c9a0", mid: "#a8763a", dark: "#5e3c14" },
  },
  ranger: {
    key: "ranger", name: "Whisper", icon: "🏹",
    tagline: "Fragile archer — strikes from afar, hits flyers",
    attack: "ranged", range: 160, projectileSpeed: 480, projColor: "#d8f08a",
    maxHp: 130, damage: 13, attackInterval: 0.45,
    speed: 115, meleeRange: 20, aggroRadius: 120,
    respawnTime: 14, regenDelay: 4, regenRate: 10,
    weapon: "bow", figureScale: 1.2,
    helm: ["#a8d878", "#3f6b22"], plume: null, cape: null,
    colors: { light: "#d9f0b8", mid: "#7fb84a", dark: "#3f6b22" },
  },
  dancer: {
    key: "dancer", name: "Zephyra", icon: "🗡️",
    tagline: "Blinding speed, a storm of dagger strikes",
    attack: "melee", maxHp: 150, damage: 15, attackInterval: 0.42,
    speed: 150, meleeRange: 20, aggroRadius: 150,
    respawnTime: 12, regenDelay: 4, regenRate: 14,
    weapon: "dagger", figureScale: 1.2,
    helm: ["#c8f0f0", "#1f6b6b"], plume: "#4ab8b8", cape: null,
    colors: { light: "#c8f0f0", mid: "#4ab8b8", dark: "#1f6b6b" },
  },
  mage: {
    key: "mage", name: "Magnus", icon: "🪄",
    tagline: "Arcane bolts that pierce any armor",
    attack: "ranged", range: 130, projectileSpeed: 420, projColor: "#d79bff", magic: true,
    maxHp: 180, damage: 30, attackInterval: 0.9,
    speed: 85, meleeRange: 20, aggroRadius: 120,
    respawnTime: 20, regenDelay: 5, regenRate: 11,
    weapon: "staff", figureScale: 1.3,
    helm: ["#c9a8f0", "#5f359c"], plume: null, cape: "#5f359c",
    colors: { light: "#e8d0ff", mid: "#a86be0", dark: "#5f359c" },
  },
};

export const DEFAULT_HERO = "knight";

// Hero levelling: every battle starts at level 1 and grows to `maxLevel` by
// fighting — XP equals damage dealt, plus the gold bounty of every creep the
// hero lands the killing blow on. A hero's base numbers ARE its level 1;
// each level re-derives the scaled stats below.
export const HERO_LEVELING = {
  maxLevel: 10,
  xpForNext: (level) => 150 + 130 * (level - 1),  // XP to go from `level` to the next
  maxHpAt:  (def, level) => Math.round(def.maxHp * (1 + 0.15 * (level - 1))),   // ×2.35 at 10
  damageAt: (def, level) => Math.round(def.damage * (1 + 0.12 * (level - 1))),  // ×2.08 at 10
  regenAt:  (def, level) => def.regenRate * (1 + 0.10 * (level - 1)),
};
