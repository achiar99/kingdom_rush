// Factories + stat math for enemies, towers and barracks soldiers.
import { SELL_REFUND } from "./config.js";
import { ENEMY_TYPES } from "./data/enemyTypes.js";
import { TOWER_TYPES } from "./data/towerTypes.js";
import { nearestPointOnPath } from "./geometry.js";
import { state, PATH } from "./state.js";

export function damageEnemy(e, dmg, isMagic) {
  if (e.dead) return;
  if (!isMagic && e.armor) dmg *= 1 - e.armor; // armor resists non-magic damage
  e.hp -= dmg;
  if (e.hp <= 0) { e.dead = true; state.gold += e.reward; }
}

// entry: { type, hpMul, speedMul } — a single queued spawn.
export function makeEnemy(entry) {
  const d = ENEMY_TYPES[entry.type];
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

// Derive a tower's live stats from its base def and current level. Called on
// build and after each upgrade so all combat code can read t.range/t.damage/etc.
export function computeStats(t) {
  const d = t.def, m = t.level - 1;
  t.range = d.range * (1 + 0.12 * m);
  if (d.attack !== "none") {
    t.damage = Math.round(d.damage * (1 + 0.45 * m));
    t.fireRate = d.fireRate * (1 + 0.15 * m);
    t.projectileSpeed = d.projectileSpeed;
    t.splashRadius = d.splashRadius ? d.splashRadius * (1 + 0.12 * m) : 0;
  } else {
    t.soldierHp = Math.round(d.soldierHp * (1 + 0.4 * m));
    t.soldierDamage = Math.round(d.soldierDamage * (1 + 0.45 * m));
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
    alive: true, respawn: 0, target: null, attackCd: 0,
  };
}

// Relocate a barracks' rally point (player-chosen, within tower.range of the
// tower — see ui.js's reposition mode). Soldiers abandon whatever they were
// doing and redeploy around the new point immediately.
export function relocateRally(tower, newRally) {
  tower.rally = newRally;
  tower.soldiers.forEach((s, i) => {
    const angle = (i / tower.def.soldierCount) * Math.PI * 2;
    s.home = {
      x: newRally.x + Math.cos(angle) * 14,
      y: newRally.y + Math.sin(angle) * 14,
    };
    s.target = null;
    s.x = s.home.x;
    s.y = s.home.y;
  });
}
