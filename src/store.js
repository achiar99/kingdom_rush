// The star Upgrade Store panel (map screen), styled like a wooden upgrade
// board: one vertical column per track from data/store.js, with circular
// rank nodes bought top-to-bottom. Purchases live in `progress.upgrades`
// and persist with the active save slot.
import { TRACKS, RANK_COSTS, MAX_RANK, rankOf, starsAvailable } from "./data/store.js";
import { progress, saveProgress } from "./save.js";
import { el } from "./dom.js";

// map-screen button label doubles as the "unspent stars" indicator
export function refreshStoreButton() {
  const avail = starsAvailable();
  el("storeBtn").textContent = "⭐ Upgrade store" + (avail > 0 ? ` (${avail})` : "");
}

function render() {
  el("storeStars").textContent = `⭐ ${starsAvailable()}`;

  const wrap = el("storeTracks");
  wrap.innerHTML = "";
  for (const track of TRACKS) {
    const owned = rankOf(track.key);

    const col = document.createElement("div");
    col.className = "track";
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.innerHTML = `<div class="rail"></div>`;

    for (let r = 1; r <= MAX_RANK; r++) {
      const bought = r <= owned;
      const next = r === owned + 1;
      const cost = RANK_COSTS[r - 1];
      const btn = document.createElement("button");
      btn.className = "rank " + (bought ? "bought" : next ? "next" : "locked");
      if (next && starsAvailable() >= cost) btn.classList.add("affordable");
      btn.style.setProperty("--tc-light", track.colors[0]);
      btn.style.setProperty("--tc-dark", track.colors[1]);
      btn.innerHTML = `<span>${track.icon}</span>` + (bought ? "" : `<span class="cost">★${cost}</span>`);
      if (next) btn.addEventListener("click", () => buy(track.key));
      btn.addEventListener("mouseenter", () => showTip(btn, track, r, bought, next, cost));
      btn.addEventListener("mouseleave", hideTip);
      slot.appendChild(btn);
    }
    col.appendChild(slot);

    const icon = document.createElement("div");
    icon.className = "track-icon";
    icon.textContent = track.icon;
    icon.title = track.name;
    col.appendChild(icon);
    wrap.appendChild(col);
  }
  refreshStoreButton();
}

// tooltip beside the hovered rank node (flips left near the viewport edge)
function showTip(node, track, r, bought, next, cost) {
  const tip = el("storeTip");
  const status = bought ? "✔ Owned"
    : next ? (starsAvailable() >= cost ? `Click to buy — ★${cost}` : `Costs ★${cost} · you have ⭐${starsAvailable()}`)
    : `Buy rank ${r - 1} first`;
  tip.innerHTML = `<b>${track.name} — rank ${r}/${MAX_RANK}</b><br>${track.per} per rank.<br>${status}`;
  tip.hidden = false;
  const rc = node.getBoundingClientRect();
  let left = rc.right + 12;
  if (left + tip.offsetWidth > window.innerWidth - 8) left = rc.left - tip.offsetWidth - 12;
  tip.style.left = Math.max(8, left) + "px";
  tip.style.top = Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8,
    rc.top + rc.height / 2 - tip.offsetHeight / 2)) + "px";
}

function hideTip() { el("storeTip").hidden = true; }

function buy(key) {
  const rank = rankOf(key);
  if (rank >= MAX_RANK || starsAvailable() < RANK_COSTS[rank]) return;
  if (!progress.upgrades) progress.upgrades = {};
  progress.upgrades[key] = rank + 1;
  saveProgress();
  hideTip();
  render();
}

el("storeBtn").addEventListener("click", () => { render(); el("storeModal").hidden = false; });
el("storeClose").addEventListener("click", () => { hideTip(); el("storeModal").hidden = true; });
el("storeReset").addEventListener("click", () => {
  progress.upgrades = {};
  saveProgress();
  hideTip();
  render();
});
// clicking the dimmed backdrop closes the panel too
el("storeModal").addEventListener("click", (ev) => {
  if (ev.target === el("storeModal")) { hideTip(); el("storeModal").hidden = true; }
});
