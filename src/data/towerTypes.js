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
