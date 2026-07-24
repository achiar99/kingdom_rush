// Tower archetypes. Stats live here so the whole game is easy to rebalance.
export const TOWER_TYPES = {
  archer: {
    key: "archer", name: "Archer", icon: "🏹", cost: 70,
    attack: "single", range: 130, damage: 14, fireRate: 1.9,
    projectileSpeed: 460, projColor: "#ffe27a",
    palette: { light: "#dff5c8", mid: "#8bbf5a", dark: "#4c7a2e" },
  },
  artillery: {
    key: "artillery", name: "Artillery", icon: "💣", cost: 100,
    attack: "splash", range: 110, damage: 26, fireRate: 0.55,
    projectileSpeed: 300, splashRadius: 48, projColor: "#ffb057",
    palette: { light: "#f6d7a2", mid: "#c98a3c", dark: "#7d4d18" },
  },
  magic: {
    key: "magic", name: "Magic", icon: "🔮", cost: 115,
    attack: "single", range: 140, damage: 42, fireRate: 1.05,
    projectileSpeed: 560, projColor: "#d79bff",
    palette: { light: "#f0dcff", mid: "#a86be0", dark: "#5f359c" },
  },
  barracks: {
    key: "barracks", name: "Barracks", icon: "⚔️", cost: 90,
    attack: "none", range: 70,             // soldier leash radius around the CURRENT
                                            // rally point (combat engagement only)
    rallyReach: 150,                       // max distance the rally point may be
                                            // relocated from the tower's build spot —
                                            // fixed, not level-scaled like `range`
    soldierCount: 3, soldierHp: 55, soldierDamage: 9,
    soldierAttackInterval: 0.8, soldierSpeed: 85, soldierRespawn: 7,
    meleeRange: 20,
    palette: { light: "#cfd6e6", mid: "#7a8296", dark: "#464d5e" },
  },
};

export const TYPE_LIST = ["archer", "artillery", "barracks", "magic"];
