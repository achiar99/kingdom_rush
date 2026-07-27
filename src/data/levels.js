// The fifty levels of the campaign, assembled rather than typed out.
//
// Each level is its stage's difficulty band read at its position, plus a map
// and a wave table generated from a seed derived from its index. Everything
// is deterministic: level 34 is the same level on every machine, every run,
// and — importantly — the same level the balance harness measured.
//
// LEVELS stays a flat array indexed 0..49, because that's what save slots,
// unlocks and tools/sim all key off. `stageIndex` / `levelInStage` are along
// for the ride whenever something needs the two-dimensional view.
import { generateMap } from "./mapgen.js";
import { generateWaves } from "./waves.js";
import { STAGES, THEMES, LEVELS_PER_STAGE, CAMPAIGN, band, bandInt, goldForHpScale } from "./stages.js";

export { THEMES, STAGES, LEVELS_PER_STAGE };

// Names for the ten levels of each stage — the campaign's actual itinerary.
const ITINERARY = {
  troy: [
    "The Landing Beaches", "Scamander Ford", "The Greek Camp", "Chryse Road",
    "Tenedos Strait", "The Scaean Gate", "Ida's Foothills", "The Burning Ships",
    "Under the Walls", "The Wooden Horse",
  ],
  arcadia: [
    "Olive Terraces", "Ladon River", "Erymanthos Pass", "The Boar's Wallow",
    "Stymphalian Marsh", "Lykaion Slopes", "The Centaur Fords", "Cave of the Lion",
    "Alpheios Gorge", "The Hunt's End",
  ],
  labyrinth: [
    "Harbour of Amnisos", "Palace Steps", "The Bronze Doors", "First Turning",
    "Hall of Double Axes", "The Sunken Cistern", "Ariadne's Thread", "The Deep Coil",
    "Forge of Talos", "The Heart of the Maze",
  ],
  hades: [
    "The Grey Shore", "Charon's Crossing", "Fields of Asphodel", "The Weeping Gate",
    "Kennels of Cerberus", "Lethe's Bank", "The Judgement Hall", "Erebos Deep",
    "Tartarus Rim", "Throne of the Unseen",
  ],
  olympus: [
    "Foot of Othrys", "The Shattered Plain", "Titan's Causeway", "Cloudbreak",
    "The Bronze Stair", "Hephaestus' Anvil", "The Aegis Wall", "Storm of Zeus",
    "Gates of Olympus", "Typhon Unbound",
  ],
};

// Distinct seeds for maps and waves so a level's road and its enemies don't
// happen to co-vary. The offsets are arbitrary; only their fixedness matters.
const mapSeed = (index) => 1000 + index * 7919;
const waveSeed = (index) => 500000 + index * 104729;

const TOTAL_LEVELS = STAGES.length * LEVELS_PER_STAGE;
// Read a campaign-wide [first, last] ramp at a global level index.
const ramp = ([a, b], index) => a + (b - a) * (index / (TOTAL_LEVELS - 1));

function buildLevel(stage, stageIndex, levelInStage) {
  const index = stageIndex * LEVELS_PER_STAGE + levelInStage;
  const spots = Math.round(ramp(CAMPAIGN.spots, index));
  // The route archetype cycles within each stage. WANDER — an organic road
  // that hooks and staircases between any two edges — is the bread and butter;
  // the 4th and 7th levels coil into a spiral (the temple in the heart of the
  // maze); the 6th and 9th are FORKS — two roads that merge — which split the
  // player's attention and are this campaign's "hard level" shape. The finale
  // (10th) keeps the classic serpentine: the master fights are tuned on it,
  // and its wall-to-wall lanes are the strongest arena for a set-piece boss.
  // Three forks a stage now — they were two, tucked at slots 6 and 9, and the
  // most-asked question about the campaign was "why don't levels have merged
  // paths": they did, but a player could reach level 6 without meeting one.
  const ARCH = { 2: "fork", 3: "spiral", 5: "fork", 6: "spiral", 8: "fork", 9: "serpentine" };
  const archetype = ARCH[levelInStage] || "wander";
  // Fork maps deal two extra build spots: two roads split the towers'
  // attention, and the extra ground is most of the compensation (the rest is
  // the hard-level edge forks are placed for — see FORK_EXPOSURE_BAND).
  const map = generateMap(mapSeed(index), {
    spots: spots + (archetype === "fork" ? 2 : 0), archetype });
  const waveCount = Math.round(ramp(CAMPAIGN.waveCount, index));
  const hpScale = Number(band(stage.hpScale, levelInStage).toFixed(2));

  return {
    id: `${stage.id}-${levelInStage + 1}`,
    index,
    stageIndex,
    levelInStage,
    stageId: stage.id,
    kit: stage.kit,
    name: ITINERARY[stage.id][levelInStage],
    // Shown on the level node; the stage carries the real difficulty label.
    difficulty: `${stage.numeral}·${levelInStage + 1}`,
    theme: stage.themes[levelInStage % stage.themes.length],
    hpScale,
    // derived, never hand-set — see goldForHpScale in stages.js
    startGold: goldForHpScale(hpScale),
    startLives: Math.round(ramp(CAMPAIGN.startLives, index)),
    path: map.path,
    routes: map.routes,
    archetype: map.archetype,
    spots: map.spots,
    mapLanes: map.lanes,
    pathLength: map.length,
    waves: generateWaves({ stageIndex, levelInStage, waveCount, seed: waveSeed(index) }),
    // Position on the stage's level-select board, as a percentage. Ten nodes
    // on a gentle two-row arc so the route reads left-to-right like a journey.
    node: nodePosition(levelInStage),
  };
}

// Ten nodes marching left to right in a zigzag. Adjacent levels sit on
// opposite sides of the centre line because their name labels are wider than
// the horizontal gap between them — a gentle wave would overlap every pair.
function nodePosition(i) {
  const t = i / (LEVELS_PER_STAGE - 1);
  const zig = i % 2 === 0 ? -1 : 1;
  return {
    x: Math.round((11 + t * 78) * 10) / 10,
    y: Math.round((50 + zig * 21 + Math.sin(t * Math.PI) * 7) * 10) / 10,
  };
}

export const LEVELS = STAGES.flatMap((stage, si) =>
  Array.from({ length: LEVELS_PER_STAGE }, (_, li) => buildLevel(stage, si, li)));

// ---------------------------------------------------------------- lookups
export const wavesFor = (level) => level.waves;
export const stageOf = (level) => STAGES[level.stageIndex];
export const levelsInStage = (stageIndex) =>
  LEVELS.filter((lv) => lv.stageIndex === stageIndex);
export const firstLevelOfStage = (stageIndex) => stageIndex * LEVELS_PER_STAGE;
