// Enemies, organised as five kits — one per stage of the campaign.
//
// Wave tables never name a creature. They name a ROLE, and the stage the
// level belongs to decides which creature fills it. So "wave 4 sends six
// swift and two brutes" means peltasts and war elephants on the Trojan
// shore, and Scylla hounds and cyclopes inside the Labyrinth, with the same
// wave maths behind both. Adding a stage means adding a kit, not touching
// a single wave.
//
// The six roles are the tactical vocabulary of the whole game — each one is
// the answer to a different tower, and every kit fields all six:
export const ROLES = ["swarm", "swift", "shielded", "brute", "winged", "champion"];

// `art` is a recipe, not a drawing — see render/monsters.js, which assembles
// a figure from these switches. Keeping it declarative is what lets five
// kits look distinct without thirty hand-written draw functions.
//   frame:  biped | quadruped | avian | serpent | colossus
//   crest:  plume | horns | snakes | crown | wisp | none
//   carry:  spearShield | club | bow | scythe | none
//   aura:   none | flame | spectral | storm
//   eye:    single  (one central eye instead of a pair)
const kit = (id, name, flavour, creatures) => ({ id, name, flavour, creatures });

// Baseline stats per role. Kits tweak these — a Nemean Lion is not a war
// elephant — but they stay recognisably the same tactical piece, so a player
// who learned to counter "brute" in Arcadia still knows what to do in Hades.
const BASE = {
  swarm:     { radius: 12, hp: 45,   speed: 55,  reward: 12, armor: 0,    flying: false },
  swift:     { radius: 9,  hp: 26,   speed: 108, reward: 10, armor: 0,    flying: false },
  shielded:  { radius: 12, hp: 70,   speed: 48,  reward: 18, armor: 0.55, flying: false },
  brute:     { radius: 18, hp: 190,  speed: 34,  reward: 28, armor: 0.2,  flying: false },
  winged:    { radius: 11, hp: 52,   speed: 74,  reward: 16, armor: 0,    flying: true  },
  champion:  { radius: 26, hp: 1100, speed: 26,  reward: 160, armor: 0.35, flying: false, boss: true },
};

const creature = (role, name, colors, art, tweaks = {}) => ({
  role, name, colors, art: { frame: "biped", crest: "none", carry: "none", aura: "none", scale: 1, ...art },
  ...BASE[role], ...tweaks,
});

export const ENEMY_KITS = {
  // ---------------------------------------------------------------- I
  troy: kit("troy", "Mortal Armies", "The war-host of Ilion and its allies", {
    swarm: creature("swarm", "Rabble Levy",
      { light: "#d8b98a", mid: "#a8763a", dark: "#5e3c14" },
      { frame: "biped", carry: "club" }),
    swift: creature("swift", "Peltast",
      { light: "#ffe9a0", mid: "#e6b422", dark: "#9a7410" },
      { frame: "biped", carry: "bow" }),
    shielded: creature("shielded", "Bronze Hoplite",
      { light: "#e3c27a", mid: "#b08130", dark: "#6b4a12" },
      { frame: "biped", crest: "plume", carry: "spearShield" }),
    brute: creature("brute", "War Elephant",
      { light: "#b9b3a8", mid: "#7d766b", dark: "#453f38" },
      { frame: "quadruped", crest: "horns", scale: 1.1 }),
    winged: creature("winged", "Storm Eagle",
      { light: "#e8dcc0", mid: "#9c7c48", dark: "#4f3c1c" },
      { frame: "avian" }),
    champion: creature("champion", "Champion of Ilion",
      { light: "#ffcf8a", mid: "#c0392b", dark: "#5e160c" },
      { frame: "biped", crest: "plume", carry: "spearShield", scale: 1.05 }),
  }),

  // --------------------------------------------------------------- II
  arcadia: kit("arcadia", "Beasts of Arcadia", "What still runs wild beyond the olive groves", {
    swarm: creature("swarm", "Satyr",
      { light: "#cbbf8e", mid: "#8a7440", dark: "#4a3c18" },
      { frame: "biped", crest: "horns" }),
    swift: creature("swift", "Wild Boar",
      { light: "#c0a288", mid: "#7a5638", dark: "#40291a" },
      { frame: "quadruped" }, { radius: 11 }),
    shielded: creature("shielded", "Centaur Lancer",
      { light: "#d6b98f", mid: "#96683c", dark: "#4e3218" },
      { frame: "quadruped", crest: "plume", carry: "spearShield", scale: 1.15 }),
    brute: creature("brute", "Bull of Colchis",
      { light: "#c9a24a", mid: "#8a6420", dark: "#4a3208" },
      { frame: "quadruped", crest: "horns", aura: "flame" }),
    winged: creature("winged", "Harpy",
      { light: "#d8c9a8", mid: "#94794c", dark: "#4a3a20" },
      { frame: "avian", crest: "horns" }),
    champion: creature("champion", "Nemean Lion",
      { light: "#f0c878", mid: "#b8842c", dark: "#61410c" },
      { frame: "quadruped", crest: "crown", scale: 1.1 }),
  }),

  // -------------------------------------------------------------- III
  labyrinth: kit("labyrinth", "Horrors of the Labyrinth", "Bred in the dark under Knossos", {
    swarm: creature("swarm", "Snake-Spawn",
      { light: "#a8d8a0", mid: "#4f8f52", dark: "#234a26" },
      { frame: "serpent" }),
    swift: creature("swift", "Scylla Hound",
      { light: "#a8d0d8", mid: "#4a8a96", dark: "#1e4650" },
      { frame: "quadruped" }, { radius: 10 }),
    shielded: creature("shielded", "Bronze Sentinel",
      { light: "#e0cf9a", mid: "#a8893c", dark: "#5c4614" },
      { frame: "colossus", carry: "spearShield" }),
    brute: creature("brute", "Cyclops",
      { light: "#cbb59a", mid: "#8a6c4a", dark: "#4a3826" },
      { frame: "biped", carry: "club", eye: "single", scale: 1.25 }),
    winged: creature("winged", "Stymphalian Bird",
      { light: "#cdd6e2", mid: "#7a8698", dark: "#3d4654" },
      { frame: "avian" }),
    champion: creature("champion", "The Minotaur",
      { light: "#c08a5a", mid: "#7a4520", dark: "#3e2008" },
      { frame: "biped", crest: "horns", carry: "club", scale: 1.1 }),
  }),

  // --------------------------------------------------------------- IV
  hades: kit("hades", "Legions of Hades", "The restless dead, loosed from Erebos", {
    swarm: creature("swarm", "Restless Shade",
      { light: "#bcd0e8", mid: "#6a7a9c", dark: "#2f3850" },
      { frame: "biped", aura: "spectral" }),
    swift: creature("swift", "Lemure",
      { light: "#d0c8e8", mid: "#7f6ea8", dark: "#3c3058" },
      { frame: "biped", aura: "spectral" }),
    shielded: creature("shielded", "Skeletal Hoplite",
      { light: "#efe8d2", mid: "#b0a68a", dark: "#5e5744" },
      { frame: "biped", crest: "plume", carry: "spearShield" }),
    brute: creature("brute", "Cerberus",
      { light: "#8a7f96", mid: "#4e4358", dark: "#241d2e" },
      { frame: "quadruped", crest: "horns", aura: "flame" }),
    winged: creature("winged", "Ker",
      { light: "#e0c0d0", mid: "#96547a", dark: "#4a2038" },
      { frame: "avian", aura: "spectral" }),
    champion: creature("champion", "Charon",
      { light: "#9fb4c8", mid: "#4d6076", dark: "#1e2a38" },
      { frame: "biped", crest: "wisp", carry: "scythe", aura: "spectral", scale: 1.05 }),
  }),

  // ---------------------------------------------------------------- V
  olympus: kit("olympus", "Wrath of the Titans", "What the gods buried, digging its way back out", {
    swarm: creature("swarm", "Gigante Spawn",
      { light: "#c8b8e0", mid: "#7a68a8", dark: "#3a2e58" },
      { frame: "biped", crest: "horns" }),
    swift: creature("swift", "Anemoi Windrunner",
      { light: "#d8f0ff", mid: "#68a8d8", dark: "#245878" },
      { frame: "biped", aura: "storm" }),
    shielded: creature("shielded", "Talos Automaton",
      { light: "#ffe6a8", mid: "#c89a34", dark: "#6e5210" },
      { frame: "colossus", carry: "spearShield" }),
    brute: creature("brute", "Hekatoncheir",
      { light: "#b0a0c8", mid: "#6a5890", dark: "#312448" },
      { frame: "colossus", crest: "crown", scale: 1.15 }),
    winged: creature("winged", "Storm Eidolon",
      { light: "#e8f4ff", mid: "#7ab8e8", dark: "#2a5c84" },
      { frame: "avian", aura: "storm" }),
    champion: creature("champion", "Typhon",
      { light: "#ffb0a0", mid: "#b8402c", dark: "#5c1408" },
      { frame: "serpent", crest: "snakes", aura: "flame", scale: 1.2 }),
  }),
};

export const KIT_LIST = Object.keys(ENEMY_KITS);

// Every creature the game can field, keyed "<kitId>.<role>" — the enemy `type`
// stored on a spawned creep. Flat lookup so nothing has to carry a kit around.
export const ENEMY_TYPES = {};
for (const [kitId, k] of Object.entries(ENEMY_KITS))
  for (const [role, c] of Object.entries(k.creatures))
    ENEMY_TYPES[`${kitId}.${role}`] = c;

// Resolve a role to the creature that plays it in `kitId`.
export const typeKeyFor = (kitId, role) => `${kitId}.${role}`;
export const creatureFor = (kitId, role) => ENEMY_KITS[kitId].creatures[role];
