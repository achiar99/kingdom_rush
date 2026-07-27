// The fifty roads of the campaign, drawn by hand.
//
// The old generator grew roads from rules (serpentine lanes, self-avoiding
// walks) and the result was fifty variations that all read as the same maze:
// wall-to-wall lanes, forks you couldn't see, roads that filled the field.
// The reference game's maps are the opposite — one confident road with a few
// sweeping bends, forks that read as an unmistakable Y, and generous grass
// pockets for build spots. That look is a *design*, not a distribution, so
// each level's route is now written down as control points and the machinery
// (seeded jitter, spline smoothing, spot picking, exposure validation) turns
// the same blueprint into the same playable map on every machine.
//
// The vocabulary, so no two of the fifty feel alike:
//   wander      one road: S-sweeps, meanders, staircases, hooks, weaves
//   fork        two or three roads that MERGE — Y-merges (separate entrances),
//               diamonds (one road splits around an island and rejoins),
//               tridents (three entrances), a double diamond
//   spiral      the road coils inward; the temple stands in its heart
//   serpentine  the classic boustrophedon, saved for each stage's finale
//
// Authoring rules (enforced by tools/check-maps.js):
//   * world is 900x560; interior points stay in x 75..835, y 62..500
//   * entries/exits run off-screen: x -30 / 930, y -8 (top, sky sits there)
//     or 590 (bottom)
//   * parallel corridors keep 100-145px between centrelines — under 100 the
//     painted roads (~67px wide) touch; much over ~150 a build spot between
//     two passes can no longer watch both, and the exposure band (the average
//     road one spot covers — see mapgen.js) becomes unreachable
//   * a fork's merged tail is ONE shared array spliced into every route, so
//     the shared stretch is pixel-identical (jitter is applied per-point, and
//     shared points are shared references)
//   * `spotAdjust` trims a compact map's build-spot count: exposure is
//     per-spot, so a small map keeps its band with fewer, better spots
//
// Coordinates are [x, y] pairs; mapgen.js turns them into smoothed polylines.

// =============================================================== Stage I
// The Siege of Ilion — open plain, gentle shapes, the campaign's tutorial arc.

// I·1 The Landing Beaches — one lazy S from the surf line down the map.
const T1 = { motif: "an S-road from the beach", archetype: "wander", routes: [[
  [620, -8], [600, 70], [460, 115], [300, 100], [150, 140], [95, 245],
  [190, 290], [350, 255], [530, 240], [690, 275], [780, 355], [690, 415],
  [520, 385], [340, 400], [180, 440], [110, 520], [90, 590],
]] };

// I·2 Scamander Ford — a horseshoe that dips to the river and climbs out.
const T2 = { motif: "a horseshoe around the ford", archetype: "wander", routes: [[
  [930, 110], [780, 95], [600, 130], [420, 95], [240, 130], [110, 180],
  [95, 270], [220, 255], [400, 272], [580, 245], [740, 270], [810, 330],
  [720, 395], [540, 372], [355, 405], [300, 480], [330, 590],
]] };

// I·3 The Greek Camp — FORK: two columns march in from the west, one high
// and one low, meet at the far dunes, and the merged army marches back
// through the middle — every stretch of shared road watched from both sides.
const T3_SHARED = [
  [690, 290], [510, 262], [330, 292], [150, 262], [-30, 278],
];
const T3 = { motif: "two beachheads, one road home", archetype: "fork", routes: [
  [[-30, 145], [130, 162], [320, 132], [520, 158], [700, 138], [810, 185], [815, 265], ...T3_SHARED],
  [[-30, 415], [130, 398], [320, 428], [520, 402], [700, 422], [810, 375], [815, 265], ...T3_SHARED],
] };

// I·4 Chryse Road — the first coil: the road wraps the shrine clockwise.
const T4 = { motif: "a coil around the shrine", archetype: "spiral", routes: [[
  [-30, 450], [120, 470], [300, 495], [500, 480], [680, 440], [780, 340],
  [740, 230], [620, 140], [450, 105], [290, 140], [225, 250], [290, 350],
  [430, 380], [555, 340], [580, 250], [480, 218], [425, 268],
]] };

// I·5 Tenedos Strait — a lightning Z across the whole strait.
const T5 = { motif: "a lightning Z", archetype: "wander", routes: [[
  [700, -8], [685, 80], [560, 120], [400, 100], [250, 145], [340, 235],
  [510, 270], [680, 240], [800, 290], [720, 380], [540, 415], [350, 385],
  [180, 420], [100, 500], [80, 590],
]] };

// I·6 The Scaean Gate — FORK: one road splits around the gatehouse hill and
// rejoins before the gate. The island between the arms is prime ground.
const T6_HEAD = [[-30, 455], [130, 480], [270, 445], [288, 342], [330, 285]];
const T6_TAIL = [[720, 290], [790, 245], [828, 325], [788, 412], [858, 478], [930, 505]];
const T6 = { motif: "a pincer around the gate", archetype: "fork", spotAdjust: -1, routes: [
  [...T6_HEAD, [365, 200], [455, 170], [548, 200], [628, 262], [660, 290], ...T6_TAIL],
  [...T6_HEAD, [418, 375], [502, 392], [588, 358], [645, 308], [660, 290], ...T6_TAIL],
] };

// I·7 Ida's Foothills — a G-hook: around the field and deep into its heart.
const T7 = { motif: "a hook into the foothills", archetype: "spiral", spotAdjust: -2, routes: [[
  [930, 120], [780, 90], [600, 75], [415, 105], [240, 150], [140, 255],
  [150, 370], [260, 455], [430, 490], [610, 465], [730, 395], [750, 290],
  [650, 225], [505, 208], [390, 262], [340, 330], [420, 392],
]] };

// I·8 The Burning Ships — a switchback climb from the shore to the heights.
const T8 = { motif: "a switchback climb", archetype: "wander", spotAdjust: -2, routes: [[
  [-30, 480], [120, 462], [290, 435], [360, 348], [310, 262], [400, 195],
  [555, 170], [690, 145], [785, 205], [725, 280], [612, 318], [675, 430],
  [810, 465], [930, 485],
]] };

// I·9 Under the Walls — FORK: sally ports north and west pour onto one road
// that loops the whole field. Short arms, long shared gauntlet.
const T9_SHARED = [
  [300, 285], [450, 255], [600, 290], [750, 260], [830, 325], [770, 415],
  [620, 452], [450, 418], [300, 452], [280, 590],
];
const T9 = { motif: "two sally ports, one gauntlet", archetype: "fork", routes: [
  [[150, -8], [160, 80], [230, 160], [200, 255], ...T9_SHARED],
  [[-30, 400], [100, 380], [190, 330], [200, 255], ...T9_SHARED],
] };

// I·10 The Wooden Horse — the stage finale: a grand serpentine that ends
// dropping through the bottom wall.
const T10 = { motif: "the classic serpentine", archetype: "serpentine", routes: [[
  [-30, 100], [150, 120], [350, 85], [560, 110], [760, 95], [835, 160],
  [765, 235], [560, 222], [350, 245], [150, 220], [85, 300], [150, 375],
  [350, 358], [560, 372], [750, 360], [820, 430], [720, 490], [545, 480],
  [430, 520], [450, 590],
]] };

// ============================================================== Stage II
// The Wilds of Arcadia — river country; rounder, wetter shapes.

// II·1 Olive Terraces — an oxbow: along the river flats and back up top.
const A1 = { motif: "an oxbow through the terraces", archetype: "wander", spotAdjust: -1, routes: [[
  [930, 470], [780, 495], [590, 460], [400, 490], [220, 450], [110, 370],
  [135, 290], [265, 318], [420, 350], [575, 318], [680, 225], [700, 110],
  [590, 70], [470, 110], [430, -8],
]] };

// II·2 Ladon River — the river's own L: down the west bank in switchbacks,
// east along the shallows, and a hooked climb out.
const A2 = { motif: "the river's L, hooked", archetype: "wander", spotAdjust: -2, routes: [[
  [130, -8], [140, 70], [225, 138], [118, 215], [225, 288], [118, 362],
  [190, 438], [330, 478], [440, 395], [560, 458], [690, 472], [795, 438],
  [812, 368], [738, 312], [830, 242], [742, 182], [820, 125], [930, 110],
]] };

// II·3 Erymanthos Pass — FORK: twin creeks fall from the north rim and meet
// mid-field; the merged water winds out along the south shore.
const A3_SHARED = [
  [248, 380], [155, 448], [310, 488], [470, 428], [620, 462], [770, 428], [930, 448],
];
const A3 = { motif: "twin creeks from the rim", archetype: "fork", routes: [
  [[220, -8], [210, 80], [120, 150], [90, 250], [182, 288], [258, 292], [340, 310], ...A3_SHARED],
  [[680, -8], [690, 90], [770, 175], [700, 275], [560, 295], [420, 305], [340, 310], ...A3_SHARED],
] };

// II·4 The Boar's Wallow — a counter-clockwise coil into the wallow.
const A4 = { motif: "a coil into the wallow", archetype: "spiral", routes: [[
  [930, 105], [790, 80], [610, 70], [420, 95], [250, 140], [150, 240],
  [130, 355], [230, 445], [400, 485], [580, 460], [700, 395], [720, 285],
  [630, 205], [490, 185], [370, 225], [330, 320], [420, 375], [500, 340],
]] };

// II·5 Stymphalian Marsh — the marsh road doubles back twice, three lazy
// passes between the pools.
const A5 = { motif: "a road that doubles back twice", archetype: "wander", routes: [[
  [-30, 430], [110, 455], [270, 420], [420, 450], [560, 415], [680, 450],
  [790, 405], [820, 310], [700, 270], [540, 300], [380, 265], [220, 295],
  [95, 255], [130, 160], [290, 130], [450, 160], [610, 125], [750, 160],
  [850, 120], [930, 105],
]] };

// II·6 Lykaion Slopes — FORK: the road splits around a mountain tarn, arms
// west and east, and slips out through the southwest woods.
const A6_HEAD = [[760, -8], [745, 85], [820, 160], [740, 230], [610, 195], [478, 138], [400, 200]];
const A6_TAIL = [[330, 478], [215, 498], [100, 452], [-30, 428]];
const A6 = { motif: "a split around the tarn", archetype: "fork", routes: [
  [...A6_HEAD, [300, 245], [272, 332], [390, 420], ...A6_TAIL],
  [...A6_HEAD, [505, 285], [515, 355], [455, 410], [390, 420], ...A6_TAIL],
] };

// II·7 The Centaur Fords — the mirrored hook: along the south shore, up the
// far bank, and inward to the ford.
const A7 = { motif: "a hook to the ford", archetype: "spiral", spotAdjust: -1, routes: [[
  [-30, 460], [130, 490], [320, 460], [510, 490], [680, 450], [780, 360],
  [800, 245], [720, 150], [570, 95], [400, 80], [240, 120], [180, 220],
  [240, 320], [380, 360], [500, 330], [540, 240], [460, 185], [370, 218],
]] };

// II·8 Cave of the Lion — a hard zigzag down the gorge to the cave mouth.
const A8 = { motif: "a zigzag down the gorge", archetype: "wander", spotAdjust: -1, routes: [[
  [470, -8], [460, 70], [340, 105], [215, 175], [255, 275], [385, 315],
  [530, 280], [655, 215], [730, 305], [665, 415], [520, 455], [370, 440],
  [245, 485], [290, 590],
]] };

// II·9 Alpheios Gorge — TRIDENT: three trails off the ridge merge in pairs,
// then the full hunt pours down one river road.
const A9_AB = [[470, 200], [520, 260]];
const A9_SHARED = [
  [640, 225], [760, 255], [820, 340], [750, 425], [620, 455], [550, 530], [620, 590],
];
// Three routes dilute the per-route exposure past what geometry recovers,
// and that is the point — the two tridents (here and Gates of Olympus) sit
// at the fork band's floor as each arc's deliberate hardest map.
const A9 = { motif: "three trails become one", archetype: "fork", spotAdjust: -4, routes: [
  [[-30, 80], [130, 105], [290, 70], [380, 120], [420, 175], ...A9_AB, ...A9_SHARED],
  [[-30, 250], [140, 270], [300, 235], [380, 205], [420, 175], ...A9_AB, ...A9_SHARED],
  [[-30, 430], [150, 455], [330, 420], [450, 330], [520, 260], ...A9_SHARED],
] };

// II·10 The Hunt's End — finale: a VERTICAL serpentine, five columns of
// forest road, read top-to-bottom like a waterfall.
const A10 = { motif: "the vertical serpentine", archetype: "serpentine", routes: [[
  [120, -8], [105, 90], [140, 220], [100, 350], [145, 465], [250, 490],
  [290, 395], [255, 265], [295, 140], [350, 70], [450, 90], [430, 215],
  [465, 345], [425, 470], [520, 490], [600, 430], [575, 300], [610, 170],
  [580, 80], [680, 70], [760, 130], [730, 260], [770, 390], [740, 480],
  [845, 485], [880, 420], [930, 400],
]] };

// ============================================================= Stage III
// Beneath Knossos — snowbound; angular, rectilinear, labyrinthine shapes.

// III·1 Harbour of Amnisos — a great C around the bay, dipping to the quay.
const L1 = { motif: "a horseshoe with a quay lip", archetype: "wander", routes: [[
  [930, 472], [780, 452], [610, 486], [445, 470], [270, 484], [140, 438],
  [88, 330], [148, 232], [90, 142], [185, 78], [350, 105], [520, 70],
  [690, 100], [810, 145], [762, 232], [625, 255], [480, 228], [352, 258],
  [282, 330], [348, 360], [500, 345], [650, 360], [790, 345], [930, 362],
]] };

// III·2 Palace Steps — a staircase descending west, step by frozen step.
const L2 = { motif: "a staircase down the palace", archetype: "wander", spotAdjust: -1, routes: [[
  [930, 70], [780, 62], [620, 88], [720, 195], [600, 235], [490, 185],
  [420, 258], [500, 322], [400, 390], [268, 352], [185, 428], [255, 492],
  [230, 590],
]] };

// III·3 The Bronze Doors — FORK: two doors in the north wall, roads that
// curve together at once, then a long shared coil through the halls.
const L3_SHARED = [
  [400, 270], [295, 330], [255, 430], [365, 480], [520, 450], [645, 485],
  [765, 440], [815, 340], [750, 250], [825, 165], [930, 140],
];
const L3 = { motif: "two doors, one long hall", archetype: "fork", spotAdjust: -2, routes: [
  [[280, -8], [275, 70], [330, 140], [400, 180], [420, 195], ...L3_SHARED],
  [[560, -8], [565, 70], [505, 140], [440, 180], [420, 195], ...L3_SHARED],
] };

// III·4 First Turning — a RECTANGULAR spiral; the labyrinth proper begins.
const L4 = { motif: "a squared spiral", archetype: "spiral", spotAdjust: -3, routes: [[
  [380, -8], [370, 75], [220, 90], [110, 150], [95, 290], [110, 420],
  [230, 480], [420, 455], [610, 485], [760, 430], [790, 300], [770, 170],
  [640, 115], [500, 150], [460, 260], [500, 350], [600, 372], [660, 300],
]] };

// III·5 Hall of Double Axes — three axe-strokes in a row, blade after blade.
const L5 = { motif: "axes in a row", archetype: "wander", spotAdjust: -1, routes: [[
  [-30, 200], [90, 155], [168, 245], [193, 370], [245, 455], [318, 368],
  [330, 245], [400, 162], [468, 245], [488, 370], [540, 455], [613, 368],
  [625, 245], [695, 162], [765, 245], [788, 368], [838, 440], [930, 455],
]] };

// III·6 The Sunken Cistern — FORK: the road splits at the cistern; the north
// arm zigzags the catwalks, the south arm arcs the drowned floor. Same
// length, utterly different shape.
const L6_HEAD = [[-30, 80], [140, 68], [300, 112], [368, 188], [390, 240]];
const L6_TAIL = [[790, 330], [815, 415], [735, 480], [595, 500], [450, 472], [385, 525], [430, 590]];
const L6 = { motif: "catwalks or the drowned floor", archetype: "fork", spotAdjust: -3, routes: [
  [...L6_HEAD, [465, 195], [555, 245], [645, 205], [715, 265], [730, 290], ...L6_TAIL],
  [...L6_HEAD, [420, 325], [535, 368], [645, 372], [712, 318], [730, 290], ...L6_TAIL],
] };

// III·7 Ariadne's Thread — the longest road in the game: a full ring, a
// second coil, and the thread's end in a chamber low in the west.
const L7 = { motif: "the wound thread", archetype: "spiral", routes: [[
  [170, -8], [175, 75], [400, 65], [650, 80], [800, 130], [820, 290],
  [770, 430], [600, 490], [380, 475], [180, 455], [105, 340], [130, 215],
  [300, 185], [500, 200], [650, 235], [690, 330], [610, 380], [460, 370],
  [350, 330],
]] };

// III·8 The Deep Coil — a vertical S with a hooked crown: up from the depths,
// around the gallery, out the top.
const L8 = { motif: "an S out of the depths", archetype: "wander", spotAdjust: -2, routes: [[
  [430, 590], [445, 505], [335, 460], [245, 370], [300, 255], [430, 225],
  [560, 275], [655, 370], [762, 412], [828, 335], [798, 225], [685, 175],
  [560, 115], [430, 82], [300, 112], [250, -8],
]] };

// III·9 Forge of Talos — FORK: fire doors east; two roads sweep the whole
// width, meet at the west wall, and march back through the middle.
const L9_SHARED = [
  [185, 295], [330, 270], [500, 300], [670, 270], [800, 300], [930, 290],
];
const L9 = { motif: "a pincer to the west wall", archetype: "fork", spotAdjust: -2, routes: [
  [[930, 105], [780, 128], [600, 95], [420, 122], [250, 100], [120, 148], [95, 215], [95, 280], ...L9_SHARED],
  [[930, 455], [780, 432], [600, 462], [420, 435], [250, 458], [125, 412], [95, 345], [95, 280], ...L9_SHARED],
] };

// III·10 The Heart of the Maze — finale: a serpentine whose last lane breaks
// into a jog, because no hall in this place runs true.
const L10 = { motif: "the broken serpentine", archetype: "serpentine", routes: [[
  [930, 95], [770, 115], [570, 80], [370, 110], [170, 85], [85, 165],
  [160, 240], [360, 258], [540, 225], [740, 250], [830, 320], [750, 390],
  [560, 362], [408, 385], [220, 380], [95, 420], [150, 495], [325, 492],
  [500, 505], [560, 590],
]] };

// ============================================================= Stage IV
// The House of Hades — ash and grey stone; long, mournful lines.

// IV·1 The Grey Shore — three tilted sweeps along the shore of the dead.
const H1 = { motif: "the tilted shore road", archetype: "wander", routes: [[
  [-30, 480], [140, 455], [320, 490], [500, 445], [680, 470], [800, 420],
  [830, 320], [700, 290], [520, 330], [340, 285], [160, 320], [90, 240],
  [160, 155], [340, 180], [520, 125], [700, 155], [820, 105], [930, 90],
]] };

// IV·2 Charon's Crossing — one weaving crossing, north bank to south.
const H2 = { motif: "the ferry's weave", archetype: "wander", spotAdjust: -3, routes: [[
  [450, -8], [445, 75], [330, 115], [240, 200], [280, 300], [400, 345],
  [540, 320], [635, 245], [700, 148], [768, 248], [780, 355], [700, 445],
  [555, 470], [400, 452], [255, 488], [145, 445], [-30, 460],
]] };

// IV·3 Fields of Asphodel — FORK: the west road and the north road meet
// among the asphodel and wander out together past the pools.
const H3_SHARED = [
  [500, 270], [640, 238], [765, 285], [805, 385], [705, 458], [545, 430],
  [400, 472], [280, 520], [250, 590],
];
const H3 = { motif: "west road meets north road", archetype: "fork", spotAdjust: -3, routes: [
  [[-30, 260], [120, 228], [255, 268], [350, 232], [410, 240], ...H3_SHARED],
  [[430, -8], [425, 75], [340, 130], [400, 190], [410, 240], ...H3_SHARED],
] };

// IV·4 The Weeping Gate — a counter-clockwise coil rising to the gate.
const H4 = { motif: "a coil up to the gate", archetype: "spiral", routes: [[
  [720, 590], [710, 490], [790, 395], [770, 270], [680, 165], [540, 95],
  [370, 80], [210, 130], [120, 250], [140, 380], [250, 460], [400, 490],
  [540, 450], [600, 345], [540, 250], [420, 215], [320, 270], [350, 360],
  [455, 375],
]] };

// IV·5 Kennels of Cerberus — three hairpin rows and a long tail west: the
// dog's leash, folded.
const H5 = { motif: "the folded leash", archetype: "wander", routes: [[
  [760, -8], [755, 75], [620, 95], [460, 120], [380, 190], [450, 250],
  [620, 228], [790, 255], [838, 330], [770, 388], [600, 362], [440, 392],
  [330, 450], [180, 478], [-30, 455],
]] };

// IV·6 Lethe's Bank — FORK, twice: the road splits and rejoins around two
// islands in the river of forgetting. The only double diamond in the game.
const H6_HEAD = [[-30, 120], [110, 90], [200, 140], [240, 180]];
const H6_MID = [[420, 180], [500, 220], [560, 260]];
const H6_TAIL = [
  [790, 295], [835, 372], [790, 455], [635, 490], [480, 458], [330, 492],
  [170, 458], [-30, 478],
];
// The double diamond sits near the fork band's floor for the same reason
// the tridents do: the two routes disagree across BOTH islands, so the
// per-route average drops below what a single-split fork can reach.
// Deliberately the hardest shape of stage IV.
const H6 = { motif: "twice around the islands", archetype: "fork", spotAdjust: -3, routes: [
  [...H6_HEAD, [300, 110], [390, 150], ...H6_MID, [650, 205], [745, 240], ...H6_TAIL],
  [...H6_HEAD, [300, 250], [390, 210], ...H6_MID, [590, 360], [700, 385], [755, 352], ...H6_TAIL],
] };

// IV·7 The Judgement Hall — a great G around the hall, entering from above.
const H7 = { motif: "a hook around the hall", archetype: "spiral", spotAdjust: -2, routes: [[
  [560, -8], [555, 70], [400, 60], [240, 85], [120, 160], [90, 290],
  [130, 415], [260, 480], [430, 500], [600, 470], [720, 420], [790, 320],
  [740, 215], [620, 170], [500, 210], [470, 310], [560, 368], [645, 315],
]] };

// IV·8 Erebos Deep — sweeps and an undertow curl through the dark.
const H8 = { motif: "the undertow", archetype: "wander", spotAdjust: -2, routes: [[
  [-30, 100], [140, 75], [330, 110], [520, 80], [700, 110], [815, 165],
  [765, 262], [580, 245], [400, 275], [245, 320], [140, 395], [215, 455],
  [380, 430], [550, 462], [720, 432], [930, 455],
]] };

// IV·9 Tartarus Rim — FORK: roads in from BOTH sides of the pit meet at the
// centre and descend the rim together.
const H9_SHARED = [
  [480, 285], [365, 335], [300, 435], [425, 488], [570, 455], [665, 385],
  [705, 470], [690, 590],
];
const H9 = { motif: "both rims into the pit", archetype: "fork", spotAdjust: -2, routes: [
  [[-30, 165], [130, 135], [300, 175], [440, 145], [510, 195], ...H9_SHARED],
  [[930, 175], [790, 145], [640, 183], [545, 155], [510, 195], ...H9_SHARED],
] };

// IV·10 Throne of the Unseen — finale: three lanes, then the road coils off
// the last lane into the throne's antechamber.
const H10 = { motif: "the serpentine that coils", archetype: "serpentine", routes: [[
  [-30, 85], [150, 108], [350, 75], [560, 105], [760, 80], [840, 150],
  [772, 225], [560, 248], [350, 218], [150, 250], [85, 330], [148, 420],
  [300, 455], [470, 445], [650, 462], [795, 428], [830, 345], [748, 338],
  [628, 352], [590, 352],
]] };

// ============================================================== Stage V
// The Wrath of Olympus — scorched black rock; grand, violent geometry.

// V·1 Foot of Othrys — two and a half sweeps of lava plain, exiting skyward.
const O1 = { motif: "sweeps of the burnt plain", archetype: "wander", routes: [[
  [930, 470], [770, 445], [570, 485], [380, 448], [190, 480], [95, 395],
  [165, 318], [360, 290], [560, 330], [755, 295], [838, 215], [762, 140],
  [560, 168], [360, 132], [165, 162], [90, 90], [110, -8],
]] };

// V·2 The Shattered Plain — the crater road: a ring around the impact, then
// a fatal spiral down into it.
const O2 = { motif: "a ring, then the crater", archetype: "spiral", routes: [[
  [-30, 300], [85, 285], [150, 210], [255, 128], [405, 88], [565, 102],
  [695, 172], [748, 290], [700, 398], [568, 462], [408, 468], [292, 415],
  [258, 325], [310, 247], [395, 205], [500, 198], [578, 272], [545, 352],
  [448, 362], [395, 318],
]] };

// V·3 Titan's Causeway — FORK: two causeways climb from the south chasm and
// fuse into one road along the storm wall.
const O3_SHARED = [
  [430, 220], [510, 150], [650, 120], [790, 150], [835, 240], [805, 330],
  [870, 400], [930, 415],
];
const O3 = { motif: "two causeways fuse", archetype: "fork", spotAdjust: -5, routes: [
  [[240, 590], [225, 495], [130, 455], [95, 352], [185, 282], [320, 295], [430, 302], ...O3_SHARED],
  [[660, 590], [672, 500], [720, 438], [680, 322], [580, 290], [430, 302], ...O3_SHARED],
] };

// V·4 Cloudbreak — an oval spiral, coils stretched thin like cloud bands.
const O4 = { motif: "the stretched spiral", archetype: "spiral", routes: [[
  [-30, 95], [160, 70], [400, 60], [640, 85], [790, 140], [832, 250],
  [772, 362], [620, 438], [400, 462], [200, 430], [118, 332], [172, 238],
  [330, 198], [520, 212], [655, 262], [648, 322], [520, 340], [425, 312],
]] };

// V·5 The Bronze Stair — the long climb: a sweep along the base of the
// mountain, then flight after flight to the peak gate.
const O5 = { motif: "the long climb", archetype: "wander", routes: [[
  [930, 470], [795, 445], [640, 485], [480, 450], [330, 485], [175, 452],
  [92, 375], [168, 305], [330, 335], [490, 300], [640, 332], [755, 292],
  [790, 195], [690, 135], [560, 170], [430, 135], [300, 170], [190, 120],
  [210, -8],
]] };

// V·6 Hephaestus' Anvil — FORK: the road forks around the anvil itself;
// hammer arm north, tong arm south, and a white-hot hairpin out.
const O6_HEAD = [[380, 590], [390, 500], [310, 440], [338, 352], [360, 330]];
const O6_TAIL = [[612, 98], [700, 92], [790, 155], [815, 255], [745, 340], [795, 425], [930, 450]];
const O6 = { motif: "around the anvil", archetype: "fork", spotAdjust: -3, routes: [
  [...O6_HEAD, [255, 290], [235, 190], [330, 130], [450, 140], [520, 160], ...O6_TAIL],
  [...O6_HEAD, [475, 345], [590, 300], [622, 222], [520, 160], ...O6_TAIL],
] };

// V·7 The Aegis Wall — the road threads the gaps in a shattered wall: a
// square-toothed weave, unlike any other zigzag in the campaign.
const O7 = { motif: "threading the wall gaps", archetype: "wander", spotAdjust: -5, routes: [[
  [-30, 275], [105, 268], [172, 158], [268, 118], [315, 222], [352, 345],
  [442, 420], [490, 315], [522, 200], [640, 148], [688, 235], [668, 358],
  [775, 438], [930, 458],
]] };

// V·8 Storm of Zeus — a doubled thunderbolt hurled down the map.
const O8 = { motif: "the doubled bolt", archetype: "wander", spotAdjust: -1, routes: [[
  [350, -8], [360, 70], [470, 105], [600, 80], [690, 150], [560, 195],
  [420, 230], [290, 280], [372, 362], [535, 372], [660, 420], [568, 492],
  [420, 512], [380, 590],
]] };

// V·9 Gates of Olympus — TRIDENT: three legions in from the east, merging
// west, and the merged storm breaks out the south-west gate.
const O9_AB = [[365, 250], [340, 290]];
const O9_SHARED = [[245, 318], [150, 378], [196, 462], [340, 498], [430, 590]];
// The campaign's second trident — see Alpheios Gorge for why it lives at
// the fork band's floor.
const O9 = { motif: "three legions, one gate", archetype: "fork", spotAdjust: -6, routes: [
  [[930, 80], [790, 104], [620, 72], [490, 110], [415, 205], ...O9_AB, ...O9_SHARED],
  [[930, 255], [785, 275], [615, 240], [480, 215], [415, 205], ...O9_AB, ...O9_SHARED],
  [[930, 430], [780, 405], [610, 445], [460, 405], [380, 330], [340, 290], ...O9_SHARED],
] };

// V·10 Typhon Unbound — the last road: four full lanes of serpentine that
// funnel, lane by lane, down to the final gate.
const O10 = { motif: "the funnelling serpentine", archetype: "serpentine", routes: [[
  [-30, 85], [150, 108], [350, 72], [560, 102], [755, 78], [838, 150],
  [772, 222], [560, 240], [350, 208], [160, 242], [92, 318], [158, 390],
  [350, 368], [545, 392], [712, 370], [782, 442], [688, 478], [540, 498],
  [380, 470], [300, 538], [310, 590],
]] };

// ------------------------------------------------------------------ table
// Indexed 0..49, same flat order as LEVELS.
export const LAYOUTS = [
  T1, T2, T3, T4, T5, T6, T7, T8, T9, T10,
  A1, A2, A3, A4, A5, A6, A7, A8, A9, A10,
  L1, L2, L3, L4, L5, L6, L7, L8, L9, L10,
  H1, H2, H3, H4, H5, H6, H7, H8, H9, H10,
  O1, O2, O3, O4, O5, O6, O7, O8, O9, O10,
];
