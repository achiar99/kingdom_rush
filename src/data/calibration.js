// Per-level difficulty calibration, MEASURED, not designed.
//
// hpScale reaching the game is band(stage) × norm(map exposure) × this.
// The band is the designer's dial; the norm removes what the map's measured
// coverage predicts; this factor is the residual each map's character costs
// or affords — chokepoint quality, fork attention-splitting, coil range
// stacking — solved by tools/sim/calibrate.js playing every level until its
// average-skill win rate lands on the campaign curve.
//
// A factor pinned at the early-level 1.35 clamp means the level's win rate
// barely responds to hpScale there (the gold-rich opening slots — see the
// insensitivity caveat in stages.js); 0.55-0.8 marks the maps whose shape
// genuinely bites (the double diamond, the tridents, the deep-stage forks);
// 1.5-2.1 marks the fortress maps — long coils and shore roads whose spots
// see so much road they carry far more HP than their slot suggests.
//
// Regenerate with `node tools/sim/calibrate.js` whenever a layout, kit or
// wave table changes enough to matter, and paste the block it prints.
export const CALIBRATION = [
  1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 0.99, 1.20, 1.09,  // I
  0.75, 0.76, 1.00, 1.35, 1.16, 0.96, 1.15, 1.01, 1.27, 0.55,  // II
  1.35, 1.24, 1.01, 1.22, 0.95, 1.04, 2.09, 1.12, 1.19, 0.96,  // III
  1.77, 1.03, 1.01, 1.14, 0.87, 0.64, 0.68, 1.01, 0.58, 0.91,  // IV
  0.73, 1.49, 0.99, 1.35, 1.77, 0.86, 1.04, 1.08, 1.58, 1.25,  // V
];
