// Per-slot difficulty: chosen once when a save slot is first created, and
// applied as multipliers on top of each level's own baseline numbers
// (LEVEL.startGold/startLives, wave.hpMul * LEVEL.hpScale).
export const DIFFICULTIES = {
  easy:   { key: "easy",   name: "Easy",   icon: "🟢", hpMul: 0.75, goldMul: 1.25, livesMul: 1.25 },
  normal: { key: "normal", name: "Normal", icon: "🟡", hpMul: 1.0,  goldMul: 1.0,  livesMul: 1.0 },
  hard:   { key: "hard",   name: "Hard",   icon: "🔴", hpMul: 1.35, goldMul: 0.85, livesMul: 0.8 },
};

export const DIFFICULTY_LIST = ["easy", "normal", "hard"];
