// The horizon: what you can see beyond the battlefield.
//
// Every level used to open on a flat wash of ground colour running right to the
// top edge, which read as a texture swatch rather than a place. A band of sky
// with something in it — a mountain range, the sea, a treeline, a volcano —
// costs one strip of the canvas and does more for a level's identity than any
// amount of prop scattering, because it's the first thing the eye lands on.
//
// Drawn ONCE into the cached scenery canvas (see terrain.js), so everything in
// here can be as detailed as it likes. Nothing animates.
//
// Each motif is handed the same contract: paint the band from y=0 down to
// `horizon`, using `sky` for air and the theme's own ground colours for land,
// and leave the bottom edge soft so the playfield blends into it.
import { CONFIG } from "../config.js";

const W = CONFIG.width;

// Deterministic noise, so a level's skyline never changes between reloads.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function skyWash(g, horizon, sky) {
  const grad = g.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(1, sky[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, horizon);
}

// One layer of peaks. `depth` 0 is farthest and palest; each nearer layer is
// darker and taller, which is the whole of aerial perspective.
function ridge(g, seed, baseY, height, colour, jag = 5) {
  const rand = rng(seed);
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(-20, baseY + 40);
  g.lineTo(-20, baseY);
  let x = -20;
  while (x < W + 20) {
    const step = 60 + rand() * 90;
    const peak = baseY - height * (0.45 + rand() * 0.55);
    g.lineTo(x + step * 0.5, peak);
    // a little shoulder on the way down stops every peak being a clean triangle
    g.lineTo(x + step * 0.72, peak + height * 0.22 * (0.4 + rand() * 0.6));
    x += step;
    g.lineTo(x, baseY - height * 0.1 * rand());
    void jag;
  }
  g.lineTo(W + 20, baseY + 40);
  g.closePath();
  g.fill();
}

// Snow caps on the nearest ridge only — on the far ones they'd be noise.
function snowCaps(g, seed, baseY, height) {
  const rand = rng(seed);
  g.fillStyle = "rgba(255,255,255,0.9)";
  let x = -20;
  while (x < W + 20) {
    const step = 60 + rand() * 90;
    const peak = baseY - height * (0.45 + rand() * 0.55);
    const capW = step * 0.18;
    g.beginPath();
    g.moveTo(x + step * 0.5, peak);
    g.lineTo(x + step * 0.5 + capW, peak + capW * 1.5);
    g.lineTo(x + step * 0.5 + capW * 0.3, peak + capW * 1.2);
    g.lineTo(x + step * 0.5 - capW * 0.4, peak + capW * 1.7);
    g.lineTo(x + step * 0.5 - capW, peak + capW * 1.4);
    g.closePath();
    g.fill();
    x += step;
  }
}

// A treeline: overlapping conifer silhouettes, two layers deep.
function treeline(g, seed, baseY, height, colour, snowy = false) {
  const rand = rng(seed);
  g.fillStyle = colour;
  let x = -14;
  while (x < W + 14) {
    const h = height * (0.6 + rand() * 0.6);
    const w = h * (0.3 + rand() * 0.16);
    g.beginPath();
    g.moveTo(x, baseY);
    g.lineTo(x + w, baseY - h);
    g.lineTo(x + w * 2, baseY);
    g.closePath();
    g.fill();
    if (snowy) {
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.moveTo(x + w * 0.35, baseY - h * 0.45);
      g.lineTo(x + w, baseY - h);
      g.lineTo(x + w * 1.65, baseY - h * 0.45);
      g.closePath();
      g.fill();
      g.fillStyle = colour;
    }
    x += w * 1.35;
  }
}

// ------------------------------------------------------------------- motifs
const MOTIFS = {
  // Open plain under a distant range — the default, and Troy's.
  mountains(g, h, th, seed) {
    skyWash(g, h, th.sky);
    ridge(g, seed + 1, h * 0.92, h * 0.5, "rgba(255,255,255,0.16)");
    ridge(g, seed + 2, h, h * 0.42, mixHex(th.grass[1], "#5a6a7a", 0.55));
    ridge(g, seed + 3, h * 1.06, h * 0.3, th.grass[1]);
  },

  // The Aegean: a hard waterline, sun glitter, and a couple of sails.
  sea(g, h, th, seed) {
    skyWash(g, h * 0.62, th.sky);
    const water = g.createLinearGradient(0, h * 0.6, 0, h * 1.08);
    water.addColorStop(0, "#3f89a8");
    water.addColorStop(1, "#2b6b88");
    g.fillStyle = water;
    g.fillRect(0, h * 0.6, W, h * 0.5);
    // far islands sitting on the waterline
    ridge(g, seed + 5, h * 0.62, h * 0.2, "rgba(90,110,120,0.75)");
    const rand = rng(seed + 9);
    g.strokeStyle = "rgba(255,255,255,0.4)";            // glitter
    g.lineWidth = 1.4;
    for (let i = 0; i < 60; i++) {
      const x = rand() * W, y = h * 0.66 + rand() * h * 0.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 6 + rand() * 10, y);
      g.stroke();
    }
    for (const [sx, ss] of [[W * 0.22, 1], [W * 0.74, 0.72]]) {   // sails
      const sy = h * 0.78;
      g.fillStyle = "rgba(252,248,238,0.92)";
      g.beginPath();
      g.moveTo(sx, sy - 16 * ss);
      g.lineTo(sx + 9 * ss, sy);
      g.lineTo(sx - 9 * ss, sy);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(70,50,34,0.85)";
      g.fillRect(sx - 11 * ss, sy, 22 * ss, 3 * ss);
    }
  },

  // A colonnade of the city you are defending, seen across the plain.
  ruins(g, h, th, seed) {
    skyWash(g, h, th.sky);
    ridge(g, seed + 2, h, h * 0.34, mixHex(th.grass[1], "#6b7a86", 0.5));
    const rand = rng(seed + 4);
    const baseY = h * 0.98;
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.14 + i * 0.32) + rand() * 40;
      const cw = 74 + rand() * 46, ch = h * (0.36 + rand() * 0.2);
      g.fillStyle = "rgba(120,126,120,0.6)";            // stylobate
      g.fillRect(cx - 6, baseY - 6, cw + 12, 8);
      for (let c = 0; c <= 4; c++) {                    // columns
        const px = cx + (c * cw) / 4;
        g.fillStyle = "rgba(158,162,152,0.62)";
        g.fillRect(px - 4, baseY - ch, 8, ch);
      }
      g.fillStyle = "rgba(150,154,146,0.62)";           // architrave
      g.fillRect(cx - 10, baseY - ch - 10, cw + 20, 10);
    }
  },

  // Arcadia: a wall of woodland with mist pooled at its feet.
  woods(g, h, th, seed) {
    skyWash(g, h, th.sky);
    treeline(g, seed + 1, h * 0.8, h * 0.42, mixHex(th.grass[1], "#7fa06e", 0.45));
    treeline(g, seed + 2, h * 0.96, h * 0.54, mixHex(th.grass[1], "#20361d", 0.4));
    treeline(g, seed + 3, h * 1.12, h * 0.6, th.grass[1]);
    const mist = g.createLinearGradient(0, h * 0.62, 0, h * 0.98);
    mist.addColorStop(0, "rgba(226,240,226,0.34)");
    mist.addColorStop(1, "rgba(226,240,226,0)");
    g.fillStyle = mist;
    g.fillRect(0, h * 0.62, W, h * 0.4);
  },

  // A still tarn below the treeline, reflecting it.
  lake(g, h, th, seed) {
    skyWash(g, h * 0.58, th.sky);
    treeline(g, seed + 2, h * 0.62, h * 0.36, mixHex(th.grass[1], "#2c4a28", 0.4));
    const water = g.createLinearGradient(0, h * 0.6, 0, h * 1.05);
    water.addColorStop(0, "#4e7f80");
    water.addColorStop(1, "#33605f");
    g.fillStyle = water;
    g.fillRect(0, h * 0.6, W, h * 0.48);
    g.globalAlpha = 0.2;                                // inverted reflection
    g.save();
    g.translate(0, h * 1.22);
    g.scale(1, -1);
    treeline(g, seed + 2, h * 0.62, h * 0.36, "#2c4a28");
    g.restore();
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = 1.2;
    const rand = rng(seed + 7);
    for (let i = 0; i < 26; i++) {
      const y = h * 0.68 + rand() * h * 0.34, x = rand() * W;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 14 + rand() * 22, y);
      g.stroke();
    }
  },

  // Ida in winter: high snow peaks, cold blue shadow.
  snowpeaks(g, h, th, seed) {
    skyWash(g, h, th.sky);
    ridge(g, seed + 1, h * 0.9, h * 0.62, "rgba(255,255,255,0.5)");
    ridge(g, seed + 2, h * 1.0, h * 0.5, "#b9cbdb");
    snowCaps(g, seed + 2, h * 1.0, h * 0.5);
    ridge(g, seed + 3, h * 1.12, h * 0.3, "#93aec6");
  },

  // Frozen forest under the same peaks.
  snowwoods(g, h, th, seed) {
    skyWash(g, h, th.sky);
    ridge(g, seed + 1, h * 0.78, h * 0.44, "rgba(255,255,255,0.42)");
    treeline(g, seed + 4, h * 1.02, h * 0.46, "#5d6e78", true);
  },

  // The house of Hades: a sheer grey wall with no sky worth the name.
  cliffs(g, h, th, seed) {
    skyWash(g, h, th.sky);
    const rand = rng(seed + 3);
    const baseY = h * 1.1;
    for (const [depth, col] of [[0.9, "#6c6b69"], [0.62, "#55544f"], [0.34, "#403f3b"]]) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-20, baseY);
      let x = -20;
      while (x < W + 20) {
        const step = 90 + rand() * 110;
        const top = h * (1 - depth) + rand() * h * 0.12;
        g.lineTo(x, top);
        g.lineTo(x + step, top + (rand() - 0.5) * h * 0.1);
        x += step;
      }
      g.lineTo(W + 20, baseY);
      g.closePath();
      g.fill();
    }
  },

  // Broken crags — the same rock, shattered rather than sheer.
  crags(g, h, th, seed) {
    skyWash(g, h, th.sky);
    ridge(g, seed + 1, h * 0.88, h * 0.56, "rgba(190,190,200,0.22)");
    ridge(g, seed + 2, h * 1.0, h * 0.48, mixHex(th.grass[0], "#3a3a40", 0.5));
    ridge(g, seed + 3, h * 1.14, h * 0.34, th.grass[1]);
  },

  // Othrys, burning: a cone, a smoke column, and lava in the fissures.
  volcano(g, h, th, seed) {
    skyWash(g, h, th.sky);
    // the glow behind everything
    const glow = g.createRadialGradient(W * 0.62, h * 0.95, 10, W * 0.62, h * 0.95, h * 1.1);
    glow.addColorStop(0, "rgba(255,140,50,0.5)");
    glow.addColorStop(1, "rgba(255,90,20,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, h * 1.2);
    ridge(g, seed + 1, h * 1.02, h * 0.34, "rgba(40,28,32,0.75)");

    const cx = W * 0.62, baseY = h * 1.06, ch = h * 0.86;
    g.fillStyle = "#241a1e";                            // the cone
    g.beginPath();
    g.moveTo(cx - ch * 0.85, baseY);
    g.lineTo(cx - ch * 0.17, baseY - ch);
    g.lineTo(cx + ch * 0.17, baseY - ch);
    g.lineTo(cx + ch * 0.85, baseY);
    g.closePath();
    g.fill();
    g.fillStyle = "#ff8a2e";                            // crater
    g.fillRect(cx - ch * 0.17, baseY - ch - 2, ch * 0.34, 4);
    const rand = rng(seed + 6);
    g.strokeStyle = "#ff7a26";                          // lava fissures
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const off = (rand() - 0.5) * ch * 0.3;
      g.beginPath();
      g.moveTo(cx + off, baseY - ch);
      let yy = baseY - ch, xx = cx + off;
      while (yy < baseY) {
        yy += 10 + rand() * 14;
        xx += (rand() - 0.5) * 16;
        g.lineTo(xx, yy);
      }
      g.stroke();
    }
    const smoke = g.createLinearGradient(cx, 0, cx, baseY - ch);   // plume
    smoke.addColorStop(0, "rgba(60,50,52,0)");
    smoke.addColorStop(1, "rgba(70,58,58,0.7)");
    g.fillStyle = smoke;
    g.beginPath();
    g.moveTo(cx - ch * 0.17, baseY - ch);
    g.quadraticCurveTo(cx - ch * 0.6, h * 0.3, cx - ch * 0.3, 0);
    g.lineTo(cx + ch * 0.5, 0);
    g.quadraticCurveTo(cx + ch * 0.45, h * 0.35, cx + ch * 0.17, baseY - ch);
    g.closePath();
    g.fill();
  },
};

// Blend two hex colours. Backdrops are tinted from the level's own palette so
// the horizon always belongs to the ground in front of it.
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16) * (1 - t) + (pb >> 16) * t);
  const gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${gg},${bl})`;
}

export const BACKDROP_NAMES = Object.keys(MOTIFS);

// Paint the horizon band. `seed` is the level number, so every level in a stage
// gets its own skyline while sharing the stage's motif and palette.
export function drawBackdrop(g, theme, seed, horizon) {
  const motif = MOTIFS[theme.back] || MOTIFS.mountains;
  g.save();
  motif(g, horizon, theme, seed * 7919);
  g.restore();
  // Feather the bottom edge into the playfield, so there's no hard seam where
  // the backdrop stops and the ground starts.
  const fade = g.createLinearGradient(0, horizon * 0.72, 0, horizon * 1.16);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, theme.grass[0]);
  g.fillStyle = fade;
  g.fillRect(0, horizon * 0.72, W, horizon * 0.5);
}
