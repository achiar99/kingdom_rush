// The level-select world map screen: rendering the node trail, and the
// show-map / start-level transitions between it and the play view.
//
// worldmap.js and ui.js import from each other (startLevel needs resetGame;
// ui's endGame/button wiring needs showMap/startLevel). Safe circularity —
// see simulation.js for why.
import { LEVELS } from "./data/levels.js";
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

export function renderMap() {
  refreshStoreButton();

  // dashed trail connecting the level nodes
  const svg = el("mapTrail");
  const pts = LEVELS.map((lv) => (lv.node.x / 100 * 900) + " " + (lv.node.y / 100 * 560));
  svg.innerHTML = `<path d="M ${pts.join(" L ")}" fill="none" stroke="rgba(255,243,208,0.45)" ` +
    `stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round"/>`;

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
