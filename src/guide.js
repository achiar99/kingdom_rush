// The Field Guide: what every tower, enemy and champion actually does.
//
// This replaces the two rows of legend text that used to sit under the
// battlefield. That legend had grown longer than the battlefield itself, it
// was unreadable mid-wave, and it could only ever describe the stage you were
// already in. A guide you open deliberately from the map can cover the whole
// game and take the room it needs.
//
// Every word here is generated from the data modules — tower stats from
// TOWER_TYPES, creature stats from ENEMY_KITS, champions from HEROES. Nothing
// is transcribed, so the guide cannot drift out of step with the game the way
// the hand-written legend did.
import { TOWER_TYPES, TYPE_LIST, specsFor } from "./data/towerTypes.js";
import { ENEMY_KITS, ROLES, MASTERS } from "./data/enemyKits.js";
import { HEROES, HERO_LEVELING } from "./data/hero.js";
import { STAGES } from "./data/stages.js";
import { el } from "./dom.js";
import { withCanvas } from "./render/canvas.js";
import { drawTower } from "./render/towers.js";
import { drawEnemy } from "./render/monsters.js";
import { drawHero } from "./render/units.js";
import { makeHero } from "./entities.js";

// ------------------------------------------------------------- thumbnails
// Real art, drawn by the real renderers into a small canvas — see
// render/canvas.js's withCanvas(). Anything else means maintaining a second
// set of pictures that silently stops matching the game.
//
// Each thumbnail is filled after the panel is in the DOM, so the entries below
// just leave a placeholder <canvas data-art="..."> and paintThumbnails() finds
// them. Devices with a retina display get a 2x backing store.
// Tiles come in three sizes (main row, specialisation card, per-stage strip)
// and one of them is fluid, so the backing store is sized from what the
// element actually measures. Fixing it to a constant is what squashed the
// specialisation art on the first attempt.
function paintThumbnails() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const cv of document.querySelectorAll("#guideBody canvas[data-art]")) {
    const box = cv.getBoundingClientRect();
    const w = Math.max(40, Math.round(box.width));
    const h = Math.max(36, Math.round(box.height));
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    const [kind, key, extra] = cv.dataset.art.split(":");
    try {
      withCanvas(g, () => paintOne(g, w, h, kind, key, extra));
    } catch (err) {
      // A thumbnail that can\u2019t draw must never take the guide down with it.
      g.fillStyle = "rgba(255,255,255,0.15)";
      g.fillRect(w / 2 - 8, h / 2 - 8, 16, 16);
    }
  }
}

function paintOne(g, w, h, kind, key, extra) {
  const place = (scale, ty) => { g.translate(w / 2, ty); g.scale(scale, scale); };

  if (kind === "tower") {
    // Towers draw upward from their footing, and the tallest of them (Amazon
    // Longbows) is about 80px, so the scale is derived from the tile height
    // rather than fixed — otherwise the tall ones lose their roofs.
    place(Math.min(0.62, (h - 8) / 80), h - 6);
    drawTower({ x: 0, y: 0, type: key, level: 3, spec: extra || null,
                fireRate: 1, cooldown: 0, range: 0, hitsAir: true });
    return;
  }
  if (kind === "hero") {
    place(Math.min(1.6, (h - 10) / 34), h - 12);
    const hero = makeHero({ x: 0, y: 0 }, HEROES[key]);
    hero.level = 6;
    drawHero(hero);
    return;
  }
  // Enemy: normalise every creature to the same drawn size regardless of its
  // real radius, and sit it low enough that the health bar drawEnemy always
  // paints falls above the top edge instead of cluttering the tile.
  const c = kind === "master" ? MASTERS[key] : ENEMY_KITS[extra].creatures[key];
  // Normalise to a target drawn size. Divide out the recipe's own `scale` as
  // well as the radius — drawEnemy applies that internally, so without this a
  // 1.5x master compounds with the tile scale and bursts out of its frame.
  const target = kind === "master" ? 17 : 15;    // masters still read bigger
  const own = (c.art && c.art.scale) || 1;
  place(Math.min(1.45, (h - 6) / 32) * (target / c.radius) / own, h - 8);
  drawEnemy({
    x: 0, y: 0, dist: 40, radius: c.radius, colors: c.colors, def: c,
    hp: 1, maxHp: 1, flying: c.flying, boss: !!c.boss,
    engaged: false, dead: false, hideHpBar: true,
  });
}

const thumb = (art) => `<canvas class="g-art" data-art="${art}"></canvas>`;

const pct = (v) => Math.round(v * 100) + "%";
const stat = (text, cls = "") => `<span class="g-stat ${cls}">${text}</span>`;

// ------------------------------------------------------------------ towers
function towersTab() {
  const lead =
    `<div class="g-lead">Towers are built on the marble footings beside the road and upgraded ` +
    `with gold. At ★★★ each one offers a permanent choice between two specialisations.</div>`;

  return lead + TYPE_LIST.map((key) => {
    const d = TOWER_TYPES[key];
    const stats = [];
    if (d.attack === "none") {
      stats.push(stat(`${d.soldierCount} hoplites`), stat(`${d.soldierHp} hp each`),
        stat(`${d.soldierDamage} dmg`), stat(`leash ${d.range}`),
        stat("cannot touch flyers", "warn"));
    } else {
      stats.push(stat(`${d.damage} dmg`), stat(`${d.fireRate.toFixed(2)}/s`),
        stat(`range ${d.range}`));
      if (d.splashRadius) stats.push(stat(`blast ${d.splashRadius}`));
      if (key === "magic") stats.push(stat("ignores armour", "good"));
      stats.push(d.hitsAir ? stat("hits flyers", "good") : stat("ground only", "warn"));
    }

    const specs = specsFor(key).map((sp) =>
      `<div class="g-spec">${thumb(`tower:${key}:${sp.key}`)}<div>` +
      `<b>${sp.icon} ${sp.name}</b>` +
      `<span class="g-cost" style="color:var(--gold)"> 💰${sp.cost}</span>` +
      `<div class="g-desc">${sp.blurb}</div></div></div>`).join("");

    return `<div class="g-entry">
      ${thumb(`tower:${key}`)}
      <div>
        <div class="g-name">${d.icon} ${d.name}<span class="g-cost">💰${d.cost}</span></div>
        <div class="g-desc">${d.blurb}</div>
        <div class="g-stats">${stats.join("")}</div>
      </div>
      <div class="g-sub">${specs}</div>
    </div>`;
  }).join("");
}

// ----------------------------------------------------------------- enemies
// Organised by ROLE rather than by stage. A player needs to know what a
// "warded" is and what beats it; which stage happens to call it a Dryad or a
// Gorgon Acolyte is the secondary detail, so it goes last on the row.
const ROLE_GUIDE = {
  swarm:     { icon: "🚶", answer: "Anything. This is what fills the road." },
  swift:     { icon: "💨", answer: "Slow it, block it, or catch it early — it spends half as long under fire as anything else." },
  shielded:  { icon: "🛡️", answer: "The Oracle. Armour blunts arrows and bolts; sorcery goes straight through." },
  brute:     { icon: "🐘", answer: "Sustained damage and a Phalanx to hold it still while you apply it." },
  winged:    { icon: "🕊️", answer: "Toxotai, the Oracle, or a Scorpion Battery. The Phalanx and the plain Ballista cannot reach it." },
  warded:    { icon: "✨", answer: "Steel, not sorcery. An all-Oracle board grinds to a halt against these." },
  stormborn: { icon: "⚡", answer: "The Oracle — it's the one tower that ignores the armour AND reaches the air." },
  brood:     { icon: "🥚", answer: "Kill it early, away from your line. Splash alone just makes more of them." },
  revenant:  { icon: "♻️", answer: "Burn it. Ignite or the Shrine of Hekate stop it healing; slow chip damage never will." },
  champion:  { icon: "👑", answer: "Everything you have, plus your champion and both abilities." },
};

function enemiesTab() {
  const lead =
    `<div class="g-lead">Every stage fields the same ten tactical roles — only the creatures ` +
    `playing them change. Learn the role once and it carries the whole campaign.</div>`;

  return lead + ROLES.map((role) => {
    const g = ROLE_GUIDE[role];
    const base = ENEMY_KITS.troy.creatures[role];   // stats are shared across kits
    const stats = [stat(`${base.hp} hp`), stat(`${base.speed} speed`), stat(`💰${base.reward}`)];
    if (base.armor) stats.push(stat(`${pct(base.armor)} armour`, "warn"));
    if (base.magicResist) stats.push(stat(`${pct(base.magicResist)} magic ward`, "warn"));
    if (base.flying) stats.push(stat("flies", "warn"));
    if (base.splits) stats.push(stat(`splits into ${base.splits}`, "warn"));
    if (base.regen) stats.push(stat(`regenerates ${base.regen}/s`, "warn"));

    // One thumbnail per stage: this role looks completely different in Troy
    // and in Hades, and that IS the content.
    const byStage = STAGES.map((st) =>
      `<figure class="g-kit">${thumb(`enemy:${role}:${st.kit}`)}` +
      `<figcaption><b>${ENEMY_KITS[st.kit].creatures[role].name}</b>` +
      `<span>Stage ${st.numeral}</span></figcaption></figure>`).join("");

    return `<div class="g-entry">
      ${thumb(`enemy:${role}:troy`)}
      <div>
        <div class="g-name">${g.icon} ${role[0].toUpperCase() + role.slice(1)}</div>
        <div class="g-desc">${g.answer}</div>
        <div class="g-stats">${stats.join("")}</div>
      </div>
      <div class="g-kits">${byStage}</div>
    </div>`;
  }).join("") + mastersSection();
}

// The five named figures that close out a stage. Kept apart from the roles
// above because that's what they are: not a kind of enemy you learn to handle,
// but one specific fight you meet once.
function mastersSection() {
  const rows = STAGES.map((st) => {
    const m = MASTERS[st.kit];
    const stats = [stat(`${m.hp} hp`), stat(`${m.speed} speed`), stat(`💰${m.reward}`),
      stat(`${pct(m.armor)} armour`, "warn"), stat(`${pct(m.magicResist)} magic ward`, "warn")];
    return `<div class="g-entry">
      ${thumb(`master:${st.kit}`)}
      <div>
        <div class="g-name">${st.icon} ${m.name}</div>
        <div class="g-desc">Stage ${st.numeral} · ${st.name} — final wave of the last level.</div>
        <div class="g-stats">${stats.join("")}</div>
      </div>
    </div>`;
  }).join("");

  return `<div class="g-section">Stage masters</div>` +
    `<div class="g-lead">Each stage ends with one named figure, met exactly once. ` +
    `They carry both armour and a ward, so neither an all-Oracle nor an all-Toxotai ` +
    `board will get through — bring a line that does two things well.</div>` + rows;
}

// ----------------------------------------------------------------- heroes
function heroesTab() {
  const lead =
    `<div class="g-lead">One champion fights for you, chosen on the map and shared by every ` +
    `level. It is free, it respawns, and it grows from level 1 to ${HERO_LEVELING.maxLevel} ` +
    `by fighting. Click it, then click the ground, to send it somewhere.</div>`;

  return lead + Object.values(HEROES).map((h) => {
    const dps = (h.damage / h.attackInterval).toFixed(1);
    const stats = [
      stat(`${h.maxHp} hp`), stat(`${dps} dps`), stat(`${h.speed} speed`),
      stat(`${h.respawnTime}s respawn`),
    ];
    stats.push(h.attack === "ranged"
      ? stat(`shoots at ${h.range} — hits flyers`, "good")
      : stat("melee — blocks ground creeps", "good"));
    if (h.magic) stats.push(stat("ignores armour", "good"));
    if (h.attack === "ranged") stats.push(stat("does not block", "warn"));

    return `<div class="g-entry">
      ${thumb(`hero:${h.key}`)}
      <div>
        <div class="g-name">${h.icon} ${h.name}</div>
        <div class="g-desc">${h.tagline}</div>
        <div class="g-stats">${stats.join("")}</div>
      </div>
    </div>`;
  }).join("");
}

const TABS = { towers: towersTab, enemies: enemiesTab, heroes: heroesTab };

function show(tab) {
  for (const b of document.querySelectorAll(".gtab"))
    b.classList.toggle("active", b.dataset.tab === tab);
  el("guideBody").innerHTML = TABS[tab]();
  el("guideBody").scrollTop = 0;
  paintThumbnails();
}

el("guideBtn").addEventListener("click", () => {
  show("towers");
  el("guideModal").hidden = false;
});
el("guideClose").addEventListener("click", () => { el("guideModal").hidden = true; });
el("guideModal").addEventListener("click", (ev) => {
  if (ev.target === el("guideModal")) el("guideModal").hidden = true;
});
for (const b of document.querySelectorAll(".gtab"))
  b.addEventListener("click", () => show(b.dataset.tab));
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") el("guideModal").hidden = true;
});
