// Tower archetypes. Stats live here so the whole game is easy to rebalance.
//
// The internal keys (archer / artillery / magic / barracks) are deliberately
// unchanged: the star Upgrade Store, the unlock tables and every saved slot
// key off them, and none of that has any business knowing that "archer" now
// wears a chiton. Names, icons and palettes are the theme; keys are plumbing.
export const TOWER_TYPES = {
  archer: {
    key: "archer", name: "Toxotai", icon: "🏹", cost: 70,
    blurb: "Cretan bowmen. Cheap, quick, and they can hit what flies.",
    attack: "single", hitsAir: true, range: 130, damage: 14, fireRate: 1.9,
    projectileSpeed: 460, projColor: "#ffe27a",
    palette: { light: "#efe0bc", mid: "#c2a468", dark: "#7d6430" }, // timber and linen
  },
  artillery: {
    key: "artillery", name: "Ballista", icon: "🎯", cost: 100,
    blurb: "Siege engine off the walls of Ilion. Scatters a packed road — but its bolts cannot be aimed upward.",
    // Ground only. A ballista is a horizontal weapon bolted to a wall; it has
    // no answer to anything airborne, which is what makes flyers a real
    // threat rather than just another health bar.
    attack: "splash", hitsAir: false, range: 110, damage: 26, fireRate: 0.55,
    projectileSpeed: 300, splashRadius: 48, projColor: "#e8a057",
    palette: { light: "#d9b98a", mid: "#8d6234", dark: "#4e3316" }, // oiled oak, dark bronze
  },
  magic: {
    key: "magic", name: "Oracle", icon: "🔮", cost: 115,
    blurb: "A Pythia on her tripod. Her word goes straight through armour, and through air.",
    attack: "single", hitsAir: true, range: 140, damage: 42, fireRate: 1.05,
    projectileSpeed: 560, projColor: "#c8f0ff",
    palette: { light: "#f4f0e4", mid: "#b8c4c0", dark: "#6c7a78" }, // marble and sacred smoke
  },
  barracks: {
    key: "barracks", name: "Phalanx", icon: "🛡️", cost: 90,
    blurb: "Hoplites who hold the line. Nothing they can do about flyers.",
    attack: "none", range: 70,             // soldier leash radius around the CURRENT
                                            // rally point (combat engagement only)
    rallyReach: 150,                       // max distance the rally point may be
                                            // relocated from the tower's build spot —
                                            // fixed, not level-scaled like `range`
    soldierCount: 3, soldierHp: 55, soldierDamage: 9,
    soldierAttackInterval: 0.8, soldierSpeed: 85, soldierRespawn: 7,
    soldierRegenDelay: 5, soldierRegenRate: 3, // out-of-combat HP recovery
    meleeRange: 20,
    palette: { light: "#e0c07a", mid: "#a8762c", dark: "#5e400e" }, // bronze and crimson
  },
};

export const TYPE_LIST = ["archer", "artillery", "barracks", "magic"];

// ---------------------------------------------------------- specialisations
// A tower climbs ★→★★→★★★ on gold the way it always has. At ★★★ it stops
// taking generic upgrades and offers a one-time, irreversible choice between
// two specialisations — the point in the game where upgrading stops being
// "the number goes up" and starts being a decision about what this spot is
// FOR. Two of them deliberately shore up the base tower's weakness at the
// cost of its strength, so the choice reads differently on every map.
//
// Fields listed here REPLACE the tower's own; anything omitted is inherited
// from the ★★★ stats. The effects (`chain`, `slow`, `dot`, `airBonus`) are
// the four primitives simulation.js knows how to apply.
export const SPECS = {
  archer: {
    cretan: {
      key: "cretan", name: "Cretan Archers", icon: "🏹", cost: 240,
      blurb: "Massed volleys. Each shot carries on into two more targets.",
      damage: 26, fireRate: 2.3, chain: 3,
      palette: { light: "#f2e6c4", mid: "#bfa05e", dark: "#6f5824" },
    },
    amazon: {
      key: "amazon", name: "Amazon Longbows", icon: "🎯", cost: 260,
      blurb: "Enormous reach, and they punish anything that dares to fly.",
      damage: 40, fireRate: 1.5, range: 205, airBonus: 2.0,
      palette: { light: "#e6dcc0", mid: "#9fae72", dark: "#4f5c2c" },
    },
  },
  artillery: {
    siege: {
      key: "siege", name: "Siege Ballista", icon: "💥", cost: 300,
      blurb: "A wider, heavier blast. Still cannot be aimed at the sky.",
      damage: 62, fireRate: 0.6, splashRadius: 78,
      palette: { light: "#dcb489", mid: "#8a5a2c", dark: "#472a0e" },
    },
    scorpion: {
      key: "scorpion", name: "Scorpion Battery", icon: "🦂", cost: 320,
      blurb: "Swivel-mounted and crippling — it finally reaches flyers, and " +
             "what it hits crawls.",
      damage: 34, fireRate: 0.95, splashRadius: 44, hitsAir: true,
      slow: { mul: 0.5, dur: 2.2 },
      palette: { light: "#cfd8c0", mid: "#75845e", dark: "#3a442a" },
    },
  },
  magic: {
    delphi: {
      key: "delphi", name: "Seers of Delphi", icon: "⚡", cost: 340,
      blurb: "The prophecy arcs from one doomed creature to the next.",
      damage: 62, fireRate: 1.2, chain: 4,
      palette: { light: "#f6f2e8", mid: "#a8bcc8", dark: "#546672" },
    },
    hekate: {
      key: "hekate", name: "Shrine of Hekate", icon: "☠️", cost: 360,
      blurb: "A slow curse that keeps burning long after the bolt lands.",
      damage: 78, fireRate: 0.85, dot: { dps: 26, dur: 4 },
      palette: { light: "#e8dcf4", mid: "#9a7ab8", dark: "#4c3663" },
    },
  },
  barracks: {
    spartiate: {
      key: "spartiate", name: "Spartiates", icon: "🛡️", cost: 280,
      blurb: "Three men who simply do not break. Nothing gets past them.",
      soldierHp: 190, soldierDamage: 22, soldierCount: 3,
      soldierRegenRate: 9, soldierRespawn: 5,
      palette: { light: "#e8cf8e", mid: "#a8762c", dark: "#5e400e" },
    },
    myrmidon: {
      key: "myrmidon", name: "Myrmidons", icon: "⚔️", cost: 300,
      blurb: "Four of them, and they go looking for the fight.",
      soldierHp: 115, soldierDamage: 34, soldierCount: 4,
      soldierAttackInterval: 0.6, soldierRespawn: 4, range: 105,
      palette: { light: "#d8c0e0", mid: "#7a5a96", dark: "#3c2a52" },
    },
  },
};

export const specsFor = (typeKey) => Object.values(SPECS[typeKey] || {});
export const specDef = (typeKey, specKey) => (SPECS[typeKey] || {})[specKey] || null;
