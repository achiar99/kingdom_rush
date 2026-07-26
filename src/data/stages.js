// The campaign: five stages of ten levels, told as a march from the beaches
// of Troy to the slopes of Olympus.
//
// A stage owns the things that make ten levels feel like one chapter — the
// enemies you're fighting, the ground you're fighting on, and how hard it
// gets — while the levels inside it own only their map and their exact
// numbers. Every difficulty knob is expressed as a *band* the ten levels
// interpolate across, so the whole campaign curve is readable in one screen
// and tunable without touching fifty definitions.
export const LEVELS_PER_STAGE = 10;

// Terrain palettes. Each stage cycles through its own set so consecutive
// levels don't look identical, but a stage still reads as one place.
export const THEMES = {
  // I — the Troad: dry grass, dust roads, bleached stone
  ilion:     { grass: ["#8a9a5b", "#5d6b39"], checker: "rgba(255,247,214,0.03)",
               path: { rim: "#9a7b42", body: "#cfae74", track: "#eddcb0" } },
  troad:     { grass: ["#a8a05c", "#6f7a3e"], checker: "rgba(255,247,214,0.04)",
               path: { rim: "#8f7038", body: "#c4a066", track: "#e6d2a2" } },
  aegean:    { grass: ["#4f9a9a", "#2f6a6f"], checker: "rgba(255,255,255,0.05)",
               path: { rim: "#b09256", body: "#e0c68c", track: "#f5e6bd" } },
  // II — Arcadia: olive groves, deep woodland, river country
  olive:     { grass: ["#6d8f52", "#415c33"], checker: "rgba(230,255,200,0.03)",
               path: { rim: "#7a5f34", body: "#a8874f", track: "#cdae74" } },
  arkadia:   { grass: ["#4e7a45", "#2c4a28"], checker: "rgba(210,255,190,0.03)",
               path: { rim: "#6b5330", body: "#95784a", track: "#bb9c68" } },
  alpheios:  { grass: ["#5b8f7a", "#33604f"], checker: "rgba(200,255,235,0.04)",
               path: { rim: "#6f5a38", body: "#9c8354", track: "#c4a976" } },
  // III — Crete and the Labyrinth: worked stone, bronze, lamplight
  knossos:   { grass: ["#7d6a58", "#4c3f34"], checker: "rgba(255,220,160,0.04)",
               path: { rim: "#6a5340", body: "#9c8163", track: "#c6a983" } },
  labyrinth: { grass: ["#544a5e", "#302a38"], checker: "rgba(255,200,120,0.05)",
               path: { rim: "#5c4a3a", body: "#87705a", track: "#ab9078" } },
  bronze:    { grass: ["#6e5f3e", "#413825"], checker: "rgba(255,210,120,0.05)",
               path: { rim: "#7a5c22", body: "#ab8236", track: "#d6a856" } },
  // IV — the house of Hades: ash, asphodel, the river
  asphodel:  { grass: ["#4a4f5e", "#2a2d38"], checker: "rgba(200,215,255,0.04)",
               path: { rim: "#3f4454", body: "#626a80", track: "#8b93aa" } },
  erebos:    { grass: ["#33283e", "#1c1526"], checker: "rgba(170,130,255,0.05)",
               path: { rim: "#453458", body: "#63507f", track: "#8a72ab" } },
  styx:      { grass: ["#2f4450", "#182730"], checker: "rgba(120,220,255,0.05)",
               path: { rim: "#3a4a52", body: "#5a7078", track: "#84a0aa" } },
  // V — Olympus: cloud, marble, lightning-scorched rock
  othrys:    { grass: ["#5a5468", "#332f40"], checker: "rgba(255,255,255,0.04)",
               path: { rim: "#4a4456", body: "#6f677f", track: "#9990a8" } },
  olympus:   { grass: ["#8fa8c8", "#5a7093"], checker: "rgba(255,255,255,0.07)",
               path: { rim: "#a89a6a", body: "#e0d2a0", track: "#f8f0d0" } },
  aither:    { grass: ["#b8c8e8", "#7f90b8"], checker: "rgba(255,255,255,0.08)",
               path: { rim: "#b0a070", body: "#ecdcae", track: "#fff8e0" } },
};

// Starting gold is DERIVED from hpScale, not set per stage.
//
// The single worst bug the balance harness found in the previous campaign was
// levels whose wave 1 demanded five times more enemy HP per starting gold
// than the opening level did — unaffordable before the player could build
// anything, and unwinnable for that reason alone. That happened because HP
// and gold were tuned independently and drifted apart.
//
// Tying them together makes that failure impossible by construction. The
// exponent is just under 1, so purses grow almost in step with enemy HP but
// fall a little behind — which is where the campaign's rising difficulty
// comes from, smoothly, instead of from a cliff.
// Lives, wave count and build spots ramp across the WHOLE campaign rather
// than resetting per stage. They were per-stage bands at first, and the
// balance fitter immediately showed why that was wrong: they moved difficulty
// so much that hpScale had to go *down* in later stages to compensate, which
// is both absurd to read and impossible to tune. With these as smooth global
// ramps, a stage's hpScale band is the one dial that says how hard it is.
// Kept deliberately gentle. Steeper ramps here swamped hpScale entirely —
// later levels became harder at *equal* enemy HP, so fitting the curve
// demanded a falling hpScale, which reads as "the Titans are weaker than the
// Minotaur". These move a little; hpScale does the real work.
export const CAMPAIGN = {
  startLives: [20, 16],
  waveCount: [8, 11],
  spots: [9, 12],
};

export const GOLD_BASE = 240;
export const GOLD_EXPONENT = 0.85;
export const goldForHpScale = (hpScale) => Math.round(GOLD_BASE * Math.pow(hpScale, GOLD_EXPONENT));

export const STAGES = [
  {
    id: "troy", numeral: "I", name: "The Siege of Ilion",
    blurb: "Ten years of war, and the walls still stand.",
    kit: "troy",
    themes: ["ilion", "troad", "aegean"],
    // The stage's difficulty, as [first level, last level]; the eight levels
    // between interpolate. These come from tools/sim/fit-stages.js and are
    // deliberately NOT monotonic across the campaign — a later stage can want
    // a lower hpScale because it fields more waves and every role from its
    // first level. Forcing them to rise "because Titans should be tougher
    // than a Minotaur" put the last ten levels at a 0% win rate.
    hpScale: [1.0, 3.9],
    icon: "🛡️",
  },
  {
    id: "arcadia", numeral: "II", name: "The Wilds of Arcadia",
    blurb: "Past the last olive terrace, older things are still awake.",
    kit: "arcadia",
    themes: ["olive", "arkadia", "alpheios"],
    hpScale: [3.2, 7.2],
    icon: "🌿",
  },
  {
    id: "labyrinth", numeral: "III", name: "Beneath Knossos",
    blurb: "Every corridor doubles back. Something is counting your turns.",
    kit: "labyrinth",
    themes: ["knossos", "labyrinth", "bronze"],
    hpScale: [7.5, 6.0],
    icon: "🐂",
  },
  {
    id: "hades", numeral: "IV", name: "The House of Hades",
    blurb: "The dead are many, and they are no longer resting.",
    kit: "hades",
    themes: ["asphodel", "erebos", "styx"],
    hpScale: [6.4, 8.8],
    icon: "💀",
  },
  {
    id: "olympus", numeral: "V", name: "The Wrath of Olympus",
    blurb: "What the gods buried is climbing back up the mountain.",
    kit: "olympus",
    themes: ["othrys", "olympus", "aither"],
    hpScale: [3.9, 6.3],
    icon: "⚡",
  },
];

// Position along a stage, 0 at its first level and 1 at its last.
export const stageProgress = (i) => (LEVELS_PER_STAGE === 1 ? 0 : i / (LEVELS_PER_STAGE - 1));

// Read a [first, last] band at level `i` of a stage.
export const band = ([a, b], i) => a + (b - a) * stageProgress(i);
export const bandInt = (pair, i) => Math.round(band(pair, i));
