// Static scenery: themed ground, the paved road, empty build spots and the
// temple the creeps are trying to reach.
//
// The ground, road and scattered props never change once a level is loaded, so
// they're painted once into an offscreen canvas and blitted from then on. That
// single change is what pays for the detail in scenery.js — five hundred
// shaded flagstones and sixty trees are unaffordable at sixty frames a second
// and free when drawn once.
import { CONFIG } from "../config.js";
import { TOWER_TYPES } from "../data/towerTypes.js";
import { state, PATH, PATHS, BUILD_SPOTS, LEVEL, THEME, spotOccupied } from "../state.js";
import { ctx, groundShadow } from "./canvas.js";
import { paveRoad, dirtPatch, scatterProps, frameGround, frameTrees, groves, placeLandmark } from "./scenery.js";
import { drawBackdrop } from "./backdrop.js";

const W = CONFIG.width, H = CONFIG.height;

// ------------------------------------------------------------ scenery cache
let sceneryCanvas = null;
let sceneryKey = null;      // the level this cache was painted for

function paintScenery() {
  if (!sceneryCanvas) {
    sceneryCanvas = document.createElement("canvas");
    sceneryCanvas.width = W;
    sceneryCanvas.height = H;
  }
  const g = sceneryCanvas.getContext("2d");
  g.clearRect(0, 0, W, H);

  // --- ground ---
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, THEME.grass[0]);
  base.addColorStop(1, THEME.grass[1]);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Mottling colours come from the theme, not from a constant. They used to be
  // a warm cream and a green-black, which is right for a grass field and wrong
  // everywhere else: the green-black turned the snow stages a sickly olive and
  // muddied the grey rock.
  const rgbOf = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [v >> 16, (v >> 8) & 255, v & 255];
  };
  const [gr, gg, gb] = rgbOf(THEME.grass[1]);
  const SHADE = `${Math.round(gr * 0.45)},${Math.round(gg * 0.45)},${Math.round(gb * 0.5)}`;
  const [lr, lg, lb] = rgbOf(THEME.grass[0]);
  const LIT = `${Math.min(255, Math.round(lr * 1.3 + 30))},` +
              `${Math.min(255, Math.round(lg * 1.3 + 30))},` +
              `${Math.min(255, Math.round(lb * 1.25 + 24))}`;

  // Two scales of soft mottling instead of the old hard 40px checkerboard:
  // broad patches that break the flat wash of colour, then finer dappling on
  // top of them like sunlight through leaves. Both are position-derived, so
  // the ground never shimmers between frames.
  const blot = (count, minR, maxR, lightA, darkA) => {
    for (let i = 0; i < count; i++) {
      const h = Math.sin(i * 12.9898 + count) * 43758.5453;
      const f = h - Math.floor(h);
      const h2 = Math.sin(i * 78.233 + count) * 12345.6789;
      const f2 = h2 - Math.floor(h2);
      const h3 = Math.sin(i * 39.427 + count) * 9871.234;
      const f3 = h3 - Math.floor(h3);
      const x = f * W, y = f2 * H, r = minR + f3 * (maxR - minR);
      const rad = g.createRadialGradient(x, y, 0, x, y, r);
      rad.addColorStop(0, f > 0.5 ? `rgba(${LIT},${lightA})` : `rgba(${SHADE},${darkA})`);
      rad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  blot(26, 90, 210, 0.07, 0.09);     // broad ground patches
  blot(190, 20, 60, 0.05, 0.05);     // finer dappling

  const routes = PATHS.length ? PATHS.map((r) => r.pts) : [PATH];

  // the forest-floor band the border wall stands on — under the road, so the
  // road visibly breaks through it at every entry and exit
  frameGround(g, THEME);

  // Secondary routes first, primary last, so where a fork's branches merge the
  // primary's paving sits on top and the joint reads as one road.
  const tight = LEVEL.archetype === "fork" || LEVEL.archetype === "serpentine";
  for (let i = routes.length - 1; i >= 0; i--)
    paveRoad(g, routes[i], THEME, tight ? 0.72 : 1);
  scatterProps(g, routes, BUILD_SPOTS, LEVEL.stageId, LEVEL.index + 1);

  // Every build spot's dirt patch, part of the ground itself. A tower built
  // later stands on its patch; the signpost (drawn live in drawBuildSpots)
  // disappears, the patch stays.
  BUILD_SPOTS.forEach((sp, i) => dirtPatch(g, sp.x, sp.y, THEME, LEVEL.index * 100 + i));

  // this level's one landmark, in its clearest pocket; then the masses the
  // road bent around; then the wall around the whole field — drawn last so
  // canopies overlap the road's fringe and the field's edge
  const lm = placeLandmark(g, routes, BUILD_SPOTS, THEME, LEVEL.stageId, LEVEL.index + 1);
  groves(g, routes, BUILD_SPOTS, THEME, LEVEL.stageId, LEVEL.index + 1, lm);
  frameTrees(g, routes, BUILD_SPOTS, THEME, LEVEL.stageId, LEVEL.index + 1);

  // vignette, last, over everything
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.88);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);

  sceneryKey = LEVEL.id;
}

// ------------------------------------------------------------------- sky
// The backdrop lives in its own strip above the world (CONFIG.skyHeight) and
// is cached separately, because the world layer is translated down past it and
// the two must never share a coordinate space again.
let skyCanvas = null;
let skyKey = null;

export function drawSky() {
  const SKY = CONFIG.skyHeight;
  if (skyKey !== LEVEL.id) {
    if (!skyCanvas) {
      skyCanvas = document.createElement("canvas");
      skyCanvas.width = W;
      skyCanvas.height = SKY;
    }
    const g = skyCanvas.getContext("2d");
    g.clearRect(0, 0, W, SKY);
    drawBackdrop(g, THEME, LEVEL.index + 1, SKY);
    skyKey = LEVEL.id;
  }
  ctx.drawImage(skyCanvas, 0, 0);
}

// Ground + road + props in one blit. Repaints only when the level changes.
export function drawGround() {
  if (sceneryKey !== LEVEL.id) paintScenery();
  ctx.drawImage(sceneryCanvas, 0, 0);
}

// The road is part of the cached scenery now; this stays as a no-op so
// render.js's draw order reads the same as it always did.
export function drawPath() {}

// ------------------------------------------------------------- build spots
// An empty, dug-out socket — deliberately NOT another piece of pale marble.
// A raised white plinth read as scenery next to the fallen columns and rocks;
// a dark recess ringed in gold reads as "something goes here", which is the
// one thing this marker has to communicate.
export function drawBuildSpots() {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  const affordable = state.gold >= TOWER_TYPES.archer.cost;

  // The patch itself lives in the cached scenery. What's drawn here is the
  // SIGNPOST — a little wooden post with a white marker, the Kingdom Rush
  // "build here" grammar — because it has to vanish the moment the spot is
  // taken, and it glints while a tower is affordable.
  for (const s of BUILD_SPOTS) {
    if (spotOccupied(s)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);

    groundShadow(1, 9, 7, 3);
    ctx.strokeStyle = "#6b4a24";                       // post
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -8);
    ctx.stroke();

    const lit = affordable ? 0.9 + 0.1 * pulse : 0.72; // plaque
    ctx.fillStyle = `rgba(246,240,224,${lit})`;
    ctx.beginPath();
    ctx.roundRect(-7, -19, 14, 12, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(50,34,16,0.85)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // the tower glyph on the plaque, gold while it's actionable
    ctx.fillStyle = affordable
      ? `rgba(169,118,42,${0.8 + 0.2 * pulse})`
      : "rgba(120,110,92,0.8)";
    ctx.fillRect(-2.6, -16.5, 5.2, 6);
    ctx.fillRect(-3.8, -17.6, 2, 2);
    ctx.fillRect(-1, -17.6, 2, 2);
    ctx.fillRect(1.8, -17.6, 2, 2);

    if (affordable) {                                  // soft ready-glint
      ctx.strokeStyle = `rgba(255,207,82,${0.25 + 0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 2, 24, 17, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ temple
// What the creeps are marching on: a Doric temple with a columned front and a
// painted pediment.
//
// (cx, cy) is the CENTRE of its ground line, not a corner — the caller has to
// clamp it inside the canvas, and that's only possible if the anchor point is
// somewhere predictable. Its footprint is roughly 78 wide and reaches 74 above
// the ground line; TEMPLE_EXTENT publishes that so render.js can clamp
// honestly instead of guessing.
export const TEMPLE_EXTENT = { halfW: 44, up: 78, down: 26 };

export function drawCastle(cx, cy) {
  // A warm halo so the temple separates from the ground on every theme —
  // white marble on the pale Olympus cloudscape needs it as much as on ash.
  const halo = ctx.createRadialGradient(cx, cy - 16, 6, cx, cy - 16, 74);
  halo.addColorStop(0, "rgba(255,226,150,0.20)");
  halo.addColorStop(1, "rgba(255,200,110,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 74, 0, Math.PI * 2);
  ctx.fill();

  // Drawn a little larger than life: it's the thing you're defending, so it
  // should be the biggest structure on the board.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.12, 1.12);
  ctx.translate(-cx, -cy);

  const x = cx - 30, y = cy;      // the body below is written corner-relative
  groundShadow(x + 30, y + 26, 52, 16);

  const marble = (x0, y0, w, h, lit = "#f6f1e4", mid = "#d8d1c0", dark = "#a49c8a") => {
    const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
    g.addColorStop(0, lit);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
  };

  // stylobate — the stepped platform
  marble(x - 6, y + 14, 72, 8, "#e8e1d0", "#c3bba8", "#8d8676");
  marble(x - 2, y + 8, 64, 7, "#f0eade", "#cdc5b3", "#968f7f");

  // six columns with entasis suggested by a lit left edge
  for (let i = 0; i < 6; i++) {
    const cx = x + 2 + i * 11;
    marble(cx, y - 22, 8, 31);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(cx, y - 22, 2, 31);
    ctx.fillStyle = "rgba(90,82,66,0.28)";
    ctx.fillRect(cx + 6.5, y - 22, 1.5, 31);
    marble(cx - 1.5, y - 26, 11, 4.5, "#faf5ea", "#ded7c6", "#aaa392"); // capital
  }

  // architrave + triglyph frieze
  marble(x - 4, y - 33, 68, 7, "#f2ecdf", "#d2cab8", "#9a9382");
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = "#4d6f8a";
    ctx.fillRect(x - 2 + i * 7.6, y - 32, 4, 5);
  }

  // pediment, with a painted tympanum
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 33);
  ctx.lineTo(x + 30, y - 55);
  ctx.lineTo(x + 68, y - 33);
  ctx.closePath();
  const ped = ctx.createLinearGradient(0, y - 55, 0, y - 33);
  ped.addColorStop(0, "#faf5ea");
  ped.addColorStop(1, "#c0b8a5");
  ctx.fillStyle = ped;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,110,92,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#b8452e";                      // the figure in the tympanum
  ctx.beginPath();
  ctx.moveTo(x + 16, y - 37);
  ctx.lineTo(x + 30, y - 49);
  ctx.lineTo(x + 44, y - 37);
  ctx.closePath();
  ctx.fill();

  // dark doorway between the middle columns
  const dg = ctx.createLinearGradient(x + 24, y - 20, x + 24, y + 9);
  dg.addColorStop(0, "#2b2418");
  dg.addColorStop(1, "#120e08");
  ctx.fillStyle = dg;
  ctx.fillRect(x + 24, y - 20, 13, 29);

  // acroterion + banner on the ridge
  ctx.fillStyle = "#d9a222";
  ctx.beginPath();
  ctx.arc(x + 30, y - 57, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b8452e";
  ctx.fillRect(x + 28.5, y - 72, 3, 15);
  ctx.beginPath();
  ctx.moveTo(x + 31.5, y - 72);
  ctx.lineTo(x + 47, y - 68);
  ctx.lineTo(x + 31.5, y - 63);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
