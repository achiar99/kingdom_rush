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
// (Last regenerated for the current pacing: spawns tightened ×0.75 and the
// between-wave clock cut from 55s to 35s, so waves press in on each other —
// the factors dropped across the board to keep win rates on the curve.)
export const CALIBRATION = [
  1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 0.85, 0.94, 0.92,  // I
  0.70, 0.79, 0.97, 1.32, 0.99, 0.83, 0.99, 0.95, 1.17, 0.55,  // II
  1.57, 1.02, 0.99, 1.15, 0.92, 1.00, 1.79, 0.99, 1.06, 0.86,  // III
  1.75, 0.94, 0.98, 0.97, 0.80, 0.59, 0.65, 0.83, 0.47, 0.76,  // IV
  0.70, 1.28, 0.91, 1.23, 1.48, 0.71, 0.95, 0.87, 1.36, 1.15,  // V
];
