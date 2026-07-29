// The hero picker panel (map screen), styled like the star upgrade store:
// a wooden modal listing every champion as a card. Selecting one writes
// `progress.hero` and persists with the active save slot; it takes effect
// on the next battle started.
//
// Champions are recruited across the campaign (data/hero.js): a locked card
// shows WHERE its champion joins instead of hiding — knowing who's coming is
// half the reason to push on — and the picker button itself only exists once
// the first champion has arrived.
import { HEROES } from "./data/hero.js";
import { LEVELS } from "./data/levels.js";
import { progress, saveProgress, heroUnlocked, anyHeroUnlocked, fieldedHero } from "./save.js";
import { el } from "./dom.js";

function currentHero() {
  return fieldedHero(); // the slot's pick if recruited, else the newest recruit
}

// map-screen button mirrors the current pick, like the store button mirrors
// stars — and disappears entirely while no champion has been recruited.
export function refreshHeroPickButton() {
  const key = currentHero();
  el("heroPickBtn").hidden = !key;
  if (!key) return;
  const def = HEROES[key];
  el("heroPickLabel").textContent = def.name;
  el("heroPickBtn").querySelector(".hbicon").textContent = def.icon;
}

function render() {
  const chosen = currentHero();
  const wrap = el("heroCards");
  wrap.innerHTML = "";
  for (const def of Object.values(HEROES)) {
    const unlocked = heroUnlocked(def.key);
    const selected = unlocked && def.key === chosen;
    const at = LEVELS[def.unlockAt];
    const card = document.createElement("button");
    card.className = "hero-card" + (selected ? " selected" : "") + (unlocked ? "" : " locked");
    card.disabled = !unlocked;
    card.style.setProperty("--hc-light", def.colors.light);
    card.style.setProperty("--hc-dark", def.colors.dark);
    card.innerHTML =
      `<span class="hicon">${unlocked ? def.icon : "🔒"}</span><b>${def.name}</b>` +
      `<span class="htag">${def.tagline}</span>` +
      (unlocked
        ? `<span class="hstats">${def.attack === "ranged" ? "🏹" : "⚔️"} ${def.damage}/${def.attackInterval}s<br>` +
          `❤️ ${def.maxHp} · 👟 ${def.speed}</span>` +
          `<span class="hpick">Selected</span>`
        : `<span class="hstats">Joins the war at<br><b>${at.difficulty} · ${at.name}</b></span>`);
    if (unlocked) card.addEventListener("click", () => {
      if (def.key === progress.hero) return;
      progress.hero = def.key;
      saveProgress();
      render();
      refreshHeroPickButton();
    });
    wrap.appendChild(card);
  }
}

el("heroPickBtn").addEventListener("click", () => { render(); el("heroModal").hidden = false; });
el("heroClose").addEventListener("click", () => { el("heroModal").hidden = true; });
// clicking the dimmed backdrop closes the panel too
el("heroModal").addEventListener("click", (ev) => {
  if (ev.target === el("heroModal")) el("heroModal").hidden = true;
});
