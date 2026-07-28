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

// Terrain palettes, and the biome each stage is set in.
//
// The campaign walks through five climates rather than five shades of the same
// olive-green field: grass, then forest, then snow, then grey rock, then a
// burnt-out volcanic dark. That progression is doing real work — it tells you
// how far you are without a single word of UI, and it stops levels 30 and 50
// looking like recolours of level 3.
//
// The Greek framing still holds at every step, which is why these are places
// and not just colours: the Troad is open plain, Arcadia is deep woodland, the
// approach to Knossos climbs over snowbound Ida, the house of Hades is ash and
// bare stone, and what is digging its way back up Othrys left the mountain
// scorched. Each stage cycles through three variants so ten consecutive levels
// don't repeat, while still reading as one place.
//
// `back` names the horizon motif — see render/backdrop.js.
export const THEMES = {
  // I — the Troad: open grass, dust roads, bleached stone
  ilion:      { grass: ["#7fa03e", "#4c6428"], checker: "rgba(255,247,214,0.03)",
                path: { rim: "#7e5e28", body: "#d3ab5e", track: "#efd79a" },
                back: "mountains", sky: ["#cfe0ea", "#9fc0b0"] },
  troad:      { grass: ["#93a344", "#59702e"], checker: "rgba(255,247,214,0.04)",
                path: { rim: "#755624", body: "#c89e54", track: "#e8cd8e" },
                back: "ruins", sky: ["#dfe6dc", "#b2c69c"] },
  aegean:     { grass: ["#74a04c", "#3f6638"], checker: "rgba(255,255,255,0.05)",
                path: { rim: "#87682e", body: "#dbb970", track: "#f3e0a8" },
                back: "sea", sky: ["#bcdcea", "#7fb6c4"] },

  // II — Arcadia: deep woodland, moss, river country
  olive:      { grass: ["#548040", "#2b4a24"], checker: "rgba(230,255,200,0.03)",
                path: { rim: "#7a5f34", body: "#a8874f", track: "#cdae74" },
                back: "woods", sky: ["#9fbe92", "#6b8f63"] },
  arkadia:    { grass: ["#3f6e36", "#1d3a1a"], checker: "rgba(210,255,190,0.03)",
                path: { rim: "#6b5330", body: "#95784a", track: "#bb9c68" },
                back: "woods", sky: ["#87ab7c", "#4f7549"] },
  alpheios:   { grass: ["#487856", "#254733"], checker: "rgba(200,255,235,0.04)",
                path: { rim: "#6f5a38", body: "#9c8354", track: "#c4a976" },
                back: "lake", sky: ["#a8c8bc", "#6a998a"] },

  // III — the climb over Ida to Knossos: snow, frozen pine, blue shadow
  idaSnow:    { grass: ["#f4f7fb", "#d3deea"], checker: "rgba(255,255,255,0.06)",
                path: { rim: "#6d7684", body: "#a2adbd", track: "#cdd7e4" },
                back: "snowpeaks", sky: ["#e6eef6", "#b9cfe0"] },
  frostwood:  { grass: ["#e9eff6", "#bfcedd"], checker: "rgba(255,255,255,0.05)",
                path: { rim: "#616a78", body: "#96a1b1", track: "#c2ccda" },
                back: "snowwoods", sky: ["#d8e4ee", "#a6bfd4"] },
  glacier:    { grass: ["#e2ecf5", "#abc0d4"], checker: "rgba(220,245,255,0.06)",
                path: { rim: "#59636f", body: "#8c98a8", track: "#b8c4d3" },
                back: "snowpeaks", sky: ["#cfe0ee", "#8fb2cc"] },

  // IV — the house of Hades: grey rock, ash, no green at all
  asphodel:   { grass: ["#8c8a86", "#56544f"], checker: "rgba(230,230,235,0.04)",
                path: { rim: "#45433d", body: "#6b6860", track: "#8e8b82" },
                back: "cliffs", sky: ["#9d9c9a", "#6b6a68"] },
  greyreach:  { grass: ["#7c7a78", "#484744"], checker: "rgba(220,222,228,0.04)",
                path: { rim: "#3e3c37", body: "#605d56", track: "#807d75" },
                back: "crags", sky: ["#8e8d8c", "#5c5b5a"] },
  stygian:    { grass: ["#6e7276", "#3e4245"], checker: "rgba(190,210,225,0.05)",
                path: { rim: "#383b3f", body: "#575b60", track: "#767b82" },
                back: "cliffs", sky: ["#7d8388", "#4e5357"] },

  // V — Othrys, scorched: black rock, ember light, ash falling
  othrys:     { grass: ["#3b3238", "#1f1a20"], checker: "rgba(255,190,140,0.04)",
                path: { rim: "#40353a", body: "#5d4e53", track: "#7d6a70" },
                back: "volcano", sky: ["#5a2f28", "#2a1a1e"] },
  emberwaste: { grass: ["#443434", "#241b1c"], checker: "rgba(255,170,110,0.05)",
                path: { rim: "#4a3833", body: "#6a5049", track: "#8b6c62" },
                back: "volcano", sky: ["#6e3626", "#2c1a18"] },
  shadowpeak: { grass: ["#332f3c", "#1a1822"], checker: "rgba(200,170,255,0.04)",
                path: { rim: "#3a3444", body: "#554e63", track: "#736b83" },
                back: "crags", sky: ["#3f3450", "#1c1826"] },
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
    // deliberately NOT monotonic — a later level can want a LOWER hpScale
    // because it fields more waves, and since waves now overlap, wave count
    // costs far more than it used to. Forcing them to rise "because Titans
    // should be tougher than a Minotaur" put the last ten levels at 0%.
    //
    // Two caveats when re-reading the fitter's output. First, every stage's
    // TENTH level is its master level, and a master's absoluteHp deliberately
    // bypasses hpScale — so the fitter has no lever on the thing actually
    // deciding that fight and will chase the endpoint down absurdly far. It
    // asked for 0.5 on Stage II and still missed the target by 30 points. Tune
    // the master in data/enemyKits.js instead.
    //
    // Second: startGold is derived
    // from hpScale, so raising hpScale hands out proportionally more gold. On
    // the early levels the two cancel almost exactly and the fitter will
    // happily report an enormous first-level value that "still wins 100%".
    // That is not a difficulty reading — it means hpScale barely controls
    // difficulty there at all. Take those with judgement.
    // Refit against the hand-authored maps (interior-slot fit; the first
    // level is anchored at 1.0 by design — the fitter's own caveat above
    // applies, hpScale barely bites that early). Every band below comes from
    // solving slots 3 and 8 of the stage and drawing the line through them,
    // with each level's exposure normalisation (levels.js) already factored
    // out, so the numbers here stay pure stage-difficulty dials.
    hpScale: [1.0, 2.8],
    icon: "🛡️",
  },
  {
    id: "arcadia", numeral: "II", name: "The Wilds of Arcadia",
    blurb: "Past the last olive terrace, older things are still awake.",
    kit: "arcadia",
    themes: ["olive", "arkadia", "alpheios"],
    hpScale: [3.2, 2.7],
    icon: "🌿",
  },
  {
    id: "labyrinth", numeral: "III", name: "Beneath Knossos",
    blurb: "Every corridor doubles back. Something is counting your turns.",
    kit: "labyrinth",
    themes: ["idaSnow", "frostwood", "glacier"],
    hpScale: [2.2, 4.4],
    icon: "🐂",
  },
  {
    id: "hades", numeral: "IV", name: "The House of Hades",
    blurb: "The dead are many, and they are no longer resting.",
    kit: "hades",
    themes: ["asphodel", "greyreach", "stygian"],
    hpScale: [2.4, 6.3],
    icon: "💀",
  },
  {
    id: "olympus", numeral: "V", name: "The Wrath of Olympus",
    blurb: "What the gods buried is climbing back up the mountain.",
    kit: "olympus",
    themes: ["othrys", "emberwaste", "shadowpeak"],
    hpScale: [3.9, 2.8],
    icon: "⚡",
  },
];

// Position along a stage, 0 at its first level and 1 at its last.
export const stageProgress = (i) => (LEVELS_PER_STAGE === 1 ? 0 : i / (LEVELS_PER_STAGE - 1));

// Read a [first, last] band at level `i` of a stage.
export const band = ([a, b], i) => a + (b - a) * stageProgress(i);
export const bandInt = (pair, i) => Math.round(band(pair, i));
