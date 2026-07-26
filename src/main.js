// Entry point: wires up the module graph (via the imports below — several
// modules register DOM event listeners as a side effect of loading), then
// runs the render/update loop and boots into the world map.
import "./ui.js";
import "./store.js";
import "./heroPicker.js";
import "./guide.js";
import { state, LEVEL } from "./state.js";
import { update } from "./simulation.js";
import { render } from "./render.js";
import { showMap } from "./worldmap.js";
import { showSlotSelect } from "./slots.js";
import { getActiveSlot, loadActiveSlotSilently, syncFromDisk } from "./save.js";
import { UNLOCK_ALL } from "./devFlags.js";

let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  if (LEVEL) {                          // only simulate/draw once a level is loaded
    if (!state.paused) for (let i = 0; i < state.speed; i++) update(dt);
    render();
  }
  requestAnimationFrame(loop);
}

// boot: first pull any newer save-slot-N.json files from disk (auto-save's
// durable copy), then resume straight into the last-used slot's map, or show
// slot-select on a first-ever visit (or after all slots have been forgotten).
// A cheat flag you can't see is a debugging trap — say so on screen.
if (UNLOCK_ALL) {
  document.getElementById("devBadge").hidden = false;
  document.title = "🔓 " + document.title;
}

(async () => {
  await syncFromDisk();
  const lastSlot = getActiveSlot();
  if (lastSlot !== null) {
    loadActiveSlotSilently(lastSlot);
    showMap();
  } else {
    showSlotSelect();
  }
})();
requestAnimationFrame(loop);
