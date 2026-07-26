// Visual themes for the ground + road, selected per level.
export const THEMES = {
  greenwood: { grass: ["#3d724a", "#274d33"], checker: "rgba(255,255,255,0.02)",
    path: { rim: "#7a5a34", body: "#b08a52", track: "#d8b578" } },
  frostpeak: { grass: ["#7fa8c9", "#4d739a"], checker: "rgba(255,255,255,0.05)",
    path: { rim: "#8a9bb0", body: "#c3d2e2", track: "#eaf2fb" } },
  emberfall: { grass: ["#3a2320", "#160d0b"], checker: "rgba(255,120,60,0.04)",
    path: { rim: "#5a2313", body: "#8f3a1e", track: "#c9642f" } },
  mirefen: { grass: ["#3b5e50", "#22392f"], checker: "rgba(180,255,200,0.03)",
    path: { rim: "#4a3b28", body: "#6e5a3c", track: "#8f7a52" } },
  dunes: { grass: ["#d4a95c", "#a87d3c"], checker: "rgba(120,70,20,0.05)",
    path: { rim: "#8c4a26", body: "#b56a35", track: "#e09a58" } },
  obsidian: { grass: ["#2e2440", "#171126"], checker: "rgba(160,120,255,0.05)",
    path: { rim: "#3f3357", body: "#5c4a80", track: "#8a74b8" } },
  amberwood: { grass: ["#a8622e", "#6e3d1e"], checker: "rgba(255,200,80,0.04)",
    path: { rim: "#4e3320", body: "#7a5638", track: "#a5825a" } },
  tidewater: { grass: ["#49a4a0", "#2e6f6d"], checker: "rgba(255,255,255,0.04)",
    path: { rim: "#8a6a3a", body: "#c9a566", track: "#e8cf96" } },
  stormcrag: { grass: ["#5a6474", "#333a47"], checker: "rgba(255,255,255,0.03)",
    path: { rim: "#3a4150", body: "#606a7d", track: "#8d99ae" } },
};

// Levels: each has its own map geometry, theme, economy and difficulty.
// `hpScale` multiplies every creep's HP; `node` is the map-screen position (%).
export const LEVELS = [
  {
    id: "greenwood", name: "Greenwood Vale", difficulty: "Easy",
    theme: "greenwood", startGold: 220, startLives: 20, hpScale: 1.0,
    node: { x: 17, y: 74 },
    path: [
      { x: -30, y: 120 }, { x: 220, y: 120 }, { x: 220, y: 340 },
      { x: 460, y: 340 }, { x: 460, y: 120 }, { x: 700, y: 120 },
      { x: 700, y: 440 }, { x: 930, y: 440 },
    ],
    spots: [
      { x: 120, y: 220 }, { x: 320, y: 250 }, { x: 320, y: 430 },
      { x: 560, y: 250 }, { x: 560, y: 430 }, { x: 620, y: 60 },
      { x: 800, y: 250 }, { x: 800, y: 530 }, { x: 130, y: 40 },
    ],
  },
  {
    id: "frostpeak", name: "Frostpeak Pass", difficulty: "Normal",
    theme: "frostpeak", startGold: 210, startLives: 20, hpScale: 1.35,
    node: { x: 50, y: 44 },
    path: [
      { x: -30, y: 460 }, { x: 180, y: 460 }, { x: 180, y: 140 },
      { x: 380, y: 140 }, { x: 380, y: 420 }, { x: 560, y: 420 },
      { x: 560, y: 140 }, { x: 760, y: 140 }, { x: 760, y: 460 }, { x: 930, y: 460 },
    ],
    spots: [
      { x: 90, y: 250 }, { x: 280, y: 250 }, { x: 280, y: 500 },
      { x: 470, y: 280 }, { x: 470, y: 90 }, { x: 660, y: 250 },
      { x: 660, y: 500 }, { x: 850, y: 280 }, { x: 300, y: 90 },
    ],
  },
  {
    id: "emberfall", name: "Emberfall Keep", difficulty: "Hard",
    theme: "emberfall", startGold: 250, startLives: 18, hpScale: 1.8,
    node: { x: 82, y: 24 },
    path: [
      { x: -30, y: 70 }, { x: 830, y: 70 }, { x: 830, y: 190 },
      { x: 70, y: 190 }, { x: 70, y: 310 }, { x: 830, y: 310 },
      { x: 830, y: 430 }, { x: 70, y: 430 }, { x: 70, y: 540 }, { x: 930, y: 540 },
    ],
    spots: [
      { x: 200, y: 130 }, { x: 430, y: 130 }, { x: 660, y: 130 },
      { x: 200, y: 250 }, { x: 430, y: 250 }, { x: 660, y: 250 },
      { x: 430, y: 370 }, { x: 200, y: 485 }, { x: 660, y: 485 },
    ],
  },
  {
    id: "mirefen", name: "Mirefen Marsh", difficulty: "Very Hard",
    theme: "mirefen", startGold: 260, startLives: 18, hpScale: 2.2,
    node: { x: 85, y: 56 },
    path: [
      { x: -30, y: 280 }, { x: 300, y: 280 }, { x: 300, y: 90 },
      { x: 640, y: 90 }, { x: 640, y: 300 }, { x: 160, y: 300 },
      { x: 160, y: 470 }, { x: 930, y: 470 },
    ],
    spots: [
      { x: 170, y: 190 }, { x: 400, y: 190 }, { x: 740, y: 180 },
      { x: 60, y: 210 }, { x: 260, y: 390 }, { x: 500, y: 390 },
      { x: 750, y: 380 }, { x: 60, y: 470 }, { x: 400, y: 530 },
    ],
  },
  {
    id: "dunes", name: "Scorched Dunes", difficulty: "Expert",
    theme: "dunes", startGold: 270, startLives: 16, hpScale: 2.7,
    node: { x: 60, y: 74 },
    path: [
      { x: -30, y: 520 }, { x: 250, y: 520 }, { x: 250, y: 200 },
      { x: 80, y: 200 }, { x: 80, y: 60 }, { x: 500, y: 60 },
      { x: 500, y: 350 }, { x: 700, y: 350 }, { x: 700, y: 150 }, { x: 930, y: 150 },
    ],
    spots: [
      { x: 160, y: 400 }, { x: 350, y: 380 }, { x: 180, y: 120 },
      { x: 390, y: 180 }, { x: 600, y: 220 }, { x: 600, y: 460 },
      { x: 810, y: 260 }, { x: 60, y: 450 }, { x: 820, y: 60 },
    ],
  },
  {
    id: "obsidian", name: "Obsidian Spire", difficulty: "Brutal",
    theme: "obsidian", startGold: 290, startLives: 15, hpScale: 3.3,
    node: { x: 33, y: 84 },
    path: [
      { x: -30, y: 60 }, { x: 450, y: 60 }, { x: 450, y: 200 },
      { x: 130, y: 200 }, { x: 130, y: 340 }, { x: 450, y: 340 },
      { x: 450, y: 480 }, { x: 700, y: 480 }, { x: 700, y: 100 }, { x: 930, y: 100 },
    ],
    spots: [
      { x: 290, y: 130 }, { x: 290, y: 270 }, { x: 290, y: 410 },
      { x: 60, y: 270 }, { x: 560, y: 140 }, { x: 560, y: 410 },
      { x: 820, y: 200 }, { x: 580, y: 535 }, { x: 60, y: 130 },
    ],
  },
  {
    id: "amberwood", name: "Amberwood", difficulty: "Nightmare",
    theme: "amberwood", startGold: 300, startLives: 15, hpScale: 4.0,
    node: { x: 6, y: 88 },
    path: [
      { x: 140, y: -30 }, { x: 140, y: 160 }, { x: 420, y: 160 },
      { x: 420, y: 40 }, { x: 760, y: 40 }, { x: 760, y: 240 },
      { x: 240, y: 240 }, { x: 240, y: 420 }, { x: 700, y: 420 }, { x: 700, y: 590 },
    ],
    spots: [
      { x: 60, y: 90 }, { x: 280, y: 80 }, { x: 560, y: 140 },
      { x: 860, y: 140 }, { x: 330, y: 330 }, { x: 560, y: 330 },
      { x: 820, y: 330 }, { x: 580, y: 510 }, { x: 150, y: 480 },
    ],
    waves: [
      { hpMul: 1.0, speedMul: 1.05, groups: [
        { type: "grunt", count: 10, gap: 0.6 }, { type: "runner", count: 6, gap: 0.35 } ] },
      { hpMul: 1.1, speedMul: 1.05, groups: [
        { type: "flyer", count: 8, gap: 0.5 } ] },
      { hpMul: 1.2, speedMul: 1.1, groups: [
        { type: "armored", count: 8, gap: 0.55 }, { type: "runner", count: 8, gap: 0.3 } ] },
      { hpMul: 1.3, speedMul: 1.1, groups: [
        { type: "tank", count: 4, gap: 1.1 }, { type: "flyer", count: 6, gap: 0.45 } ] },
      { hpMul: 1.45, speedMul: 1.1, groups: [
        { type: "runner", count: 14, gap: 0.25 }, { type: "grunt", count: 10, gap: 0.4 } ] },
      { hpMul: 1.55, speedMul: 1.15, groups: [
        { type: "armored", count: 8, gap: 0.5 }, { type: "flyer", count: 8, gap: 0.4 } ] },
      { hpMul: 1.65, speedMul: 1.15, groups: [
        { type: "tank", count: 5, gap: 1.0 }, { type: "armored", count: 6, gap: 0.5 } ] },
      { hpMul: 1.75, speedMul: 1.2, groups: [
        { type: "boss", count: 1, gap: 0.6 }, { type: "flyer", count: 8, gap: 0.4 },
        { type: "runner", count: 10, gap: 0.25 } ] },
      { hpMul: 1.9, speedMul: 1.2, groups: [
        { type: "tank", count: 4, gap: 0.9 }, { type: "armored", count: 8, gap: 0.45 },
        { type: "boss", count: 1, gap: 0.5 } ] },
    ],
  },
  {
    id: "tidewater", name: "Tidewater Strand", difficulty: "Torment",
    theme: "tidewater", startGold: 310, startLives: 12, hpScale: 4.7,
    node: { x: 7, y: 52 },
    path: [
      { x: -30, y: 90 }, { x: 200, y: 90 }, { x: 200, y: 480 },
      { x: 500, y: 480 }, { x: 500, y: 200 }, { x: 760, y: 200 },
      { x: 760, y: 480 }, { x: 930, y: 480 },
    ],
    spots: [
      { x: 100, y: 190 }, { x: 320, y: 200 }, { x: 340, y: 380 },
      { x: 610, y: 330 }, { x: 610, y: 90 }, { x: 860, y: 300 },
      { x: 100, y: 300 }, { x: 400, y: 545 }, { x: 860, y: 410 },
    ],
    waves: [
      { hpMul: 1.0, speedMul: 1.15, groups: [
        { type: "runner", count: 12, gap: 0.3 } ] },
      { hpMul: 1.1, speedMul: 1.15, groups: [
        { type: "grunt", count: 10, gap: 0.5 }, { type: "flyer", count: 6, gap: 0.45 } ] },
      { hpMul: 1.2, speedMul: 1.15, groups: [
        { type: "runner", count: 10, gap: 0.25 }, { type: "armored", count: 6, gap: 0.5 } ] },
      { hpMul: 1.3, speedMul: 1.2, groups: [
        { type: "flyer", count: 10, gap: 0.35 } ] },
      { hpMul: 1.4, speedMul: 1.2, groups: [
        { type: "tank", count: 4, gap: 1.0 }, { type: "runner", count: 10, gap: 0.25 } ] },
      { hpMul: 1.5, speedMul: 1.2, groups: [
        { type: "armored", count: 10, gap: 0.45 } ] },
      { hpMul: 1.6, speedMul: 1.25, groups: [
        { type: "runner", count: 16, gap: 0.2 }, { type: "flyer", count: 8, gap: 0.35 } ] },
      { hpMul: 1.7, speedMul: 1.25, groups: [
        { type: "tank", count: 5, gap: 0.9 }, { type: "armored", count: 8, gap: 0.45 } ] },
      { hpMul: 1.8, speedMul: 1.25, groups: [
        { type: "boss", count: 1, gap: 0.6 }, { type: "runner", count: 12, gap: 0.22 },
        { type: "flyer", count: 8, gap: 0.35 } ] },
      { hpMul: 1.95, speedMul: 1.3, groups: [
        { type: "boss", count: 2, gap: 3.0 }, { type: "tank", count: 4, gap: 0.9 } ] },
    ],
  },
  {
    id: "stormcrag", name: "Stormcrag Summit", difficulty: "Apocalypse",
    theme: "stormcrag", startGold: 330, startLives: 10, hpScale: 5.5,
    node: { x: 25, y: 15 },
    path: [
      { x: -30, y: 80 }, { x: 820, y: 80 }, { x: 820, y: 300 },
      { x: 420, y: 300 }, { x: 420, y: 180 }, { x: 160, y: 180 },
      { x: 160, y: 460 }, { x: 680, y: 460 }, { x: 680, y: 590 },
    ],
    spots: [
      { x: 600, y: 190 }, { x: 740, y: 190 }, { x: 300, y: 240 },
      { x: 60, y: 300 }, { x: 300, y: 380 }, { x: 530, y: 380 },
      { x: 770, y: 380 }, { x: 540, y: 545 }, { x: 880, y: 180 },
    ],
    waves: [
      { hpMul: 1.0, speedMul: 1.1, groups: [
        { type: "grunt", count: 12, gap: 0.5 } ] },
      { hpMul: 1.1, speedMul: 1.1, groups: [
        { type: "armored", count: 8, gap: 0.5 }, { type: "runner", count: 8, gap: 0.3 } ] },
      { hpMul: 1.2, speedMul: 1.15, groups: [
        { type: "flyer", count: 10, gap: 0.4 } ] },
      { hpMul: 1.3, speedMul: 1.15, groups: [
        { type: "tank", count: 4, gap: 1.0 }, { type: "grunt", count: 10, gap: 0.4 } ] },
      { hpMul: 1.4, speedMul: 1.15, groups: [
        { type: "runner", count: 16, gap: 0.22 }, { type: "flyer", count: 6, gap: 0.4 } ] },
      { hpMul: 1.5, speedMul: 1.2, groups: [
        { type: "armored", count: 10, gap: 0.45 }, { type: "tank", count: 3, gap: 1.0 } ] },
      { hpMul: 1.6, speedMul: 1.2, groups: [
        { type: "boss", count: 1, gap: 0.6 }, { type: "flyer", count: 10, gap: 0.35 } ] },
      { hpMul: 1.7, speedMul: 1.2, groups: [
        { type: "runner", count: 14, gap: 0.22 }, { type: "armored", count: 8, gap: 0.45 } ] },
      { hpMul: 1.8, speedMul: 1.25, groups: [
        { type: "tank", count: 6, gap: 0.85 }, { type: "flyer", count: 8, gap: 0.35 } ] },
      { hpMul: 1.9, speedMul: 1.25, groups: [
        { type: "boss", count: 1, gap: 0.6 }, { type: "armored", count: 10, gap: 0.4 },
        { type: "runner", count: 10, gap: 0.25 } ] },
      { hpMul: 2.0, speedMul: 1.3, groups: [
        { type: "tank", count: 5, gap: 0.8 }, { type: "flyer", count: 12, gap: 0.3 },
        { type: "grunt", count: 10, gap: 0.35 } ] },
      { hpMul: 2.2, speedMul: 1.3, groups: [
        { type: "boss", count: 3, gap: 2.5 }, { type: "tank", count: 4, gap: 0.8 },
        { type: "armored", count: 8, gap: 0.4 } ] },
    ],
  },
];

// Default wave definitions, shared by every level that doesn't declare its
// own `waves` array. Each wave is a list of spawn `groups` (type + count +
// gap), spawned in order. hpMul/speedMul scale the whole wave so later ones bite.
export const wavesFor = (level) => level.waves || WAVES;

export const WAVES = [
  { hpMul: 1.0, speedMul: 1.0, groups: [
    { type: "grunt", count: 8, gap: 0.9 } ] },
  { hpMul: 1.15, speedMul: 1.0, groups: [
    { type: "grunt", count: 6, gap: 0.8 },
    { type: "runner", count: 6, gap: 0.4 } ] },
  { hpMul: 1.3, speedMul: 1.0, groups: [
    { type: "grunt", count: 6, gap: 0.7 },
    { type: "armored", count: 4, gap: 0.8 } ] },
  { hpMul: 1.4, speedMul: 1.05, groups: [
    { type: "runner", count: 8, gap: 0.35 },
    { type: "flyer", count: 4, gap: 0.7 } ] },
  { hpMul: 1.5, speedMul: 1.05, groups: [
    { type: "armored", count: 6, gap: 0.6 },
    { type: "tank", count: 2, gap: 1.4 } ] },
  { hpMul: 1.6, speedMul: 1.1, groups: [
    { type: "grunt", count: 6, gap: 0.5 },
    { type: "flyer", count: 6, gap: 0.5 },
    { type: "runner", count: 8, gap: 0.3 } ] },
  { hpMul: 1.7, speedMul: 1.1, groups: [
    { type: "tank", count: 3, gap: 1.2 },
    { type: "armored", count: 6, gap: 0.6 },
    { type: "flyer", count: 5, gap: 0.5 } ] },
  { hpMul: 1.8, speedMul: 1.15, groups: [
    { type: "runner", count: 10, gap: 0.3 },
    { type: "armored", count: 6, gap: 0.5 },
    { type: "tank", count: 2, gap: 1.2 },
    { type: "boss", count: 1, gap: 0.5 } ] },
];
