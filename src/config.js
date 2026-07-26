// Core tunables + small constants shared across modules.
export const CONFIG = {
  width: 900,
  height: 560,
  waveClearBonus: 30,
  // Between waves a countdown runs and the next wave launches on its own, so
  // a battle has its own momentum instead of waiting on a button. Sending the
  // wave early pays out the time you didn't use — the standard tower-defense
  // trade of breathing room against gold.
  firstWaveDelay: 30,     // seconds before wave 1 launches itself
  nextWaveDelay: 22,      // seconds of build time after a wave is cleared
  earlyCallGold: 2,       // gold per whole second saved by calling the wave in
  enemy: {
    meleeDamage: 14,      // damage an engaged creep deals to a soldier per hit
    attackInterval: 1.0,  // seconds between creep melee hits
  },
};

export const MAX_LEVEL = 3;
export const SELL_REFUND = 0.7; // fraction of total invested gold returned on sell
