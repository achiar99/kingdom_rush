// Every move a player can make, with all its rules — unlock gates, gold
// costs, cooldowns, range limits — and none of its presentation.
//
// ui.js calls these from click handlers and turns the {ok, reason} results
// into tips and greyed-out buttons; the balance harness in tools/sim calls
// exactly the same functions from a bot. That shared path is the point: a
// simulated run can't accidentally play by different rules than a real one.
import { MAX_LEVEL } from "./config.js";
import { TOWER_TYPES, specDef } from "./data/towerTypes.js";
import { towerUnlockWave, abilityUnlockWave, currentWave, maxTowerLevelFor } from "./data/unlocks.js";
import { ABILITY_COOLDOWN, SUMMON, FIRE } from "./data/abilities.js";
import { summonCountBonus, fireDpsMul, fireDurationBonus } from "./data/store.js";
import { dist, nearestPointOnPath } from "./geometry.js";
import { state, PATH, LEVEL, spotOccupied } from "./state.js";
import {
  makeTower, computeStats, upgradeCost, sellValue, relocateRally,
  makeSoldier, makeSummonedSoldier, commandHero,
} from "./entities.js";

const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

// ------------------------------------------------------------------ unlocks
// { locked, wave } — wave is the 1-based wave it opens at, or null when the
// thing never becomes available in this realm at all.
export function towerUnlockState(key) {
  if (!LEVEL) return { locked: true, wave: null };
  const wave = towerUnlockWave(LEVEL.index, key);
  return { locked: wave === null || currentWave(state) < wave, wave };
}

export function abilityUnlockState(key) {
  if (!LEVEL) return { locked: true, wave: null };
  const wave = abilityUnlockWave(LEVEL.index, key);
  return { locked: wave === null || currentWave(state) < wave, wave };
}

// ------------------------------------------------------------------- towers
export function canBuild(spot, key) {
  const def = TOWER_TYPES[key];
  if (!def) return no("No such tower.");
  if (towerUnlockState(key).locked) return no(def.name + " isn't unlocked yet.");
  if (spotOccupied(spot)) return no("That spot is taken.");
  if (state.gold < def.cost) return no("Not enough gold for " + def.name + " (need " + def.cost + ").");
  return OK;
}

export function buildTower(spot, key) {
  const check = canBuild(spot, key);
  if (!check.ok) return check;
  state.gold -= TOWER_TYPES[key].cost;
  state.towers.push(makeTower(spot, key));
  return OK;
}

export function canUpgrade(t) {
  if (t.spec) return no("Specialised");
  if (t.level >= MAX_LEVEL) return no("Max level");
  if (t.level >= maxTowerLevelFor(LEVEL.index)) return no("Upgrades unlock in later realms");
  const cost = upgradeCost(t);
  if (state.gold < cost) return no("Not enough gold to upgrade (need " + cost + ").");
  return OK;
}

export function upgradeTower(t) {
  const check = canUpgrade(t);
  if (!check.ok) return check;
  const cost = upgradeCost(t);
  state.gold -= cost;
  t.level++;
  t.invested += cost;
  computeStats(t);
  return OK;
}

// ---------------------------------------------------- specialisations
// Offered once a tower is fully upgraded, and only where the realm allows
// full upgrades in the first place. Choosing one is permanent for that spot —
// selling and rebuilding is the only way back, which is what makes it a
// decision rather than a menu.
export function canSpecialize(t, specKey) {
  if (t.spec) return no("Already specialised.");
  if (t.level < Math.min(MAX_LEVEL, maxTowerLevelFor(LEVEL.index)))
    return no("Fully upgrade this tower first.");
  const spec = specDef(t.type, specKey);
  if (!spec) return no("No such specialisation.");
  if (state.gold < spec.cost) return no("Not enough gold (need " + spec.cost + ").");
  return OK;
}

export function specializeTower(t, specKey) {
  const check = canSpecialize(t, specKey);
  if (!check.ok) return check;
  const spec = specDef(t.type, specKey);
  state.gold -= spec.cost;
  t.invested += spec.cost;
  t.spec = specKey;
  computeStats(t);
  // A barracks specialisation can change the squad size, so rebuild it.
  if (t.def.attack === "none") {
    t.soldiers = [];
    for (let i = 0; i < t.soldierCount; i++) t.soldiers.push(makeSoldier(t, i));
  }
  return OK;
}

// Returns the refund so callers can report it.
export function sellTower(t) {
  const refund = sellValue(t);
  state.gold += refund;
  state.towers = state.towers.filter((x) => x !== t);
  return refund;
}

// Barracks rally relocation. (x, y) is a raw field click; it snaps to the
// nearest point on the road, and must land within the tower's rallyReach.
export function relocateRallyPoint(tower, x, y) {
  const snapped = nearestPointOnPath(PATH, x, y);
  if (dist(tower.x, tower.y, snapped.x, snapped.y) > tower.def.rallyReach)
    return no("Too far — click somewhere inside the glowing circle.");
  relocateRally(tower, snapped);
  return OK;
}

// ---------------------------------------------------------------- abilities
export function canCast(key) {
  if (abilityUnlockState(key).locked) return no("Not unlocked yet.");
  if (state.abilityCooldowns[key] > 0) return no("Still on cooldown.");
  return OK;
}

// "Reinforcements": a ring of temporary soldiers around the chosen point.
export function castReinforcements(x, y) {
  const check = canCast("soldiers");
  if (!check.ok) return check;
  const count = SUMMON.count + summonCountBonus();
  for (let i = 0; i < count; i++)
    state.summonedSoldiers.push(makeSummonedSoldier({ x, y }, (i / count) * Math.PI * 2));
  state.abilityCooldowns.soldiers = ABILITY_COOLDOWN;
  return OK;
}

// "Ignite": everything within FIRE.radius of the point catches an
// armor-ignoring burn.
export function castIgnite(x, y) {
  const check = canCast("fire");
  if (!check.ok) return check;
  for (const e of state.enemies) {
    if (e.dead || dist(x, y, e.x, e.y) > FIRE.radius) continue;
    e.burning = true;
    e.burnFor = FIRE.duration + fireDurationBonus();
    e.burnDps = FIRE.dps * fireDpsMul();
  }
  state.effects.push({ x, y, maxR: FIRE.radius, life: 0.4, maxLife: 0.4 });
  state.abilityCooldowns.fire = ABILITY_COOLDOWN;
  return OK;
}

// ---------------------------------------------------------------------- hero
export function moveHero(x, y) {
  const hero = state.hero;
  if (!hero || !hero.alive) return no("No hero to command.");
  commandHero(hero, x, y);
  return OK;
}
