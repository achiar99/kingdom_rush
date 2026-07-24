// The Hero: a single free, always-available melee unit you direct by
// clicking anywhere on the battlefield that isn't a build spot. It auto-
// engages the nearest ground enemy within its aggro radius (like Barracks
// soldiers, it can't reach flyers), blocking whoever it fights, then walks
// back toward wherever it was last commanded once the fight is over. If it
// dies it respawns — at no gold cost, but after a real cooldown.
export const HERO = {
  name: "Hero", icon: "🦸",
  maxHp: 220, damage: 20, attackInterval: 0.7,
  speed: 100, meleeRange: 22, aggroRadius: 140,
  respawnTime: 18,
  regenDelay: 5,     // seconds out of combat before HP starts recovering
  regenRate: 12,     // HP per second once regen is active
  colors: { light: "#fff4c2", mid: "#e0a83a", dark: "#8a5c14" },
};
