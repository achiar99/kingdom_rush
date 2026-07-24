// Core tunables + small constants shared across modules.
export const CONFIG = {
  width: 900,
  height: 560,
  waveClearBonus: 30,
  enemy: {
    meleeDamage: 14,      // damage an engaged creep deals to a soldier per hit
    attackInterval: 1.0,  // seconds between creep melee hits
  },
};

export const MAX_LEVEL = 3;
export const SELL_REFUND = 0.7; // fraction of total invested gold returned on sell
