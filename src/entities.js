// Factories + stat math for enemies, towers, barracks soldiers and the hero.
import { SELL_REFUND } from "./config.js";
import { TOWER_TYPES } from "./data/towerTypes.js";
import { HERO_LEVELING } from "./data/hero.js";
import { SUMMON } from "./data/abilities.js";
import { towerDamageMul, splashRadiusMul, soldierHpMul, soldierDamageMul, summonHpMul } from "./data/store.js";
import { nearestPointOnPath } from "./geometry.js";
import { state, PATH, KIT } from "./state.js";

export function damageEnemy(e, dmg, isMagic) {
  if (e.dead) return;
  if (!isMagic && e.armor) dmg *= 1 - e.armor; // armor resists non-magic damage
  e.hp -= dmg;
  if (e.hp <= 0) { e.dead = true; state.gold += e.reward; }
}

// entry: { type, hpMul, speedMul } — a single queued spawn. `type` is a ROLE
// ("swift", "brute", …); the active stage's kit decides which creature shows
// up to play it.
export function makeEnemy(entry) {
  const d = KIT[entry.type];
  const hp = d.hp * entry.hpMul;
  return {
    type: entry.type, def: d, dist: 0,
    speed: d.speed * entry.speedMul,
    maxHp: hp, hp, reward: d.reward, radius: d.radius,
    armor: d.armor, flying: d.flying, boss: !!d.boss, colors: d.colors,
    x: PATH[0].x, y: PATH[0].y,
    dead: false, engaged: false, attackCd: 0,
  };
}

export function makeTower(spot, typeKey) {
  const type = TOWER_TYPES[typeKey];
  const t = { spot, x: spot.x, y: spot.y, type: typeKey, def: type,
              cooldown: 0, level: 1, invested: type.cost };
  computeStats(t);
  if (type.attack === "none") {
    t.rally = nearestPointOnPath(PATH, spot.x, spot.y);
    t.soldiers = [];
    for (let i = 0; i < type.soldierCount; i++) t.soldiers.push(makeSoldier(t, i));
  }
  return t;
}

// Derive a tower's live stats from its base def, current level and the star
// store's permanent bonuses. Called on build and after each upgrade so all
// combat code can read t.range/t.damage/etc.
export function computeStats(t) {
  const d = t.def, m = t.level - 1;
  t.range = d.range * (1 + 0.12 * m);
  if (d.attack !== "none") {
    t.damage = Math.round(d.damage * (1 + 0.45 * m) * towerDamageMul(t.type));
    t.fireRate = d.fireRate * (1 + 0.15 * m);
    t.projectileSpeed = d.projectileSpeed;
    t.splashRadius = d.splashRadius ? d.splashRadius * (1 + 0.12 * m) * splashRadiusMul() : 0;
  } else {
    t.soldierHp = Math.round(d.soldierHp * (1 + 0.4 * m) * soldierHpMul());
    t.soldierDamage = Math.round(d.soldierDamage * (1 + 0.45 * m) * soldierDamageMul());
  }
}

export function upgradeCost(t) { return Math.round(t.def.cost * (0.8 + 0.6 * t.level)); }
export function sellValue(t) { return Math.round(t.invested * SELL_REFUND); }

export function makeSoldier(tower, i) {
  const angle = (i / tower.def.soldierCount) * Math.PI * 2;
  const home = {
    x: tower.rally.x + Math.cos(angle) * 14,
    y: tower.rally.y + Math.sin(angle) * 14,
  };
  return {
    home, x: home.x, y: home.y, hp: tower.soldierHp, maxHp: tower.soldierHp,
    alive: true, respawn: 0, target: null, attackCd: 0, sinceHit: 0,
    forcedMove: false,
  };
}

// Relocate a barracks' rally point (player-chosen, within tower.range of the
// tower — see ui.js's reposition mode). Soldiers drop whatever they were
// doing and walk to the new point at their normal speed (updateBarracks
// handles the actual movement each frame) — they don't teleport there.
// `forcedMove` suppresses ALL target-acquisition (same idea as the hero's
// commandHero) so a cluster of nearby enemies can't keep grabbing a soldier's
// attention on the way — it walks the whole distance before fighting again.
export function relocateRally(tower, newRally) {
  tower.rally = newRally;
  tower.soldiers.forEach((s, i) => {
    const angle = (i / tower.def.soldierCount) * Math.PI * 2;
    s.home = {
      x: newRally.x + Math.cos(angle) * 14,
      y: newRally.y + Math.sin(angle) * 14,
    };
    s.target = null;
    s.forcedMove = true;
  });
}

export function makeHero(pos, def) {
  const maxHp = HERO_LEVELING.maxHpAt(def, 1);
  return {
    def, x: pos.x, y: pos.y, commandPos: { x: pos.x, y: pos.y },
    level: 1, xp: 0,                  // grows by fighting — see gainHeroXp
    hp: maxHp, maxHp,
    alive: true, respawn: 0, target: null, attackCd: 0, shootCd: 0, sinceHit: 0,
    forcedMove: false,
  };
}

// Award hero XP (melee damage dealt + kill bounties). Levelling up re-derives
// max HP, refills it, and celebrates with a gold ring. Returns true if at
// least one level was gained so the caller can announce it.
export function gainHeroXp(hero, amount) {
  if (hero.level >= HERO_LEVELING.maxLevel) return false;
  hero.xp += amount;
  let leveled = false;
  while (hero.level < HERO_LEVELING.maxLevel && hero.xp >= HERO_LEVELING.xpForNext(hero.level)) {
    hero.xp -= HERO_LEVELING.xpForNext(hero.level);
    hero.level++;
    hero.maxHp = HERO_LEVELING.maxHpAt(hero.def, hero.level);
    hero.hp = hero.maxHp;
    leveled = true;
    state.effects.push({ x: hero.x, y: hero.y, maxR: 42, life: 0.6, maxLife: 0.6, kind: "levelup" });
  }
  if (hero.level >= HERO_LEVELING.maxLevel) hero.xp = 0; // bar reads full/idle at cap
  return leveled;
}

// Player clicked the battlefield: send the hero there — immediately, even if
// it's mid-fight, and even if there's a whole wave of enemies clustered
// around it that would otherwise give it something new to fight on the very
// next tick. `forcedMove` suppresses ALL target-acquisition (not just a
// grudge against the one enemy it was fighting) until it physically reaches
// commandPos — see updateHero, which clears the flag on arrival.
export function commandHero(hero, x, y) {
  hero.commandPos = { x, y };
  hero.target = null;
  hero.forcedMove = true;
}

// "Reinforcements" ability: a temporary soldier that fights like a Barracks
// soldier but has no tower, no rally leash and no respawn — it just expires
// (`life` counts down in updateSummonedSoldiers) 7 seconds after arriving.
export function makeSummonedSoldier(pos, angle) {
  const home = { x: pos.x + Math.cos(angle) * 16, y: pos.y + Math.sin(angle) * 16 };
  const hp = Math.round(SUMMON.hp * summonHpMul());
  return {
    home, x: home.x, y: home.y, hp, maxHp: hp,
    alive: true, target: null, attackCd: 0, life: SUMMON.lifespan,
  };
}
