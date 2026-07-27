// Factories + stat math for enemies, towers, barracks soldiers and the hero.
import { CONFIG, SELL_REFUND } from "./config.js";
import { TOWER_TYPES, specDef } from "./data/towerTypes.js";
import { HERO_LEVELING } from "./data/hero.js";
import { SUMMON } from "./data/abilities.js";
import {
  towerDamageMul, splashRadiusMul, soldierHpMul, soldierDamageMul, summonHpMul,
  towerRangeMul, towerFireRateMul, heroPowerMul, sellRefundBonus,
} from "./data/store.js";
import { nearestPointOnPath, pointAtDistance, pathLength } from "./geometry.js";
import { state, PATH, KIT } from "./state.js";

// Armour blunts steel; a ward blunts sorcery. Keeping them as two separate
// resistances is what stops any single tower being the answer to everything —
// the Oracle walks through armour, and walks straight into a ward.
export function damageEnemy(e, dmg, isMagic) {
  if (e.dead) return;
  if (isMagic) { if (e.magicResist) dmg *= 1 - e.magicResist; }
  else if (e.armor) dmg *= 1 - e.armor;
  e.hp -= dmg;
  if (e.hp <= 0) { e.dead = true; state.gold += e.reward; }
}

// entry: { type, hpMul, speedMul } — a single queued spawn. `type` is a ROLE
// ("swift", "brute", …); the active stage's kit decides which creature shows
// up to play it.
export function makeEnemy(entry, dist = 0) {
  const d = KIT[entry.type];
  // A master's health is set outright rather than multiplied by the level's
  // difficulty — see MASTERS in data/enemyKits.js for why.
  const hp = d.absoluteHp ?? d.hp * entry.hpMul;
  const p = dist > 0 ? pointAtDistance(PATH, pathLength(PATH), dist) : PATH[0];
  return {
    // which wave sent it — waves overlap, so "the board is empty" no longer
    // identifies a wave and each creep has to carry its own tag
    type: entry.type, wave: entry.wave ?? 0, def: d, dist,
    speed: d.speed * entry.speedMul,
    maxHp: hp, hp, reward: d.reward, radius: d.radius,
    armor: d.armor, flying: d.flying, boss: !!d.boss, colors: d.colors,
    // role mechanics — absent on most creatures, which is why they're read
    // with `|| 0` everywhere rather than assumed present
    magicResist: d.magicResist || 0,
    // what this creep does to whatever blocks it
    meleeDamage: (d.melee && d.melee.damage) ?? CONFIG.enemy.meleeDamage,
    meleeInterval: (d.melee && d.melee.interval) ?? CONFIG.enemy.attackInterval,
    cleave: (d.melee && d.melee.cleave) || 0,
    regen: (d.regen || 0) * entry.hpMul,   // scales with the wave, like HP
    splits: d.splits || 0,
    hpMul: entry.hpMul, speedMul: entry.speedMul,   // so a brood can seed its young
    x: p.x, y: p.y,
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
    for (let i = 0; i < t.soldierCount; i++) t.soldiers.push(makeSoldier(t, i));
  }
  return t;
}

// Derive a tower's live stats from its base def, current level, chosen
// specialisation and the star store's permanent bonuses. Called on build,
// after each upgrade, and when a specialisation is taken, so all combat code
// can just read t.range / t.damage / t.chain / etc.
//
// Layering, outermost last: base def → specialisation overrides → level
// scaling → store multipliers. A spec's numbers are written as finished ★★★
// values, so level scaling is skipped once one is chosen.
export function computeStats(t) {
  const base = t.def;
  const spec = t.spec ? specDef(t.type, t.spec) : null;
  const d = spec ? { ...base, ...spec } : base;
  const m = spec ? 0 : t.level - 1;   // specs are already fully levelled

  t.stats = d;                        // what combat should read for behaviour
  t.range = d.range * (1 + 0.12 * m) * towerRangeMul();
  t.hitsAir = !!d.hitsAir;

  if (base.attack !== "none") {
    t.damage = Math.round(d.damage * (1 + 0.45 * m) * towerDamageMul(t.type));
    t.fireRate = d.fireRate * (1 + 0.15 * m) * towerFireRateMul();
    t.projectileSpeed = d.projectileSpeed;
    t.splashRadius = d.splashRadius ? d.splashRadius * (1 + 0.12 * m) * splashRadiusMul() : 0;
    // Specialisation effects, passed straight through to the projectile.
    t.chain = d.chain || 0;
    t.slow = d.slow || null;
    t.dot = d.dot || null;
    t.airBonus = d.airBonus || 1;
  } else {
    t.soldierCount = d.soldierCount;
    t.soldierHp = Math.round(d.soldierHp * (1 + 0.4 * m) * soldierHpMul());
    t.soldierDamage = Math.round(d.soldierDamage * (1 + 0.45 * m) * soldierDamageMul());
  }
}

export function upgradeCost(t) { return Math.round(t.def.cost * (0.8 + 0.6 * t.level)); }
export function sellValue(t) { return Math.round(t.invested * (SELL_REFUND + sellRefundBonus())); }

export function makeSoldier(tower, i) {
  const angle = (i / tower.soldierCount) * Math.PI * 2;
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
    const angle = (i / tower.soldierCount) * Math.PI * 2;
    s.home = {
      x: newRally.x + Math.cos(angle) * 14,
      y: newRally.y + Math.sin(angle) * 14,
    };
    s.target = null;
    s.forcedMove = true;
  });
}

export function makeHero(pos, def) {
  const maxHp = Math.round(HERO_LEVELING.maxHpAt(def, 1) * heroPowerMul());
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
    hero.maxHp = Math.round(HERO_LEVELING.maxHpAt(hero.def, hero.level) * heroPowerMul());
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
