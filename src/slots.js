// The save-slot picker: 3 independent playthroughs, each with its own level
// progress. Shown at boot (unless a slot was already active last visit) and
// reachable from the world map via the "Switch slot" button.
import { LEVELS } from "./data/levels.js";
import { el, setView } from "./dom.js";
import { SLOT_COUNT, getSlotInfo, selectSlot, deleteSlot } from "./save.js";
import { showMap } from "./worldmap.js";

export function showSlotSelect() {
  setView("slots");
  renderSlotScreen();
}

export function renderSlotScreen() {
  const list = el("slotList");
  list.innerHTML = "";
  for (let i = 0; i < SLOT_COUNT; i++) {
    const info = getSlotInfo(i);
    const card = document.createElement("div");
    card.className = "slot-card" + (info.exists ? "" : " empty");

    const title = document.createElement("div");
    title.className = "slot-title";
    title.textContent = "Slot " + (i + 1);
    card.appendChild(title);

    const status = document.createElement("div");
    status.className = "slot-status";
    status.textContent = info.exists
      ? `${info.unlocked}/${LEVELS.length} realms unlocked · ${info.doneCount} completed`
      : "Empty — start a new game";
    card.appendChild(status);

    if (info.exists && info.updatedAt) {
      const when = document.createElement("div");
      when.className = "slot-when";
      when.textContent = "Last played " + new Date(info.updatedAt).toLocaleDateString();
      card.appendChild(when);
    }

    const row = document.createElement("div");
    row.className = "slot-actions";

    const playBtn = document.createElement("button");
    playBtn.textContent = info.exists ? "▶ Play" : "▶ New game";
    playBtn.addEventListener("click", () => { selectSlot(i); showMap(); });
    row.appendChild(playBtn);

    if (info.exists) {
      const delBtn = document.createElement("button");
      delBtn.className = "secondary";
      delBtn.textContent = "🗑 Delete";
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!confirm("Delete Slot " + (i + 1) + "? This can't be undone.")) return;
        deleteSlot(i);
        renderSlotScreen();
      });
      row.appendChild(delBtn);
    }

    card.appendChild(row);
    list.appendChild(card);
  }
}
