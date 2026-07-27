// Enemies, organised as five kits — one per stage of the campaign.
//
// Wave tables never name a creature. They name a ROLE, and the stage the
// level belongs to decides which creature fills it. So "wave 4 sends six
// swift and two brutes" means peltasts and war elephants on the Trojan
// shore, and Scylla hounds and cyclopes inside the Labyrinth, with the same
// wave maths behind both. Adding a stage means adding a kit, not touching
// a single wave.
//
// The ten roles are the tactical vocabulary of the whole game. Each one asks a
// different question of your board, and every kit fields all ten:
//
//   swarm      the rank and file
//   swift      fast and fragile — little time under fire
//   shielded   heavy armour — the Oracle ignores it, nothing else does
//   brute      slow and very tough
//   winged     flies — the Phalanx and the Catapult cannot touch it
//   champion   the headline act
//   warded     resists MAGIC instead of steel — the counter to an all-Oracle
//              board, which was otherwise strictly the best thing to build
//   stormborn  armoured AND flying: only the Oracle answers it cleanly
//   brood      splits into two swarm when it dies — punishes pure splash
//   revenant   heals itself unless it is burning
export const ROLES = [
  "swarm", "swift", "shielded", "brute", "winged",
  "warded", "stormborn", "brood", "revenant", "champion",
];

// `art` is a recipe, not a drawing — see render/monsters.js, which assembles
// a figure from these switches. Keeping it declarative is what lets five
// kits look distinct without fifty hand-written draw functions.
//
//   frame:  the silhouette, and by far the strongest signal at creep size
//           biped | hulk | wraith | crawler | hydra | centaur |
//           quadruped | avian | serpent | colossus
//   skin:   the material laid over the body
//           bronze | bone | scales | fur | stone | ember | tattered | chiton
//   crest:  plume | horns | snakes | crown | wisp | wreath |
//           mane | antlers | skullface | halo | hood | none
//   carry:  spearShield | club | bow | scythe | torch | urn |
//           axe | trident | twinBlades | lyre | none
//   aura:   flame | spectral | storm | ward | regen | none
//   eye:    single  (one central eye instead of a pair)
//
// `frame` and `skin` carry the load; crest and carry are detail work that
// disappears below about twenty pixels. When these were only five frames plus
// head trinkets, 50 creatures shared 38 recipes and the whole bestiary read as
// about ten monsters in different colours. A check that no two creatures share
// a recipe lives in the audit at the bottom of tools/art-preview.html.
//
// Skins are also how a stage reads as one place: Troy is chiton and bronze,
// Arcadia fur and scale, the Labyrinth bronze and stone, Hades bone and rags,
// Olympus stone and ember.
const kit = (id, name, flavour, creatures) => ({ id, name, flavour, creatures });

// Baseline stats per role. Kits tweak these — a Nemean Lion is not a war
// elephant — but they stay recognisably the same tactical piece, so a player
// who learned to counter "brute" in Arcadia still knows what to do in Hades.
// `melee` is what a creep does to whatever is blocking it. Left unset it uses
// CONFIG.enemy's default (14 every 1.0s) — which is right for rank and file,
// and was badly wrong for anything with "boss" on it: a champion used to hit a
// hoplite exactly as hard as a Rabble Levy did.
const BASE = {
  swarm:     { radius: 12, hp: 45,   speed: 55,  reward: 12, armor: 0,    flying: false },
  swift:     { radius: 9,  hp: 26,   speed: 108, reward: 10, armor: 0,    flying: false },
  shielded:  { radius: 12, hp: 70,   speed: 48,  reward: 18, armor: 0.55, flying: false },
  brute:     { radius: 18, hp: 190,  speed: 34,  reward: 28, armor: 0.2,  flying: false,
               melee: { damage: 26 } },
  winged:    { radius: 11, hp: 52,   speed: 74,  reward: 16, armor: 0,    flying: true  },
  // Mirror image of `shielded`: steel goes straight through it, sorcery does
  // not. Without this the Oracle had no bad matchup and outclassed everything.
  warded:    { radius: 12, hp: 88,   speed: 50,  reward: 20, armor: 0,    flying: false, magicResist: 0.6 },
  // Armoured and airborne: the Phalanx can't block it, the Catapult can't
  // shoot it, and armour blunts the Toxotai. The Oracle is the clean answer.
  stormborn: { radius: 12, hp: 78,   speed: 66,  reward: 24, armor: 0.4,  flying: true  },
  // Dies into two swarm. A board that leans entirely on splash finds the
  // wave getting bigger rather than smaller.
  brood:     { radius: 14, hp: 84,   speed: 46,  reward: 16, armor: 0.1,  flying: false, splits: 2 },
  // Claws its health back unless something is burning it — rewards Ignite and
  // the Shrine of Hekate, punishes slow chip damage.
  revenant:  { radius: 13, hp: 120,  speed: 42,  reward: 22, armor: 0.15, flying: false, regen: 14 },
  champion:  { radius: 26, hp: 1100, speed: 26,  reward: 160, armor: 0.35, flying: false, boss: true,
               melee: { damage: 38, interval: 0.85 } },
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
      { frame: "biped", skin: "chiton", carry: "club" }),
    swift: creature("swift", "Peltast",
      { light: "#ffe9a0", mid: "#e6b422", dark: "#9a7410" },
      { frame: "biped", skin: "fur", carry: "bow" }),
    shielded: creature("shielded", "Bronze Hoplite",
      { light: "#e3c27a", mid: "#b08130", dark: "#6b4a12" },
      { frame: "biped", skin: "bronze", crest: "plume", carry: "spearShield" }),
    brute: creature("brute", "War Elephant",
      { light: "#b9b3a8", mid: "#7d766b", dark: "#453f38" },
      { frame: "quadruped", skin: "bronze", crest: "horns", scale: 1.1 }),
    winged: creature("winged", "Storm Eagle",
      { light: "#e8dcc0", mid: "#9c7c48", dark: "#4f3c1c" },
      { frame: "avian" }),
    warded: creature("warded", "Priest of Apollo",
      { light: "#f0e4c8", mid: "#c8a860", dark: "#7a6428" },
      { frame: "biped", skin: "chiton", crest: "wreath", carry: "lyre", aura: "ward" }),
    stormborn: creature("stormborn", "Bronze Harpy-Rider",
      { light: "#e0c88a", mid: "#a8823a", dark: "#5c4414" },
      { frame: "avian", skin: "bronze", crest: "plume" }),
    brood: creature("brood", "Spartoi Sower",
      { light: "#cbb896", mid: "#8a7048", dark: "#4a3a20" },
      { frame: "biped", skin: "bone", carry: "urn" }),
    revenant: creature("revenant", "Myrmidon Shade",
      { light: "#d8ccb0", mid: "#948060", dark: "#4e4028" },
      { frame: "biped", skin: "tattered", carry: "spearShield", aura: "regen" }),
    champion: creature("champion", "Champion of Ilion",
      { light: "#ffcf8a", mid: "#c0392b", dark: "#5e160c" },
      { frame: "hulk", skin: "bronze", crest: "plume", carry: "axe", scale: 1.05 }),
  }),

  // --------------------------------------------------------------- II
  arcadia: kit("arcadia", "Beasts of Arcadia", "What still runs wild beyond the olive groves", {
    swarm: creature("swarm", "Satyr",
      { light: "#cbbf8e", mid: "#8a7440", dark: "#4a3c18" },
      { frame: "biped", skin: "fur", crest: "horns" }),
    swift: creature("swift", "Wild Boar",
      { light: "#c0a288", mid: "#7a5638", dark: "#40291a" },
      { frame: "quadruped", skin: "fur" }, { radius: 11 }),
    shielded: creature("shielded", "Centaur Lancer",
      { light: "#d6b98f", mid: "#96683c", dark: "#4e3218" },
      { frame: "centaur", skin: "bronze", crest: "plume", carry: "spearShield", scale: 1.3 }),
    brute: creature("brute", "Bull of Colchis",
      { light: "#c9a24a", mid: "#8a6420", dark: "#4a3208" },
      { frame: "quadruped", skin: "ember", crest: "horns", aura: "flame" }),
    winged: creature("winged", "Harpy",
      { light: "#d8c9a8", mid: "#94794c", dark: "#4a3a20" },
      { frame: "avian", skin: "fur" }),
    warded: creature("warded", "Dryad",
      { light: "#c8e0a0", mid: "#6f9a4a", dark: "#33521f" },
      { frame: "biped", skin: "chiton", crest: "antlers", aura: "ward" }),
    stormborn: creature("stormborn", "Bronze-Feathered Roc",
      { light: "#dcc890", mid: "#9c7c3c", dark: "#523c14" },
      { frame: "avian", skin: "bronze", crest: "horns", aura: "storm" }),
    brood: creature("brood", "Hydra Hatchling",
      { light: "#a0d8c0", mid: "#3f8f78", dark: "#1d4a3c" },
      { frame: "hydra", skin: "scales" }),
    revenant: creature("revenant", "Antaeus Spawn",
      { light: "#c8b090", mid: "#8a6a3c", dark: "#4a3418" },
      { frame: "hulk", skin: "stone", carry: "club", aura: "regen" }),
    champion: creature("champion", "Nemean Lion",
      { light: "#f0c878", mid: "#b8842c", dark: "#61410c" },
      { frame: "quadruped", skin: "fur", crest: "mane", scale: 1.1 }),
  }),

  // -------------------------------------------------------------- III
  labyrinth: kit("labyrinth", "Horrors of the Labyrinth", "Bred in the dark under Knossos", {
    swarm: creature("swarm", "Snake-Spawn",
      { light: "#a8d8a0", mid: "#4f8f52", dark: "#234a26" },
      { frame: "serpent", skin: "scales" }),
    swift: creature("swift", "Scylla Hound",
      { light: "#a8d0d8", mid: "#4a8a96", dark: "#1e4650" },
      { frame: "crawler", skin: "scales" }, { radius: 10 }),
    shielded: creature("shielded", "Bronze Sentinel",
      { light: "#e0cf9a", mid: "#a8893c", dark: "#5c4614" },
      { frame: "colossus", skin: "bronze", carry: "spearShield" }),
    brute: creature("brute", "Cyclops",
      { light: "#cbb59a", mid: "#8a6c4a", dark: "#4a3826" },
      { frame: "hulk", skin: "fur", carry: "club", eye: "single", scale: 1.25 }),
    winged: creature("winged", "Stymphalian Bird",
      { light: "#cdd6e2", mid: "#7a8698", dark: "#3d4654" },
      { frame: "avian", skin: "bronze" }),
    warded: creature("warded", "Gorgon Acolyte",
      { light: "#b8e0b0", mid: "#5f9a62", dark: "#2a4f2c" },
      { frame: "biped", skin: "scales", crest: "snakes", aura: "ward" }),
    stormborn: creature("stormborn", "Bronze Griffin",
      { light: "#e8d8a0", mid: "#b0903c", dark: "#5e4a14" },
      { frame: "avian", skin: "bronze", crest: "mane" }),
    brood: creature("brood", "Serpent Brood-Mother",
      { light: "#a8d8a0", mid: "#4f8f52", dark: "#234a26" },
      { frame: "hydra", skin: "scales", crest: "horns" }),
    revenant: creature("revenant", "Stone-Knit Golem",
      { light: "#cfc8b8", mid: "#8a8272", dark: "#4a453a" },
      { frame: "colossus", skin: "stone", aura: "regen" }),
    champion: creature("champion", "The Minotaur",
      { light: "#c08a5a", mid: "#7a4520", dark: "#3e2008" },
      { frame: "hulk", skin: "fur", crest: "horns", carry: "axe", scale: 1.1 }),
  }),

  // --------------------------------------------------------------- IV
  hades: kit("hades", "Legions of Hades", "The restless dead, loosed from Erebos", {
    swarm: creature("swarm", "Restless Shade",
      { light: "#bcd0e8", mid: "#6a7a9c", dark: "#2f3850" },
      { frame: "wraith", skin: "tattered", aura: "spectral" }),
    swift: creature("swift", "Lemure",
      { light: "#d0c8e8", mid: "#7f6ea8", dark: "#3c3058" },
      { frame: "wraith", crest: "hood", aura: "spectral" }),
    shielded: creature("shielded", "Skeletal Hoplite",
      { light: "#efe8d2", mid: "#b0a68a", dark: "#5e5744" },
      { frame: "biped", skin: "bone", crest: "plume", carry: "spearShield" }),
    brute: creature("brute", "Cerberus",
      { light: "#8a7f96", mid: "#4e4358", dark: "#241d2e" },
      { frame: "hydra", skin: "fur", aura: "flame" }),
    winged: creature("winged", "Ker",
      { light: "#e0c0d0", mid: "#96547a", dark: "#4a2038" },
      { frame: "avian", skin: "tattered", aura: "spectral" }),
    warded: creature("warded", "Charon's Herald",
      { light: "#cfe0f0", mid: "#7288a8", dark: "#33415c" },
      { frame: "biped", skin: "tattered", crest: "hood", carry: "torch", aura: "ward" }),
    stormborn: creature("stormborn", "Erinys",
      { light: "#e8c0d8", mid: "#a05888", dark: "#4e2040" },
      { frame: "avian", skin: "bone", crest: "snakes" }),
    brood: creature("brood", "Bone Pile",
      { light: "#efe8d2", mid: "#b0a68a", dark: "#5e5744" },
      { frame: "crawler", skin: "bone" }),
    revenant: creature("revenant", "Undying Hoplite",
      { light: "#e0d8c0", mid: "#94886a", dark: "#4e4632" },
      { frame: "biped", skin: "bone", crest: "skullface", carry: "spearShield", aura: "regen" }),
    champion: creature("champion", "Charon",
      { light: "#9fb4c8", mid: "#4d6076", dark: "#1e2a38" },
      { frame: "wraith", skin: "tattered", crest: "wisp", carry: "scythe", aura: "spectral", scale: 1.05 }),
  }),

  // ---------------------------------------------------------------- V
  olympus: kit("olympus", "Wrath of the Titans", "What the gods buried, digging its way back out", {
    swarm: creature("swarm", "Gigante Spawn",
      { light: "#c8b8e0", mid: "#7a68a8", dark: "#3a2e58" },
      { frame: "biped", skin: "stone", crest: "horns" }),
    swift: creature("swift", "Anemoi Windrunner",
      { light: "#d8f0ff", mid: "#68a8d8", dark: "#245878" },
      { frame: "biped", skin: "chiton", aura: "storm" }),
    shielded: creature("shielded", "Talos Automaton",
      { light: "#ffe6a8", mid: "#c89a34", dark: "#6e5210" },
      { frame: "colossus", skin: "ember", carry: "spearShield" }),
    brute: creature("brute", "Hekatoncheir",
      { light: "#b0a0c8", mid: "#6a5890", dark: "#312448" },
      { frame: "hulk", skin: "stone", crest: "crown", scale: 1.15 }),
    winged: creature("winged", "Storm Eidolon",
      { light: "#e8f4ff", mid: "#7ab8e8", dark: "#2a5c84" },
      { frame: "avian", crest: "wisp", aura: "storm" }),
    warded: creature("warded", "Aegis Bearer",
      { light: "#ffeab0", mid: "#c8a840", dark: "#6e5a14" },
      { frame: "biped", skin: "bronze", crest: "halo", carry: "spearShield", aura: "ward" }),
    stormborn: creature("stormborn", "Thunder Roc",
      { light: "#e8f4ff", mid: "#7ab0e8", dark: "#2a5490" },
      { frame: "avian", skin: "ember", crest: "horns", aura: "storm" }),
    brood: creature("brood", "Gigante Seed",
      { light: "#c8b8e0", mid: "#7a68a8", dark: "#3a2e58" },
      { frame: "biped", skin: "stone", carry: "urn" }),
    revenant: creature("revenant", "Reforged Talos",
      { light: "#ffe6a8", mid: "#c89a34", dark: "#6e5210" },
      { frame: "colossus", skin: "bronze", aura: "regen" }),
    champion: creature("champion", "Typhon",
      { light: "#ffb0a0", mid: "#b8402c", dark: "#5c1408" },
      { frame: "serpent", skin: "ember", crest: "snakes", aura: "flame", scale: 1.2 }),
  }),
};

// ------------------------------------------------------------- stage masters
// One named figure per stage, and it appears exactly once in the whole
// campaign: the final wave of that stage's tenth level.
//
// Deliberately NOT a member of ROLES. Roles are the vocabulary the wave
// generator shuffles freely, and a master that could turn up in wave 3 of a
// mid-stage level would stop being an event. data/waves.js appends it by hand
// to the one wave that earns it.
//
// It resists armour-piercing AND armour-blunting: 40% armour with a 20% ward,
// so neither an all-Oracle nor an all-Toxotai board walks through it. The
// answer is a board that does two things well.
const master = (name, colors, art, tweaks = {}) => ({
  role: "master", name, colors,
  art: { frame: "biped", crest: "crown", carry: "none", aura: "none", scale: 1.35, ...art },
  // absoluteHp bypasses hpScale and the wave's hpMul entirely — see makeEnemy.
  //
  // Every other creature is a template multiplied by its level's difficulty.
  // A master is one hand-placed fight, and inheriting that multiplier made it
  // unkillable: trash HP scales 3.9x to 8.8x across the campaign while the
  // board's damage ceiling barely moves, so the same boss went from hard to
  // impossible purely by being later. These are the numbers it actually has.
  radius: 34, hp: 4200, speed: 22, reward: 500,
  armor: 0.4, magicResist: 0.2, flying: false, boss: true,
  // A master walks THROUGH a phalanx. It swings hard, swings fast, and every
  // swing cleaves the whole squad rather than one man at a time — three
  // hoplites should buy you a couple of seconds, not stop it dead.
  melee: { damage: 52, interval: 0.6, cleave: 46 },
  ...tweaks,
});

// `absoluteHp` is the health the master actually has, full stop — it is the
// third argument (stat tweaks), not part of the art recipe.
//
// These were solved against tools/sim, not chosen by feel.
//
// Read them together with MASTER_ESCORT in data/waves.js, which is the bigger
// lever: how much of the finale's normal wave marches in alongside the boss
// decides these levels far more than the boss's own health does. Measured
// bluntly — with the Stage V master dropped to 2500 HP, weaker than an
// ordinary champion, that level still would not go above 21%, because the
// escort alone was losing it. Thinning the escort fixed what no HP value
// could. If a finale is missing its target, look there first.
export const MASTERS = {
  troy: master("Hector, Breaker of Ships",
    // blackened bronze and deep ox-blood, so he doesn't read as a recoloured
    // Champion of Ilion standing next to him in the guide
    { light: "#c9a24a", mid: "#6e4a1c", dark: "#2a1c08" },
    { frame: "hulk", skin: "bronze", crest: "plume", carry: "spearShield", aura: "flame" },
    { absoluteHp: 8300 }),
  arcadia: master("Lykaon, the Wolf-King",
    { light: "#d8cbb0", mid: "#8a7a58", dark: "#443a26" },
    { frame: "hulk", skin: "fur", crest: "mane", carry: "twinBlades", aura: "regen" },
    { absoluteHp: 9000 }),
  labyrinth: master("The Chimera",
    { light: "#ffc078", mid: "#c05a20", dark: "#5e2408" },
    { frame: "hydra", skin: "ember", crest: "mane", aura: "flame" },
    { absoluteHp: 8000 }),
  hades: master("Thanatos, Bringer of Death",
    { light: "#cfd8e8", mid: "#5c6a88", dark: "#232c40" },
    { frame: "wraith", skin: "tattered", crest: "skullface", carry: "scythe", aura: "spectral" },
    { absoluteHp: 9000 }),
  olympus: master("Kronos, Father of Titans",
    { light: "#ffe6a8", mid: "#b88a2c", dark: "#5a3c08" },
    { frame: "colossus", skin: "stone", crest: "crown", carry: "trident", aura: "storm", scale: 1.5 },
    { radius: 38, absoluteHp: 8000 }),
};

// Folded into each kit under the key "master", so makeEnemy's KIT[type] lookup
// finds it the same way it finds every other creature.
for (const [kitId, m] of Object.entries(MASTERS)) ENEMY_KITS[kitId].creatures.master = m;

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
