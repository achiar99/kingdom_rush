// The set dressing: a fitted-stone road, and the trees, rocks, ruins and urns
// scattered across the ground beside it.
//
// None of this moves, so it is painted ONCE per level into an offscreen canvas
// (see terrain.js) and blitted from then on. That's what pays for the detail —
// five hundred individually-shaded flagstones would be far too expensive to
// redraw sixty times a second, and cost nothing to draw once.
//
// Every position here is derived from a seed, never Math.random(), so a level
// looks the same every time you play it.
import { CONFIG } from "../config.js";
import { dist, pathLength, pointAtDistance, nearestPointOnPath } from "../geometry.js";

const W = CONFIG.width, H = CONFIG.height;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- road
// Greek roads were fitted polygonal stone, not a smooth ribbon, so the road is
// drawn as individual slabs following the local tangent — three across the
// width, each with its own tint and a mortar gap around it. Because they're
// oriented to the curve, the paving bends with the road instead of tiling over
// the top of it.
// The road: a broad dirt swathe with a ragged grass fringe, the Kingdom Rush
// silhouette. Three things make that read, and the old paved ribbon had none
// of them: real WIDTH (a swathe, not a lane), an IRREGULAR edge — the width
// breathes along the route and grass tufts bite into it, so no stretch of
// verge is a clean spline — and a soft inner highlight where feet have worn
// the middle. All of it still tints from the theme, so snow roads stay
// grey-blue and Othrys roads stay ash.
//
// Built as offset polygons from dense samples rather than strokes, because a
// stroke has one width for its whole length and the whole point is that this
// road doesn't.
export function paveRoad(g, path, theme, widthScale = 1) {
  const len = pathLength(path);
  const STEP = 9;

  // Deterministic per-route phase so two routes on a fork don't wobble in sync.
  const ph = (path[0].x * 13.37 + path[0].y * 7.91) % 6.283;
  // 26px half-width. At 30 the swathe plus its fringe painted ~74px, and the
  // wander generator only guarantees ~85px between corridors — parallel roads
  // visibly merged into sand lakes. Width has to respect the generator's
  // clearance floor, not just the reference art. `widthScale` extends the same
  // rule to the other shapes: fork and serpentine lanes run as close as ~45px,
  // so those maps paint the road at 0.72 of this.
  const halfW = (d) =>
    26 * widthScale *
    (1 + 0.10 * Math.sin(d * 0.021 + ph) + 0.07 * Math.sin(d * 0.049 + ph * 2.7));

  // sample centreline + normals once
  const C = [], N = [], WD = [];
  for (let d = 0; d <= len; d += STEP) {
    const p = pointAtDistance(path, len, d);
    const q = pointAtDistance(path, len, Math.min(len, d + 4));
    const dx = q.x - p.x, dy = q.y - p.y;
    const m = Math.hypot(dx, dy) || 1;
    C.push(p);
    N.push({ x: -dy / m, y: dx / m });
    WD.push(halfW(d));
  }

  const ribbon = (scale, extra = 0) => {
    g.beginPath();
    for (let i = 0; i < C.length; i++) {
      const w = WD[i] * scale + extra;
      const x = C[i].x + N[i].x * w, y = C[i].y + N[i].y * w;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    for (let i = C.length - 1; i >= 0; i--) {
      const w = WD[i] * scale + extra;
      g.lineTo(C[i].x - N[i].x * w, C[i].y - N[i].y * w);
    }
    g.closePath();
  };

  // dark grass fringe, then the dirt body, then the worn middle
  g.fillStyle = mix(theme.grass[1], "#000000", 0.25);
  ribbon(1, 5.5);
  g.fill();
  g.fillStyle = theme.path.rim;
  ribbon(1, 1.5);
  g.fill();
  g.fillStyle = theme.path.body;
  ribbon(1);
  g.fill();
  g.globalAlpha = 0.5;
  g.fillStyle = theme.path.track;
  ribbon(0.52);
  g.fill();
  g.globalAlpha = 1;

  // grass tufts biting into the verge — the scalloped edge that makes it read
  // as ground and not as a drawn line
  const rand = rng(9173 + ((path[0].x | 0) << 3));
  g.fillStyle = theme.grass[1];
  for (let i = 2; i < C.length - 2; i += 2) {
    if (rand() < 0.35) continue;
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const w = WD[i] + 4;
      const tx = C[i].x + N[i].x * w * side + (rand() - 0.5) * 4;
      const ty = C[i].y + N[i].y * w * side + (rand() - 0.5) * 4;
      const rr = 2.5 + rand() * 4.5;
      g.beginPath();
      // squash the tuft along the road direction so the edge scallops
      g.ellipse(tx, ty, rr * 1.5, rr, Math.atan2(N[i].x, -N[i].y), 0, Math.PI * 2);
      g.fill();
    }
  }

  // speckles and the odd pebble worn into the dirt
  for (let i = 1; i < C.length - 1; i += 3) {
    if (rand() < 0.4) continue;
    const off = (rand() * 2 - 1) * WD[i] * 0.7;
    const px = C[i].x + N[i].x * off, py = C[i].y + N[i].y * off;
    if (rand() < 0.85) {
      g.fillStyle = `rgba(70,50,26,${0.10 + rand() * 0.12})`;
      g.beginPath();
      g.arc(px, py, 1.2 + rand() * 2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = mix(theme.path.rim, "#888078", 0.5);
      g.beginPath();
      g.ellipse(px, py, 2.6, 1.8, rand() * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.beginPath();
      g.arc(px - 0.7, py - 0.6, 0.9, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// A build spot's ground: a bare dirt patch off the road, fringed like the road
// itself. Painted into the cached scenery — a tower built later simply stands
// on its patch, which is exactly how it should look.
export function dirtPatch(g, x, y, theme, seed) {
  const rand = rng(seed * 7919 + 13);
  const rot = rand() * 3.14;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const blob = (rx, ry, colour, alpha = 1) => {
    g.globalAlpha = alpha;
    g.fillStyle = colour;
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 5 + seed * 2);
      const px = Math.cos(a) * rx * wob, py = Math.sin(a) * ry * wob;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  };
  blob(27, 21, mix(theme.grass[1], "#000000", 0.25));
  blob(24.5, 18.5, theme.path.rim);
  blob(22, 16, theme.path.body);
  blob(13, 9, theme.path.track, 0.45);
  g.fillStyle = `rgba(70,50,26,0.14)`;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc((rand() - 0.5) * 30, (rand() - 0.5) * 20, 1.2 + rand() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ------------------------------------------------------------------ props// ------------------------------------------------------------------ props
// Each is drawn at its own scale around (0,0) with the ground line at y=0, so
// the scatter below can place them without knowing anything about them.

function shadow(g, rx, ry) {
  const rad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  rad.addColorStop(0, "rgba(0,0,0,0.32)");
  rad.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.scale(1, ry / rx);
  g.fillStyle = rad;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function cypress(g, s, r) {
  shadow(g, 9 * s, 4 * s);
  g.fillStyle = "#3b2a18";
  g.fillRect(-1.4 * s, -6 * s, 2.8 * s, 6 * s);
  // a tight dark flame shape, built from three stacked lobes
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const cy = -10 * s - i * 11 * s;
    const rx = (8.5 - i * 2.2) * s;
    const ry = (12 - i * 2) * s;
    const grad = g.createLinearGradient(-rx, cy, rx, cy);
    grad.addColorStop(0, i ? "#1f3a24" : "#25452b");
    grad.addColorStop(0.5, "#2f5a38");
    grad.addColorStop(1, "#182c1d");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    void t; void r;
  }
}

// A conifer under snow. The snow stages were being dressed with the same green
// cypresses as the olive groves, which looked like summer trees planted in a
// blizzard.
function snowPine(g, s, r) {
  shadow(g, 10 * s, 4 * s);
  g.fillStyle = "#3a2d20";
  g.fillRect(-1.5 * s, -5 * s, 3 * s, 5 * s);
  for (let i = 0; i < 3; i++) {
    const cy = -7 * s - i * 10 * s;
    const hw = (11 - i * 2.6) * s;
    const hh = (13 - i * 1.6) * s;
    g.fillStyle = i ? "#2c4048" : "#33484f";              // cold, desaturated
    g.beginPath();
    g.moveTo(0, cy - hh);
    g.lineTo(hw, cy + hh * 0.35);
    g.lineTo(-hw, cy + hh * 0.35);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.82)";               // snow load on top
    g.beginPath();
    g.moveTo(0, cy - hh);
    g.lineTo(hw * 0.62, cy - hh * 0.1);
    g.lineTo(hw * 0.22, cy - hh * 0.2);
    g.lineTo(0, cy - hh * 0.02);
    g.lineTo(-hw * 0.3, cy - hh * 0.16);
    g.lineTo(-hw * 0.62, cy - hh * 0.1);
    g.closePath();
    g.fill();
  }
  void r;
}

// A shard of cooled lava, for the one stage where nothing grows.
function obsidian(g, s, r) {
  shadow(g, 11 * s, 4 * s);
  const h = (14 + (r % 1) * 8) * s;
  g.beginPath();
  g.moveTo(-6 * s, 0);
  g.lineTo(-2.4 * s, -h);
  g.lineTo(2.2 * s, -h * 0.78);
  g.lineTo(7 * s, 0);
  g.closePath();
  const grad = g.createLinearGradient(-6 * s, -h, 7 * s, 0);
  grad.addColorStop(0, "#3a3040");
  grad.addColorStop(0.5, "#241d2a");
  grad.addColorStop(1, "#15111a");
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = "rgba(255,140,70,0.55)";                // ember caught in it
  g.lineWidth = 1.2 * s;
  g.beginPath();
  g.moveTo(-2 * s, -h * 0.7);
  g.lineTo(0.6 * s, -h * 0.3);
  g.stroke();
}

function oliveTree(g, s, r) {
  shadow(g, 17 * s, 6 * s);
  // gnarled forked trunk
  g.strokeStyle = "#5c4630";
  g.lineWidth = 3.4 * s;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-1.5 * s, -9 * s);
  g.moveTo(-1.5 * s, -9 * s);
  g.lineTo(-6 * s, -15 * s);
  g.moveTo(-1.5 * s, -9 * s);
  g.lineTo(4 * s, -16 * s);
  g.stroke();
  // silvery canopy — several soft blobs, olive green over grey
  const blobs = [[-7, -19, 10], [4, -20, 11], [-1, -25, 9], [9, -15, 7], [-11, -13, 7]];
  blobs.forEach(([bx, by, br], i) => {
    const grad = g.createRadialGradient(bx * s - br * 0.3 * s, by * s - br * 0.4 * s, 1,
                                        bx * s, by * s, br * s);
    grad.addColorStop(0, "#9fb08a");
    grad.addColorStop(0.6, "#6f8659");
    grad.addColorStop(1, "#42552f");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(bx * s, by * s, br * s, br * 0.86 * s, i * 0.4 + r, 0, Math.PI * 2);
    g.fill();
  });
}

function deadTree(g, s) {
  shadow(g, 13 * s, 5 * s);
  g.strokeStyle = "#4a4048";
  g.lineCap = "round";
  g.lineWidth = 3.6 * s;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1 * s, -18 * s);
  g.stroke();
  g.lineWidth = 2 * s;
  for (const [dx, dy] of [[-9, -26], [8, -28], [-5, -32], [6, -22]]) {
    g.beginPath();
    g.moveTo(1 * s, -17 * s);
    g.quadraticCurveTo(dx * 0.5 * s, dy * 0.7 * s, dx * s, dy * s);
    g.stroke();
  }
}

function rock(g, s, r) {
  shadow(g, 13 * s, 5 * s);
  const lobes = [[0, -6, 11, 8], [-8, -3, 7, 5], [7, -4, 6, 5]];
  for (const [bx, by, rx, ry] of lobes) {
    const grad = g.createLinearGradient(bx * s, (by - ry) * s, bx * s, (by + ry) * s);
    grad.addColorStop(0, "#b9b3a6");
    grad.addColorStop(0.55, "#8b8578");
    grad.addColorStop(1, "#565045");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(bx * s, by * s, rx * s, ry * s, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
}

// A fallen column: fluted drum lying on its side, with the broken stub of
// its base still standing. Ruins are the cheapest way to say "Greece".
function brokenColumn(g, s, r) {
  shadow(g, 20 * s, 6 * s);
  // the fallen drum
  g.save();
  g.rotate(-0.16 + r * 0.3);
  const grad = g.createLinearGradient(0, -9 * s, 0, 5 * s);
  grad.addColorStop(0, "#f2ece0");
  grad.addColorStop(0.6, "#cfc7b6");
  grad.addColorStop(1, "#948d7d");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(-19 * s, -8 * s, 38 * s, 12 * s, 3 * s);
  g.fill();
  // flutes
  g.strokeStyle = "rgba(120,112,96,0.5)";
  g.lineWidth = 1 * s;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(-17 * s, i * 2.4 * s);
    g.lineTo(17 * s, i * 2.4 * s);
    g.stroke();
  }
  // the drum's end face
  g.fillStyle = "#e6dfd0";
  g.beginPath();
  g.ellipse(-19 * s, -2 * s, 3 * s, 6.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // standing stub behind it
  g.fillStyle = "#bdb5a4";
  g.beginPath();
  g.roundRect(14 * s, -20 * s, 13 * s, 20 * s, 2 * s);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(15 * s, -20 * s, 3 * s, 19 * s);
}

// A standing votive column with a simple Doric capital.
function votiveColumn(g, s) {
  shadow(g, 12 * s, 5 * s);
  const grad = g.createLinearGradient(-7 * s, 0, 7 * s, 0);
  grad.addColorStop(0, "#8f887a");
  grad.addColorStop(0.35, "#f4efe3");
  grad.addColorStop(1, "#a9a294");
  g.fillStyle = grad;
  g.fillRect(-6 * s, -34 * s, 12 * s, 34 * s);
  g.strokeStyle = "rgba(120,112,96,0.45)";
  g.lineWidth = 0.9 * s;
  for (const fx of [-3, 0, 3]) {
    g.beginPath();
    g.moveTo(fx * s, -32 * s);
    g.lineTo(fx * s, -2 * s);
    g.stroke();
  }
  g.fillStyle = "#efe9dc";                              // capital
  g.fillRect(-9 * s, -39 * s, 18 * s, 5 * s);
  g.fillStyle = "#cfc7b6";                              // base
  g.fillRect(-8.5 * s, -3 * s, 17 * s, 3 * s);
}

function amphora(g, s) {
  shadow(g, 9 * s, 4 * s);
  const grad = g.createLinearGradient(-7 * s, -18 * s, 7 * s, 0);
  grad.addColorStop(0, "#c8763f");
  grad.addColorStop(0.5, "#a4552a");
  grad.addColorStop(1, "#6b3418");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-2 * s, 0);
  g.quadraticCurveTo(-9 * s, -8 * s, -6 * s, -17 * s);
  g.quadraticCurveTo(0, -22 * s, 6 * s, -17 * s);
  g.quadraticCurveTo(9 * s, -8 * s, 2 * s, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3d1d0c";                            // handles + black-figure band
  g.lineWidth = 1.4 * s;
  g.beginPath();
  g.arc(-6.5 * s, -16 * s, 3 * s, -1.2, 1.6);
  g.moveTo(6.5 * s, -13 * s);
  g.arc(6.5 * s, -16 * s, 3 * s, 1.6, -1.2, true);
  g.stroke();
  g.fillStyle = "rgba(30,14,6,0.65)";
  g.fillRect(-6 * s, -12 * s, 12 * s, 2.4 * s);
}

function shrub(g, s, r) {
  shadow(g, 9 * s, 3.5 * s);
  for (const [bx, by, br] of [[0, -7, 8], [-5, -4, 5.5], [5, -5, 6]]) {
    const grad = g.createRadialGradient(bx * s - 2 * s, by * s - 3 * s, 1, bx * s, by * s, br * s);
    grad.addColorStop(0, "#87a065");
    grad.addColorStop(1, "#3d4f28");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(bx * s, by * s, br * s, br * 0.8 * s, r, 0, Math.PI * 2);
    g.fill();
  }
}

const PROP_FNS = {
  cypress, oliveTree, deadTree, rock, brokenColumn, votiveColumn, amphora, shrub,
  snowPine, obsidian,
};

// What grows where, split by how it wants to be placed.
//
// `canopy` clumps — trees grow in groves, and a grove of four reads as
// landscape where four evenly-spaced trees read as wallpaper. `rocks` come in
// small outcrops. `features` are the single memorable objects (a toppled
// column, an abandoned pot) and are placed near the road, because that's the
// only place a pot has any business being.
//
// These follow the BIOME each stage is set in (see THEMES in data/stages.js),
// not just its name. Getting that wrong is very visible: the snow stages were
// dressed with the same green cypresses as the olive groves, and the scorched
// black rock of Othrys had flowering shrubs on it.
const PROP_MIX = {
  // I — open grass: olives, cypress, dry scrub
  troy:      { canopy: ["oliveTree", "oliveTree", "cypress", "shrub"], features: ["amphora", "brokenColumn"] },
  // II — deep woodland: trees everywhere, and more of them
  arcadia:   { canopy: ["cypress", "cypress", "oliveTree", "shrub"],   features: ["brokenColumn", "deadTree"] },
  // III — snow: laden pines and bare rock, nothing in leaf
  labyrinth: { canopy: ["snowPine", "snowPine", "rock"],               features: ["brokenColumn", "votiveColumn"] },
  // IV — grey rock: dead wood and stone only
  hades:     { canopy: ["deadTree", "deadTree", "rock"],               features: ["brokenColumn", "votiveColumn"] },
  // V — scorched: obsidian shards and burnt trunks
  olympus:   { canopy: ["obsidian", "deadTree", "obsidian"],           features: ["votiveColumn", "obsidian"] },
};

// Clearances. Bigger than they were: props used to crowd right up to the
// verge, which is what made the field feel cluttered rather than dressed.
const ROAD_CLEAR = 56;      // props stay this far from the centreline
const SPOT_CLEAR = 42;      // and this far from anything the player clicks
const FEATURE_BAND = [56, 108];

// Scatter props in clumps rather than uniformly, and keep the whole layer
// clear of the road and every build spot — the scenery's job is to sit behind
// the game, not to compete with it for attention.
export function scatterProps(g, routes, spots, stageId, seed) {
  const rand = rng(seed * 2654435761);
  const mix = PROP_MIX[stageId] || PROP_MIX.troy;
  const placed = [];

  // keep clear of EVERY road on the map, not just the primary
  const roadDist = (x, y) => {
    let d = Infinity;
    for (const r of routes) {
      const on = nearestPointOnPath(r, x, y);
      d = Math.min(d, dist(x, y, on.x, on.y));
    }
    return d;
  };
  const free = (x, y, near) =>
    x > 28 && x < W - 28 && y > 42 && y < H - 26 &&
    !spots.some((s) => dist(x, y, s.x, s.y) < SPOT_CLEAR) &&
    !placed.some((p) => dist(x, y, p.x, p.y) < near);

  // --- groves and outcrops ---
  for (let c = 0; c < 16; c++) {
    // find somewhere for the clump to sit
    let cx = 0, cy = 0, found = false;
    for (let a = 0; a < 60 && !found; a++) {
      cx = 40 + rand() * (W - 80);
      cy = 60 + rand() * (H - 100);
      if (roadDist(cx, cy) > ROAD_CLEAR + 12 && free(cx, cy, 78)) found = true;
    }
    if (!found) continue;

    const isRock = rand() < 0.3;
    const members = isRock ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 3);
    for (let m = 0; m < members; m++) {
      // Cluster members sit close together, with one clearly biggest so the
      // clump has an anchor instead of reading as identical triplets.
      const ang = rand() * Math.PI * 2;
      const rad = m === 0 ? 0 : 16 + rand() * 26;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.7;
      if (roadDist(x, y) < ROAD_CLEAR || !free(x, y, 19)) continue;
      placed.push({
        x, y,
        key: isRock ? "rock" : mix.canopy[Math.floor(rand() * mix.canopy.length)],
        s: (m === 0 ? 0.95 + rand() * 0.45 : 0.6 + rand() * 0.35),
        r: rand() * 3,
      });
    }
  }

  // --- roadside features, a handful only ---
  // Capped per kind, and never the same kind twice in a row. These are the
  // most eye-catching objects on the field, so four identical fallen columns
  // read as a copy-paste error rather than as ruins.
  const featureCount = 4 + Math.floor(rand() * 2);
  const used = {};
  let lastKey = null;
  for (let f = 0, a = 0; f < featureCount && a < 300; a++) {
    const x = 34 + rand() * (W - 68);
    const y = 50 + rand() * (H - 86);
    const d = roadDist(x, y);
    if (d < FEATURE_BAND[0] || d > FEATURE_BAND[1]) continue;
    if (!free(x, y, 62)) continue;
    const options = mix.features.filter((k) => (used[k] || 0) < 2 && k !== lastKey);
    const key = (options.length ? options : mix.features)[
      Math.floor(rand() * (options.length || mix.features.length))];
    used[key] = (used[key] || 0) + 1;
    lastKey = key;
    placed.push({ x, y, key, s: 0.8 + rand() * 0.35, r: rand() * 3 });
    f++;
  }

  // --- low ground cover ---
  // The strips between road lanes are where the build spots live, so the
  // clumps above can't reach them and they end up bare. Small shrubs and
  // stones are short enough to sit there without hiding anything, which fills
  // the gap without cluttering the part of the board that matters.
  const lowKey = mix.canopy.includes("shrub") ? "shrub" : "rock";
  for (let n = 0, a = 0; n < 10 && a < 400; a++) {
    const x = 34 + rand() * (W - 68);
    const y = 48 + rand() * (H - 84);
    if (roadDist(x, y) < 38) continue;
    if (spots.some((s) => dist(x, y, s.x, s.y) < 30)) continue;
    if (placed.some((p) => dist(x, y, p.x, p.y) < 26)) continue;
    placed.push({
      x, y,
      key: rand() < 0.65 ? lowKey : "rock",
      s: 0.45 + rand() * 0.25,
      r: rand() * 3,
    });
    n++;
  }

  // Paint back-to-front so nearer props overlap further ones correctly, and
  // slightly transparent so the whole layer settles behind the gameplay.
  placed.sort((a, b) => a.y - b.y);
  g.save();
  g.globalAlpha = 0.92;
  for (const p of placed) {
    g.save();
    g.translate(p.x, p.y);
    PROP_FNS[p.key](g, p.s, p.r);
    g.restore();
  }
  g.restore();
}

// -------------------------------------------------------------- linen mix
// Blend two hex colours. Used to tint individual flagstones so a paved road
// reads as many stones rather than one painted band.
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${gg},${bl})`;
}
