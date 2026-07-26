// The five champions — one is chosen on the world map (saved per slot).
// A hero is a single free unit you direct by clicking the battlefield; it
// respawns after a cooldown when it dies, and levels 1→10 by fighting.
//
// attack: "melee" heroes chase and block ground creeps like phalanx hoplites.
// "ranged" heroes stand their ground and shoot the furthest-along enemy in
// range — INCLUDING flyers, which no melee unit can touch — and only fight
// hand-to-hand when something walks right into them.
//
// A ranged hero's reach stays BELOW the cheapest attacking tower (Toxotai,
// 130). A hero is free, mobile, and comes back when it dies; a tower is paid
// for, rooted to one spot forever, and reach is the whole thing it buys. When
// Atalanta out-ranged the 115-gold Oracle there was no reason to build one.
//
// Balance: everyone gets a similar power budget, spent differently —
//              HP   DPS   speed  reach          respawn
//   achilles   220  28.6  100    melee          18s   the all-rounder
//   ajax       350  31.6   70    melee          24s   a wall with a spear, slow
//   atalanta   130  28.9  115    ranged 112     14s   fragile, kites, hits flyers
//   perseus    150  35.7  150    melee          12s   highest dps, dies fast
//   circe      180  33.3   85    ranged  96     20s   armour-ignoring sorcery
export const HEROES = {
  achilles: {
    key: "achilles", name: "Achilles", icon: "⚔️",
    tagline: "Best of the Achaeans — sword, shield, and no patience",
    attack: "melee", maxHp: 220, damage: 20, attackInterval: 0.7,
    speed: 100, meleeRange: 22, aggroRadius: 140,
    respawnTime: 18, regenDelay: 5, regenRate: 12,
    weapon: "sword", figureScale: 1.35,
    helm: ["#ffe9a8", "#d9a222"], plume: "#c0392b", cape: "#a02c20",
    colors: { light: "#fff4c2", mid: "#e0a83a", dark: "#8a5c14" },
  },
  ajax: {
    key: "ajax", name: "Ajax the Great", icon: "🛡️",
    tagline: "The tower-shield. Slow, immovable, unbothered",
    attack: "melee", maxHp: 350, damage: 30, attackInterval: 0.95,
    speed: 70, meleeRange: 24, aggroRadius: 130,
    respawnTime: 24, regenDelay: 5, regenRate: 14,
    weapon: "hammer", figureScale: 1.55,
    helm: ["#d8cfa8", "#7a6a40"], plume: null, cape: "#4a3220",
    colors: { light: "#e8d8a8", mid: "#a8863a", dark: "#5e4414" },
  },
  atalanta: {
    key: "atalanta", name: "Atalanta", icon: "🏹",
    tagline: "Raised by a bear, faster than her suitors, hits flyers",
    attack: "ranged", range: 112, projectileSpeed: 480, projColor: "#d8f08a",
    maxHp: 130, damage: 13, attackInterval: 0.45,
    speed: 115, meleeRange: 20, aggroRadius: 120,
    respawnTime: 14, regenDelay: 4, regenRate: 10,
    weapon: "bow", figureScale: 1.2,
    helm: ["#a8d878", "#3f6b22"], plume: null, cape: null,
    colors: { light: "#d9f0b8", mid: "#7fb84a", dark: "#3f6b22" },
  },
  perseus: {
    key: "perseus", name: "Perseus", icon: "🗡️",
    tagline: "Winged sandals and a very sharp harpe",
    attack: "melee", maxHp: 150, damage: 15, attackInterval: 0.42,
    speed: 150, meleeRange: 20, aggroRadius: 150,
    respawnTime: 12, regenDelay: 4, regenRate: 14,
    weapon: "dagger", figureScale: 1.2,
    helm: ["#dff0f0", "#4a7f86"], plume: "#7fd8d8", cape: "#2f6f78",
    colors: { light: "#d8f4f4", mid: "#5ec8c8", dark: "#256f74" },
  },
  circe: {
    key: "circe", name: "Circe", icon: "🪄",
    tagline: "Sorceress of Aiaia — her curses do not care about bronze",
    attack: "ranged", range: 96, projectileSpeed: 420, projColor: "#e0a8ff", magic: true,
    maxHp: 180, damage: 30, attackInterval: 0.9,
    speed: 85, meleeRange: 20, aggroRadius: 120,
    respawnTime: 20, regenDelay: 5, regenRate: 11,
    weapon: "staff", figureScale: 1.3,
    helm: ["#e8c8a0", "#8a5a2c"], plume: null, cape: "#6a2f7a",
    colors: { light: "#f0d8b0", mid: "#c08a48", dark: "#6e4a18" },
  },
};

export const DEFAULT_HERO = "achilles";

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
