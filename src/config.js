// Core tunables + small constants shared across modules.
export const CONFIG = {
  width: 900,
  // The WORLD is 900x560 and every path, build spot and creep position lives in
  // that space. Do not change these to make room for scenery.
  height: 560,
  // A strip of sky ABOVE the world, added to the canvas rather than carved out
  // of it. Carving it out was the first attempt and it was plainly wrong: all
  // fifty maps are generated across the full 560, with paths reaching y=10, so
  // a horizon at y=168 put the road through the sea and the mountains. The
  // world keeps its coordinates; the canvas simply gets taller, and rendering
  // is translated down by this much.
  skyHeight: 96,
  waveClearBonus: 30,
  // The clock to the next wave starts when a wave STARTS, not when it dies, so
  // waves overlap: the countdown is visible for the whole battle and wave N+1
  // can march in while N is still on the road. Sending it early pays out the
  // time you didn't use — the standard trade of breathing room against gold.
  //
  // This is measured from the end of the current wave's own spawn, not from
  // its start, so a long wave isn't buried by the next one.
  //
  // 55s, re-solved after the waves themselves were stretched (see SHAPE in
  // data/waves.js). With the original nine-second waves this delay had to be
  // 105s or pressure compounded level-wide; with waves that spawn for ~16-24s
  // the measured difficulty curve is nearly FLAT from 55s to 105s — the wave's
  // own duration is doing the pacing — so the shortest fitting value wins and
  // the dead air between fights goes with it. The failure mode this guards is
  // compounding: a gap shorter than a wave takes to resolve puts the player
  // permanently behind, which shows up as "the last wave causes 90% of all
  // losses" on level after level. 40s starts to show it; 55s does not.
  //
  // Do NOT read this as "build time between waves" and shrink it back toward
  // its old value of 22 — that number was measured from a CLEARED board. Under
  // overlap it stacked six or seven waves at once, 117 creeps on screen, and
  // put every level under a 20% win rate.
  //
  // Wave 1 is the exception: no clock, no auto-start. The opening of a level
  // is the one moment the player needs unhurried — reading an unfamiliar map,
  // seeing which towers are unlocked, choosing the first spot — so the battle
  // doesn't begin until they say so. Every wave after that is on the timer.
  nextWaveDelay: 55,      // seconds from a wave finishing spawning to the next one
  earlyCallGold: 2,       // gold per whole second saved by calling the wave in
  // ...but only for this many seconds of it. The countdown got about five
  // times longer when waves started overlapping, and the payout rode straight
  // along with it: calling one wave in early paid 756 gold with the Salvage
  // track maxed, against 360 for the priciest tower in the game. Capping the
  // paid window keeps the maximum where it was tuned, and has the useful side
  // effect of removing any reward for calling a wave in absurdly early — past
  // this point you take on the risk of a pile-up for nothing extra.
  earlyCallMaxSeconds: 22,
  enemy: {
    meleeDamage: 14,      // damage an engaged creep deals to a soldier per hit
    attackInterval: 1.0,  // seconds between creep melee hits
  },
};

export const MAX_LEVEL = 3;
export const SELL_REFUND = 0.7; // fraction of total invested gold returned on sell
