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
//
// EVERY route is painted in one call, layer by layer — all fringes, then all
// rims, then all bodies, then all worn tracks — with each layer's polygons
// merged into a single fill. Painting roads one at a time put the second
// road's dark fringe ACROSS the first road's dirt, and a fork's merge read
// as two roads crossing instead of one road joining another. A union per
// layer has no seams anywhere two swathes overlap, so a Y-junction comes out
// as smooth as a bend.
export function paveRoads(g, routes, theme) {
  const STEP = 9;

  // sample every route's centreline + normals once
  const sampled = routes.map((path) => {
    const len = pathLength(path);
    // Deterministic per-route phase so two routes on a fork don't wobble in sync.
    const ph = (path[0].x * 13.37 + path[0].y * 7.91) % 6.283;
    // 26px half-width. At 30 the swathe plus its fringe painted ~74px against
    // the layouts' guaranteed ~100px corridor clearance — parallel roads
    // visibly merged into sand lakes. Width has to respect the layouts'
    // clearance floor, not just the reference art.
    // Long, calm undulations. The first cut wobbled at twice this frequency and
    // amplitude and the edges read as a lumpy worm rather than a confident road.
    const halfW = (d) =>
      26 * (1 + 0.06 * Math.sin(d * 0.011 + ph) + 0.04 * Math.sin(d * 0.027 + ph * 2.7));
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
    return { path, C, N, WD };
  });

  // One layer = one Path2D holding every route's ribbon, filled once.
  // Non-zero winding turns the overlaps into a plain union.
  const layer = (scale, extra = 0) => {
    const p2 = new Path2D();
    for (const { C, N, WD } of sampled) {
      for (let i = 0; i < C.length; i++) {
        const w = WD[i] * scale + extra;
        const x = C[i].x + N[i].x * w, y = C[i].y + N[i].y * w;
        if (i === 0) p2.moveTo(x, y); else p2.lineTo(x, y);
      }
      for (let i = C.length - 1; i >= 0; i--) {
        const w = WD[i] * scale + extra;
        p2.lineTo(C[i].x - N[i].x * w, C[i].y - N[i].y * w);
      }
      p2.closePath();
    }
    return p2;
  };

  // dark grass fringe, then the dirt body, then the worn middle — the track
  // is translucent, so the union fill matters twice over there: two stacked
  // fills would double-darken the merged stretch every route shares
  g.fillStyle = mix(theme.grass[1], "#000000", 0.25);
  g.fill(layer(1, 5.5));
  g.fillStyle = theme.path.rim;
  g.fill(layer(1, 1.5));
  g.fillStyle = theme.path.body;
  g.fill(layer(1));
  g.globalAlpha = 0.5;
  g.fillStyle = theme.path.track;
  g.fill(layer(0.52));
  g.globalAlpha = 1;

  // Distance from a point to the nearest OTHER route — junction tests below.
  const nearOther = (self, x, y, within) => {
    for (const s of sampled) {
      if (s === self) continue;
      const on = nearestPointOnPath(s.path, x, y);
      if (dist(x, y, on.x, on.y) < within) return true;
    }
    return false;
  };

  for (const s of sampled) {
    const { path, C, N, WD } = s;
    // grass tufts biting into the verge — the scalloped edge that makes it
    // read as ground and not as a drawn line. Tufts sit OUTSIDE the verge,
    // hugging it — straddling the edge they read as litter dropped on the
    // road — and NEVER near another route: a tuft placed off route A's verge
    // can land in the middle of route B's dirt at a junction.
    const rand = rng(9173 + ((path[0].x | 0) << 3));
    g.fillStyle = theme.grass[1];
    for (let i = 2; i < C.length - 2; i += 2 + Math.floor(rand() * 3)) {
      if (rand() < 0.45) continue;
      for (const side of [-1, 1]) {
        if (rand() < 0.4) continue;
        const w = WD[i] + 7 + rand() * 2;
        const tx = C[i].x + N[i].x * w * side;
        const ty = C[i].y + N[i].y * w * side;
        if (nearOther(s, tx, ty, 40)) continue;
        const rr = 2 + rand() * 3;
        g.beginPath();
        // squash the tuft along the road direction so the edge scallops
        g.ellipse(tx, ty, rr * 1.6, rr, Math.atan2(N[i].x, -N[i].y), 0, Math.PI * 2);
        g.fill();
      }
    }

    // speckles and the odd pebble worn into the dirt — at RANDOM spacing. On
    // a fixed stride they lined the road like beads on a string. Skipped
    // where another route runs the same ground (a fork's shared tail is in
    // every route), or the shared stretch collects every route's litter.
    for (let i = 1; i < C.length - 1; i += 2 + Math.floor(rand() * 7)) {
      if (rand() < 0.45) continue;
      const off = (rand() * 2 - 1) * WD[i] * 0.7;
      const px = C[i].x + N[i].x * off, py = C[i].y + N[i].y * off;
      if (s !== sampled[0] && nearOther(s, px, py, 10)) continue;
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
}

// ------------------------------------------------------- the frame & groves
// What turns a green rectangle into a PLACE. Two layers, both cached:
//
//   frame   a dense border of the stage's own vegetation (or rock) walling
//           the whole field in, with clean gaps where roads pass through —
//           the playfield becomes a clearing something surrounds
//   groves  a few large masses INSIDE the field, in the pockets the road
//           left empty — so the road visibly bent around something, which is
//           the difference between a route and a squiggle
//
// Neither touches a map, a spot or a stat: pure set dressing, and the single
// biggest gap between these levels and the game they're modelled on.
const FRAME_MIX = {
  troy:      ["oliveTree", "cypress", "oliveTree", "shrub"],
  arcadia:   ["cypress", "cypress", "oliveTree", "shrub"],
  labyrinth: ["snowPine", "snowPine", "rock"],
  hades:     ["rock", "deadTree", "rock"],
  // No pale rock on Othrys: against near-black ash the standard grey rock
  // glares like cotton. Obsidian and burnt trunks only.
  olympus:   ["obsidian", "obsidian", "deadTree"],
};

export function frameGround(g, theme) {
  // the darker forest-floor band the frame trees stand on
  const band = 58;
  const wob = (t) => 1 + 0.35 * Math.sin(t * 5.1) + 0.22 * Math.sin(t * 11.7);
  g.fillStyle = mix(theme.grass[1], "#000000", 0.22);
  g.beginPath();
  g.moveTo(-4, -4);
  g.lineTo(W + 4, -4);
  g.lineTo(W + 4, H + 4);
  g.lineTo(-4, H + 4);
  g.closePath();
  // punch out the middle with a wobbly inner rectangle (even-odd fill)
  g.moveTo(band, band);
  for (let x = band; x <= W - band; x += 30) g.lineTo(x, band * wob(x * 0.013));
  for (let y = band; y <= H - band; y += 30) g.lineTo(W - band * wob(y * 0.017), y);
  for (let x = W - band; x >= band; x -= 30) g.lineTo(x, H - band * wob(x * 0.011 + 2));
  for (let y = H - band; y >= band; y -= 30) g.lineTo(band * wob(y * 0.019 + 4), y);
  g.closePath();
  g.fill("evenodd");
}

// Border forest, drawn AFTER the road so canopies layer naturally — gaps are
// left wherever a route passes, so the road visibly breaks through the treeline.
export function frameTrees(g, routes, spots, theme, stageId, seed) {
  const rand = rng(seed * 48271 + 7);
  const mixKeys = FRAME_MIX[stageId] || FRAME_MIX.troy;
  const exit = routes[0][routes[0].length - 1];       // temple lives here

  const roadDist = (x, y) => {
    let d = Infinity;
    for (const r of routes) {
      const on = nearestPointOnPath(r, x, y);
      d = Math.min(d, dist(x, y, on.x, on.y));
    }
    return d;
  };

  const placed = [];
  const tryPlace = (x, y, scale) => {
    if (roadDist(x, y) < 62) return;                  // the road's gap in the wall
    if (dist(x, y, exit.x, exit.y) < 105) return;     // room for the temple
    if (spots.some((sp) => dist(x, y, sp.x, sp.y) < 46)) return;
    if (placed.some((p) => dist(x, y, p.x, p.y) < 21)) return;
    placed.push({ x, y, key: mixKeys[Math.floor(rand() * mixKeys.length)],
                  s: scale, r: rand() * 3 });
  };

  // Three staggered rows along each edge, packed tight — a WALL of canopy,
  // not a picket line. Two sparse rows read as trees that happened to grow
  // near the border; the point is a mass the field is carved out of.
  for (const [inset, s0, s1] of [[8, 1.5, 2.0], [36, 1.15, 1.5], [62, 0.85, 1.15]]) {
    for (let x = 6; x < W; x += 22 + rand() * 14)
      tryPlace(x + rand() * 8, inset + rand() * 12, s0 + rand() * (s1 - s0));
    for (let x = 6; x < W; x += 22 + rand() * 14)
      tryPlace(x + rand() * 8, H - inset - rand() * 12, s0 + rand() * (s1 - s0));
    for (let y = 30; y < H - 22; y += 22 + rand() * 14) {
      tryPlace(inset + rand() * 12, y + rand() * 8, s0 + rand() * (s1 - s0));
      tryPlace(W - inset - rand() * 12, y + rand() * 8, s0 + rand() * (s1 - s0));
    }
  }

  placed.sort((a, b) => a.y - b.y);
  for (const p of placed) {
    g.save();
    g.translate(p.x, p.y);
    PROP_FNS[p.key](g, p.s, p.r);
    g.restore();
  }
}

// Interior masses in the road's dead pockets. Each is a wobbly patch of
// forest floor with a handful of large props clustered on it.
export function groves(g, routes, spots, theme, stageId, seed, landmark = null) {
  const rand = rng(seed * 69621 + 3);
  const mixKeys = FRAME_MIX[stageId] || FRAME_MIX.troy;

  const roadDist = (x, y) => {
    let d = Infinity;
    for (const r of routes) {
      const on = nearestPointOnPath(r, x, y);
      d = Math.min(d, dist(x, y, on.x, on.y));
    }
    return d;
  };

  // find up to three pocket centres, greedily, far from everything
  const centres = [];
  for (let a = 0; a < 500 && centres.length < 3; a++) {
    const x = 120 + rand() * (W - 240);
    const y = 120 + rand() * (H - 240);
    if (roadDist(x, y) < 86) continue;
    if (spots.some((sp) => dist(x, y, sp.x, sp.y) < 72)) continue;
    if (centres.some((c) => dist(x, y, c.x, c.y) < 170)) continue;
    if (landmark && dist(x, y, landmark.x, landmark.y) < 150) continue;
    centres.push({ x, y });
  }

  for (const c of centres) {
    // forest-floor patch
    const rr = 46 + rand() * 26;
    g.fillStyle = mix(theme.grass[1], "#000000", 0.18);
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const w = 1 + 0.18 * Math.sin(a * 3 + c.x) + 0.12 * Math.sin(a * 5 + c.y);
      const px = c.x + Math.cos(a) * rr * 1.12 * w;
      const py = c.y + Math.sin(a) * rr * 0.78 * w;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();

    // The mass itself: enough props to FILL the patch, spread uniformly over
    // the disc (sqrt-radius). Five on the rim left the middle as a bare dark
    // blob that read as a shadow, not a wood.
    const members = [];
    const n = 8 + Math.floor(rand() * 5);
    for (let m = 0; m < n; m++) {
      const a = rand() * Math.PI * 2;
      const d0 = Math.sqrt(rand()) * rr * 0.95;
      members.push({
        x: c.x + Math.cos(a) * d0 * 1.15,
        y: c.y + Math.sin(a) * d0 * 0.68,
        key: mixKeys[Math.floor(rand() * mixKeys.length)],
        s: 1.05 + rand() * 0.6, r: rand() * 3,
      });
    }
    members.sort((a, b) => a.y - b.y);
    for (const p of members) {
      g.save();
      g.translate(p.x, p.y);
      PROP_FNS[p.key](g, p.s, p.r);
      g.restore();
    }
  }
}

// ------------------------------------------------------------- landmarks
// One per level: the thing that makes THIS level this level. Path shape and
// palette make levels different; a landmark makes them memorable — "the one
// with the lake", "the one with the war camp". Each stage carries two
// variants and alternates them by level seed, so no two consecutive levels
// of a stage share one.
function lmPond(g, x, y, theme, seed, frozen = false, lava = false) {
  const rand = rng(seed * 31 + 5);
  const rot = rand() * 3;
  const blob = (rx, ry, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const w = 1 + 0.14 * Math.sin(a * 3 + rot) + 0.1 * Math.sin(a * 5 + rot * 2);
      const px = x + Math.cos(a) * rx * w, py = y + Math.sin(a) * ry * w;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  };
  blob(64, 42, mix(theme.grass[1], "#000000", 0.3));            // bank shadow
  if (lava) {
    blob(56, 36, "#2a1712");
    blob(48, 30, "#ff7a26");
    blob(34, 20, "#ffc258");
    g.strokeStyle = "rgba(40,16,8,0.85)";                       // crust plates
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      const a = rand() * Math.PI * 2, d = rand() * 26;
      g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
      g.lineTo(x + Math.cos(a) * (d + 18), y + Math.sin(a) * (d + 18) * 0.6);
      g.stroke();
    }
  } else if (frozen) {
    blob(56, 36, "#b9cfdf");
    blob(46, 29, "#d7e7f2");
    g.strokeStyle = "rgba(120,150,175,0.55)";                   // cracks
    g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x - 30 + rand() * 20, y - 14 + rand() * 12);
      g.lineTo(x + rand() * 24, y + (rand() - 0.5) * 10);
      g.lineTo(x + 20 + rand() * 18, y - 8 + rand() * 18);
      g.stroke();
    }
  } else {
    blob(56, 36, "#2f6b78");
    blob(48, 30, "#3f8896");
    g.fillStyle = "rgba(255,255,255,0.25)";                     // sky glint
    g.beginPath();
    g.ellipse(x - 12, y - 8, 20, 8, -0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#3f6b2c";                                  // reeds
    g.lineWidth = 1.6;
    g.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const rx = x + (rand() - 0.5) * 100, ry = y + 24 + rand() * 12;
      g.beginPath();
      g.moveTo(rx, ry);
      g.quadraticCurveTo(rx + 2, ry - 10, rx + (rand() - 0.5) * 6, ry - 16);
      g.stroke();
    }
  }
}

// A ring of standing stones — Greek enough as a rustic sanctuary, and it
// works in every biome by borrowing the stage's own rock prop.
function lmStones(g, x, y, theme, seed, key = "rock") {
  const rand = rng(seed * 37 + 1);
  g.fillStyle = mix(theme.grass[1], "#000000", 0.2);
  g.beginPath();
  g.ellipse(x, y, 58, 36, 0, 0, Math.PI * 2);
  g.fill();
  const n = 6;
  const members = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.3;
    members.push({ x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 27,
                   s: 0.9 + rand() * 0.4, r: rand() * 3 });
  }
  members.sort((a, b) => a.y - b.y);
  for (const m of members) {
    g.save();
    g.translate(m.x, m.y);
    PROP_FNS[key](g, m.s, m.r);
    g.restore();
  }
}

// A war camp: two striped tents, a fire, a stack of logs.
function lmCamp(g, x, y, theme, seed) {
  const rand = rng(seed * 41 + 9);
  g.fillStyle = mix(theme.grass[1], "#000000", 0.18);
  g.beginPath();
  g.ellipse(x, y + 4, 62, 34, 0, 0, Math.PI * 2);
  g.fill();
  const tent = (tx, ty, sc, cloth) => {
    g.save();
    g.translate(tx, ty);
    g.scale(sc, sc);
    shadow(g, 16, 6);
    g.fillStyle = cloth;
    g.beginPath();
    g.moveTo(-18, 0); g.lineTo(0, -20); g.lineTo(18, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(30,20,10,0.6)";
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = "rgba(252,248,238,0.9)";                      // stripe
    g.beginPath();
    g.moveTo(-6, 0); g.lineTo(0, -20); g.lineTo(6, 0);
    g.closePath();
    g.fill();
    g.fillStyle = "#241a10";                                    // door
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(0, -9); g.lineTo(4, 0);
    g.closePath();
    g.fill();
    g.restore();
  };
  tent(x - 26, y + 6, 1.05, "#8a4a3a");
  tent(x + 24, y - 6, 0.85, "#3d5a78");
  const fx = x + 4, fy = y + 16;                                // campfire
  g.fillStyle = "#4a3a28";
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(fx, fy);
    g.rotate((i / 5) * Math.PI);
    g.fillRect(-7, -1.1, 14, 2.2);
    g.restore();
  }
  const fl = g.createRadialGradient(fx, fy - 3, 0, fx, fy - 3, 9);
  fl.addColorStop(0, "rgba(255,200,90,0.95)");
  fl.addColorStop(1, "rgba(255,120,30,0)");
  g.fillStyle = fl;
  g.beginPath();
  g.arc(fx, fy - 3, 9, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 3; i++) {                                 // log pile
    g.fillStyle = i % 2 ? "#7a5630" : "#8a6438";
    g.beginPath();
    g.roundRect(x - 52 + i * 3, y + 18 - i * 4, 26, 5, 2.4);
    g.fill();
    g.strokeStyle = "rgba(40,24,8,0.5)";
    g.lineWidth = 1;
    g.stroke();
  }
  void rand;
}

// One ancient tree, far bigger than anything in the groves.
function lmGreatTree(g, x, y, theme, seed, key = "oliveTree") {
  g.fillStyle = mix(theme.grass[1], "#000000", 0.2);
  g.beginPath();
  g.ellipse(x, y + 6, 54, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(x, y);
  PROP_FNS[key](g, 2.7, seed % 3);
  g.restore();
}

const LANDMARKS = {
  troy:      [(g,x,y,t,s) => lmCamp(g,x,y,t,s),        (g,x,y,t,s) => lmStones(g,x,y,t,s)],
  arcadia:   [(g,x,y,t,s) => lmPond(g,x,y,t,s),        (g,x,y,t,s) => lmGreatTree(g,x,y,t,s)],
  labyrinth: [(g,x,y,t,s) => lmPond(g,x,y,t,s,true),   (g,x,y,t,s) => lmStones(g,x,y,t,s)],
  hades:     [(g,x,y,t,s) => lmStones(g,x,y,t,s),      (g,x,y,t,s) => lmGreatTree(g,x,y,t,s,"deadTree")],
  olympus:   [(g,x,y,t,s) => lmPond(g,x,y,t,s,false,true), (g,x,y,t,s) => lmStones(g,x,y,t,s,"obsidian")],
};

// Place the level's landmark in the biggest clear pocket. Returns its centre
// so the groves can keep away, or null when the map is too dense for one.
export function placeLandmark(g, routes, spots, theme, stageId, seed) {
  const rand = rng(seed * 26501 + 11);
  const pool = LANDMARKS[stageId] || LANDMARKS.troy;
  const draw = pool[seed % pool.length];

  const roadDist = (x, y) => {
    let d = Infinity;
    for (const r of routes) {
      const on = nearestPointOnPath(r, x, y);
      d = Math.min(d, dist(x, y, on.x, on.y));
    }
    return d;
  };
  // best of many random candidates: maximise clearance from everything
  let best = null;
  for (let a = 0; a < 240; a++) {
    const x = 140 + rand() * (W - 280);
    const y = 130 + rand() * (H - 250);
    const clear = Math.min(
      roadDist(x, y),
      ...spots.map((sp) => dist(x, y, sp.x, sp.y)));
    if (!best || clear > best.clear) best = { x, y, clear };
  }
  if (!best || best.clear < 60) return null;
  if (best.clear >= 92) {
    draw(g, best.x, best.y, theme, seed);
    return best;
  }
  // Not enough room for the set-piece (dense fork and serpentine maps): a
  // compact landmark instead — one great tree, or one monolith with kin.
  const key = (FRAME_MIX[stageId] || FRAME_MIX.troy)[0];
  if (seed % 2) lmGreatTree(g, best.x, best.y, theme, seed,
    key === "obsidian" || key === "rock" ? "deadTree" : key === "snowPine" ? "snowPine" : "oliveTree");
  else {
    g.fillStyle = mix(theme.grass[1], "#000000", 0.2);
    g.beginPath();
    g.ellipse(best.x, best.y, 40, 24, 0, 0, Math.PI * 2);
    g.fill();
    for (const [ox, oy, sc] of [[-16, 6, 1.3], [14, -4, 1.7], [4, 10, 1.0]]) {
      g.save();
      g.translate(best.x + ox, best.y + oy);
      PROP_FNS[key === "oliveTree" || key === "cypress" ? "rock" : key](g, sc, seed % 3);
      g.restore();
    }
  }
  return best;
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
  // Sparse, and kept well off the verge: at 10 within 38px of the road they
  // strung themselves along its edge like beads, which read as generated.
  const lowKey = mix.canopy.includes("shrub") ? "shrub" : "rock";
  for (let n = 0, a = 0; n < 6 && a < 400; a++) {
    const x = 34 + rand() * (W - 68);
    const y = 48 + rand() * (H - 84);
    if (roadDist(x, y) < 52) continue;
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
