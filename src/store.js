// The star Upgrade Store panel (map screen): browse the tracks defined in
// data/store.js, buy ranks with earned stars, refund everything. Purchases
// live in `progress.upgrades` and persist with the active save slot.
import { TRACKS, RANK_COSTS, MAX_RANK, rankOf, starsEarned, starsSpent, starsAvailable } from "./data/store.js";
import { progress, saveProgress } from "./save.js";
import { el } from "./dom.js";

// map-screen button label doubles as the "unspent stars" indicator
export function refreshStoreButton() {
  const avail = starsAvailable();
  el("storeBtn").textContent = "⭐ Upgrade store" + (avail > 0 ? ` (${avail})` : "");
}

function render() {
  el("storeStars").textContent =
    `★ ${starsAvailable()} available · ${starsEarned()} earned · ${starsSpent()} spent`;

  const wrap = el("storeTracks");
  wrap.innerHTML = "";
  for (const track of TRACKS) {
    const rank = rankOf(track.key);
    const maxed = rank >= MAX_RANK;
    const cost = maxed ? 0 : RANK_COSTS[rank];

    const card = document.createElement("div");
    card.className = "store-track";
    const pips = "★".repeat(rank) + "☆".repeat(MAX_RANK - rank);
    card.innerHTML =
      `<div class="row1"><span>${track.icon}</span><span>${track.name}</span>` +
      `<span class="ranks">${pips}</span></div>` +
      `<div class="per">${track.per} per rank</div>`;

    const btn = document.createElement("button");
    btn.disabled = maxed || starsAvailable() < cost;
    btn.textContent = maxed ? "Maxed out" : `Buy rank ${rank + 1} — ★${cost}`;
    if (!maxed) btn.addEventListener("click", () => buy(track.key));
    card.appendChild(btn);
    wrap.appendChild(card);
  }
  refreshStoreButton();
}

function buy(key) {
  const rank = rankOf(key);
  if (rank >= MAX_RANK || starsAvailable() < RANK_COSTS[rank]) return;
  if (!progress.upgrades) progress.upgrades = {};
  progress.upgrades[key] = rank + 1;
  saveProgress();
  render();
}

el("storeBtn").addEventListener("click", () => { render(); el("storeModal").hidden = false; });
el("storeClose").addEventListener("click", () => { el("storeModal").hidden = true; });
el("storeReset").addEventListener("click", () => {
  progress.upgrades = {};
  saveProgress();
  render();
});
// clicking the dimmed backdrop closes the panel too
el("storeModal").addEventListener("click", (ev) => {
  if (ev.target === el("storeModal")) el("storeModal").hidden = true;
});
