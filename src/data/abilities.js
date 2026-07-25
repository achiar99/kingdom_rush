// Hero abilities: free, cooldown-gated actions triggered from the bottom-left
// ability bar (see ui.js). Both share the same 15s cooldown.
export const ABILITY_COOLDOWN = 15;

// "Reinforcements" — summons temporary soldiers that fight like a weaker,
// disposable Barracks squad, then simply vanish once their time is up
// (no death, no respawn — they're just gone).
export const SUMMON = {
  count: 2, lifespan: 7,
  hp: 50, damage: 10, attackInterval: 0.8,
  meleeRange: 20, aggroRadius: 90, speed: 90,
  colors: { light: "#d7f5e6", mid: "#5ad1a5", dark: "#2c7a5c" },
};

// "Ignite" — player picks a spot on the field; every enemy within `radius`
// of it catches fire: a damage-over-time burn that ignores armor (like
// Magic), independent of where the enemy wanders off to afterward.
export const FIRE = {
  dps: 9, duration: 4, radius: 100,
};
