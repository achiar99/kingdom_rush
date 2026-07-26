// The level-select world map screen: rendering the node trail, and the
// show-map / start-level transitions between it and the play view.
//
// worldmap.js and ui.js import from each other (startLevel needs resetGame;
// ui's endGame/button wiring needs showMap/startLevel). Safe circularity —
// see simulation.js for why.
import { LEVELS, THEMES } from "./data/levels.js";
import { el, setView } from "./dom.js";
import { state, loadLevel } from "./state.js";
import { progress, getStars } from "./save.js";
import { closeMenus, resetGame } from "./ui.js";
import { refreshStoreButton } from "./store.js";

export function showMap() {
  state.paused = true;                 // freeze any in-progress game underneath
  el("overlay").classList.remove("show");
  closeMenus();
  setView("map");
  renderMap();
}

export function startLevel(idx) {
  loadLevel(idx);
  setView("play");
  resetGame();
}

// Catmull-Rom spline through the node points → cubic beziers, so the trail
// reads as one flowing journey instead of a jagged polyline.
function trailD(p) {
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function renderMap() {
  refreshStoreButton();

  // blurred terrain glow per realm (tinted with its theme) + the dashed trail
  const svg = el("mapTrail");
  const pts = LEVELS.map((lv) => [lv.node.x / 100 * 900, lv.node.y / 100 * 560]);
  svg.innerHTML =
    `<defs><filter id="regionBlur" x="-80%" y="-80%" width="260%" height="260%">` +
    `<feGaussianBlur stdDeviation="20"/></filter></defs>` +
    LEVELS.map((lv, i) =>
      `<ellipse cx="${pts[i][0]}" cy="${pts[i][1]}" rx="95" ry="66" ` +
      `fill="${THEMES[lv.theme].grass[0]}" opacity="0.28" filter="url(#regionBlur)"/>`).join("") +
    `<path d="${trailD(pts)}" fill="none" stroke="rgba(255,243,208,0.4)" ` +
    `stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>`;

  const nodes = el("mapNodes");
  nodes.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const unlocked = i < progress.unlocked;
    const done = progress.done.includes(lv.id);
    const stars = getStars(lv.id);
    const btn = document.createElement("button");
    btn.className = "map-node" + (unlocked ? "" : " locked") + (done ? " done" : "");
    btn.style.left = lv.node.x + "%";
    btn.style.top = lv.node.y + "%";
    const disc = unlocked ? (i + 1) : "🔒";
    const starsRow = done
      ? `<div class="node-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>` : "";
    btn.innerHTML =
      `<div class="disc">${disc}</div>` +
      `<div class="label">${lv.name}</div><div class="diff">${lv.difficulty}</div>${starsRow}`;
    if (unlocked) btn.addEventListener("click", () => startLevel(i));
    nodes.appendChild(btn);
  });
}
