// The hero picker panel (map screen), styled like the star upgrade store:
// a wooden modal listing every champion as a card. Selecting one writes
// `progress.hero` and persists with the active save slot; it takes effect
// on the next battle started.
import { HEROES, DEFAULT_HERO } from "./data/hero.js";
import { progress, saveProgress } from "./save.js";
import { el } from "./dom.js";

function currentHero() {
  return HEROES[progress.hero] ? progress.hero : DEFAULT_HERO;
}

// map-screen button mirrors the current pick, like the store button mirrors stars
export function refreshHeroPickButton() {
  const def = HEROES[currentHero()];
  el("heroPickLabel").textContent = def.name;
  el("heroPickBtn").querySelector(".hbicon").textContent = def.icon;
}

function render() {
  const chosen = currentHero();
  const wrap = el("heroCards");
  wrap.innerHTML = "";
  for (const def of Object.values(HEROES)) {
    const selected = def.key === chosen;
    const card = document.createElement("button");
    card.className = "hero-card" + (selected ? " selected" : "");
    card.style.setProperty("--hc-light", def.colors.light);
    card.style.setProperty("--hc-dark", def.colors.dark);
    card.innerHTML =
      `<span class="hicon">${def.icon}</span><b>${def.name}</b>` +
      `<span class="htag">${def.tagline}</span>` +
      `<span class="hstats">${def.attack === "ranged" ? "🏹" : "⚔️"} ${def.damage}/${def.attackInterval}s<br>` +
      `❤️ ${def.maxHp} · 👟 ${def.speed}</span>` +
      `<span class="hpick">Selected</span>`;
    card.addEventListener("click", () => {
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
