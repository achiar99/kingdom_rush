// A synthetic player.
//
// The bot never touches game state directly — every move goes through
// src/actions.js, the exact same entry points ui.js calls from click
// handlers. If the bot can do it, a human can; if a human can't, neither can
// the bot. That's what makes the resulting statistics mean anything.
//
// Skill is a small set of knobs (how well it picks spots, how fast it reacts,
// how much gold it lets sit idle). Sampling those knobs is what turns a
// deterministic simulation into a distribution of outcomes.
import { TOWER_TYPES, TYPE_LIST, specsFor } from "../../src/data/towerTypes.js";
import { ENEMY_KITS } from "../../src/data/enemyKits.js";
import { wavesFor } from "../../src/data/levels.js";
import { maxTowerLevelFor } from "../../src/data/unlocks.js";
import { FIRE } from "../../src/data/abilities.js";
import { dist, pointAtDistance } from "../../src/geometry.js";
import { state, PATH, PATH_LEN, BUILD_SPOTS, LEVEL, spotOccupied } from "../../src/state.js";
import { upgradeCost } from "../../src/entities.js";
import { getDifficulty } from "../../src/save.js";
import { startNextWave } from "../../src/simulation.js";
import * as act from "../../src/actions.js";

// ---------------------------------------------------------------- profiles
// Three archetypes spanning the range of people who'll actually play this.
// A level tuned so only `expert` clears it isn't a hard level, it's a broken
// one — the report scores every profile separately for exactly that reason.
export const SKILL_PROFILES = {
  novice: {
    name: "novice",
    spotAccuracy: 0.20,   // P(picks the best-scoring build spot rather than a random decent one)
    typeAccuracy: 0.30,   // P(picks the tower type that actually counters the next wave)
    reaction: [1.6, 3.4], // seconds between decisions
    hoard: 0.45,          // fraction of gold left sitting unspent
    abilityUse: 0.20,     // P(uses a ready ability when it would help)
    heroMicro: 0.10,      // P(repositions the hero to meet a threat)
    upgradeBias: 0.20,    // P(upgrades an existing tower instead of building a new one)
    prepPatience: [1, 6], // seconds of build-up before starting the next wave
  },
  average: {
    name: "average",
    spotAccuracy: 0.60, typeAccuracy: 0.65, reaction: [0.8, 1.8], hoard: 0.20,
    abilityUse: 0.60, heroMicro: 0.50, upgradeBias: 0.45, prepPatience: [3, 10],
  },
  expert: {
    name: "expert",
    spotAccuracy: 0.93, typeAccuracy: 0.93, reaction: [0.3, 0.8], hoard: 0.05,
    abilityUse: 0.95, heroMicro: 0.90, upgradeBias: 0.60, prepPatience: [4, 14],
  },
  // Not a person — an upper bound. Always the best spot, always the right
  // counter, never a wasted coin, abilities off cooldown the instant they'd
  // help. If `perfect` can't clear a level, no amount of skill will, and the
  // level is broken rather than hard. Everything below it is a difficulty
  // reading; this is a feasibility reading.
  perfect: {
    name: "perfect",
    spotAccuracy: 1, typeAccuracy: 1, reaction: [0.15, 0.25], hoard: 0,
    abilityUse: 1, heroMicro: 1, upgradeBias: 0.5, prepPatience: [6, 18],
  },
};

export const SKILL_NAMES = Object.keys(SKILL_PROFILES);

// ------------------------------------------------------------ path sampling
// Points every ~8 units along the road. A tower's "coverage" is how many of
// them sit inside its range, which is directly proportional to the seconds a
// creep spends being shot at — the single best predictor of a good spot.
function samplePath(step = 8) {
  const pts = [];
  for (let d = 0; d <= PATH_LEN; d += step) pts.push(pointAtDistance(PATH, PATH_LEN, d));
  return pts;
}

function coverage(samples, x, y, range) {
  let n = 0;
  for (const p of samples) if (dist(x, y, p.x, p.y) <= range) n++;
  return n;
}

// ------------------------------------------------------- wave threat model
// What the next wave actually consists of, in the terms a tower-choice
// decision cares about. Mirrors startNextWave's hp math so the bot is
// reasoning about the creeps it's really going to face.
export function waveThreat(wave) {
  const hpMul = wave.hpMul * LEVEL.hpScale * getDifficulty().hpMul;
  const kit = ENEMY_KITS[LEVEL.kit].creatures;   // wave groups name roles, not creatures
  let totalHp = 0, flyingHp = 0, armorWeighted = 0, count = 0, groundCount = 0, spawnSeconds = 0;
  for (const g of wave.groups) {
    const d = kit[g.type];
    const hp = d.hp * hpMul * g.count;
    totalHp += hp;
    count += g.count;
    spawnSeconds = Math.max(spawnSeconds, g.count * g.gap);
    armorWeighted += d.armor * hp;
    if (d.flying) flyingHp += hp; else groundCount += g.count;
  }
  return {
    totalHp, count, spawnSeconds,
    avgArmor: totalHp ? armorWeighted / totalHp : 0,
    flyingShare: totalHp ? flyingHp / totalHp : 0,
    groundShare: count ? groundCount / count : 0,
    density: spawnSeconds ? count / spawnSeconds : count, // creeps on screen at once, roughly
  };
}

// Weighted blend of several waves' threat profiles. The bot builds against
// the wave in front of it but keeps one eye on what's coming — otherwise it
// happily fields an all-barracks army right before a wave of flyers that no
// soldier can touch.
function blendThreats(entries) {
  const total = entries.reduce((a, e) => a + e.weight, 0) || 1;
  const out = { totalHp: 0, count: 0, spawnSeconds: 0, avgArmor: 0, flyingShare: 0, groundShare: 0, density: 0 };
  for (const { threat, weight } of entries) {
    const w = weight / total;
    for (const k of Object.keys(out)) out[k] += threat[k] * w;
  }
  return out;
}

// What the towers already on the field are worth against `threat`. Splash
// overlap and armor are folded in, so this is real expected damage, not
// nameplate numbers.
function armyDps(threat) {
  let attack = 0, barracks = 0;
  for (const t of state.towers) {
    if (t.def.attack === "none") { barracks++; continue; }
    const armorPass = t.type === "magic" ? 1 : 1 - threat.avgArmor;
    // Splash and chain both multiply how many creeps one shot touches.
    const spread = t.def.attack === "splash" ? Math.min(3.2, 1 + threat.density * 0.55)
                 : Math.max(1, t.chain || 1);
    const airPass = t.hitsAir ? 1 : 1 - threat.flyingShare;
    attack += t.damage * t.fireRate * spread * armorPass * airPass;
  }
  return { attack, barracks };
}

// Value of adding one more tower of `key` to the army that already exists,
// per gold. Marginal rather than absolute, because the two are wildly
// different for barracks: the first one multiplies everything else's damage,
// the sixth one blocks creeps that were already being blocked.
function marginalValuePerGold(key, threat, army) {
  const d = TOWER_TYPES[key];
  const armorPass = 1 - threat.avgArmor;
  let dps;
  if (key === "barracks") {
    // Soldiers barely scratch anything (and spend a good share of the fight
    // walking back or waiting to respawn — hence the uptime factor). What a
    // barracks actually sells is *time*: ground creeps held still inside
    // everyone else's firing arcs.
    //
    // That benefit saturates hard. Blocking creeps that were already blocked
    // buys nothing, so total blocking value across the whole army tops out
    // around +50% of its damage; this returns the marginal slice the NEXT
    // barracks would add, which is what stops the bot fielding nine of them.
    const own = (d.soldierDamage * d.soldierCount / d.soldierAttackInterval) * armorPass * 0.5;
    const held = (n) => 0.5 * (1 - Math.exp(-0.6 * n));
    const block = army.attack * (held(army.barracks + 1) - held(army.barracks));
    dps = (own + block) * (1 - threat.flyingShare);
  } else if (key === "magic") {
    dps = d.damage * d.fireRate; // ignores armor entirely
  } else if (key === "artillery") {
    // Ground only: a wave that's half flyers is a wave the Ballista sits out.
    const hits = Math.min(3.2, 1 + threat.density * 0.55);
    dps = d.damage * d.fireRate * hits * armorPass * (1 - threat.flyingShare);
  } else {
    dps = d.damage * d.fireRate * armorPass;
  }
  return dps / d.cost;
}

// Expected damage per second of a specialisation against `threat`. Same
// shape as marginalValuePerGold, but a spec's numbers are absolute rather
// than a delta, and it has effects the base towers don't.
function specValue(spec, threat) {
  if (spec.soldierCount) {
    // A barracks branch: blocking value scaled by squad size and toughness.
    return (spec.soldierDamage * spec.soldierCount / (spec.soldierAttackInterval || 0.8))
      * (1 - threat.avgArmor) * (1 - threat.flyingShare) * 2.5;
  }
  const armorPass = spec.dot ? 1 : 1 - threat.avgArmor;   // burns ignore armour
  const spread = spec.chain ? spec.chain
    : spec.splashRadius ? Math.min(3.2, 1 + threat.density * 0.55) : 1;
  const airPass = spec.hitsAir === false ? 1 - threat.flyingShare : 1;
  const air = spec.airBonus ? 1 + (spec.airBonus - 1) * threat.flyingShare : 1;
  let dps = spec.damage * spec.fireRate * spread * armorPass * airPass * air;
  if (spec.dot) dps += spec.dot.dps * Math.min(1, spec.dot.dur * spec.fireRate);
  if (spec.slow) dps *= 1.25;   // slowing buys every other tower more shots
  return dps;
}

// ---------------------------------------------------------------- the bot
export class Bot {
  constructor(rng, profile) {
    this.rng = rng;
    this.p = profile;
    this.samples = samplePath();
    this.sinceDecision = 0;
    this.nextDelay = rng.float(...profile.reaction);
    this.prepPatience = rng.float(...profile.prepPatience);
    this.prepElapsed = 0;
    this.sinceHeroOrder = 99;
    // Per-run flavour so two runs at the same skill still diverge: this
    // player's standing bias for or against each tower type.
    this.typeBias = {};
    for (const k of TYPE_LIST) this.typeBias[k] = rng.float(0.75, 1.3);
  }

  tick(dt) {
    if (state.over) return;
    this.sinceHeroOrder += dt;
    if (state.running) this.prepElapsed = 0; else this.prepElapsed += dt;

    this.sinceDecision += dt;
    if (this.sinceDecision < this.nextDelay) return;
    this.sinceDecision = 0;
    this.nextDelay = this.rng.float(...this.p.reaction);

    this.spend();
    if (state.running) {
      this.useAbilities();
      this.microHero();
    } else {
      this.considerStartingWave();
    }
  }

  // -------------------------------------------------------------- economy
  // What the player is building against: the wave in front of them, plus a
  // discounted look at the two behind it.
  currentThreat() {
    const waves = wavesFor(LEVEL);
    const i0 = Math.min(waves.length - 1, state.waveIndex + (state.running ? 0 : 1));
    const entries = [];
    for (let k = 0; k < 3; k++) {
      const w = waves[i0 + k];
      if (w) entries.push({ threat: waveThreat(w), weight: k === 0 ? 0.6 : 0.2 });
    }
    return blendThreats(entries);
  }

  // Gold this player is willing to commit right now. `hoard` is the slice a
  // less decisive player just… doesn't get around to spending.
  spendable() {
    return state.gold * (1 - this.p.hoard);
  }

  spend() {
    // A few purchases per decision — a real player clicks fast when rich.
    // Re-derived each time, since every purchase changes what the next one
    // is worth (see marginalValuePerGold).
    for (let i = 0; i < 3; i++) {
      if (!this.buyOnce(this.currentThreat())) break;
    }
  }

  buyOnce(threat) {
    const budget = this.spendable();
    const army = armyDps(threat);
    const spec = this.bestSpec(threat);
    const upgrade = this.bestUpgrade(threat, army);
    const build = this.bestBuild(threat, army);

    // Specialisations are the biggest single power jump available, so they
    // take priority once affordable — a player who can afford one and buys a
    // fourth Toxotai instead is not the player the balance targets describe.
    if (spec && spec.cost <= budget) return act.specializeTower(spec.tower, spec.key).ok;

    // Prefer upgrading only if this player leans that way and it's affordable.
    if (upgrade && upgrade.cost <= budget && (!build || this.rng.chance(this.p.upgradeBias)))
      return act.upgradeTower(upgrade.tower).ok;
    if (build && build.cost <= budget)
      return act.buildTower(build.spot, build.key).ok;
    // Nothing affordable in the preferred order — take the upgrade if that's
    // all that fits, rather than stalling.
    if (upgrade && upgrade.cost <= budget) return act.upgradeTower(upgrade.tower).ok;
    return false;
  }

  // Which tower type to put down next. `typeAccuracy` decides whether the
  // player actually reads the wave or just builds what they like.
  chooseType(threat, army) {
    const options = TYPE_LIST.filter((k) => !act.towerUnlockState(k).locked);
    if (!options.length) return null;
    const affordable = options.filter((k) => TOWER_TYPES[k].cost <= this.spendable());
    if (!affordable.length) return null;
    if (!this.rng.chance(this.p.typeAccuracy))
      return this.rng.weighted(affordable, (k) => this.typeBias[k]);
    let best = affordable[0], bestV = -Infinity;
    for (const k of affordable) {
      const v = marginalValuePerGold(k, threat, army) * this.typeBias[k];
      if (v > bestV) { bestV = v; best = k; }
    }
    return best;
  }

  bestBuild(threat, army) {
    const key = this.chooseType(threat, army);
    if (!key) return null;
    const free = BUILD_SPOTS.filter((s) => !spotOccupied(s));
    if (!free.length) return null;
    const range = TOWER_TYPES[key].range;
    const scored = free.map((s) => ({ spot: s, score: coverage(this.samples, s.x, s.y, range) }));
    // A good player takes the best spot; a weaker one takes *a* spot, biased
    // toward decent ones but often wasting a strong position.
    const chosen = this.rng.chance(this.p.spotAccuracy)
      ? scored.reduce((a, b) => (b.score > a.score ? b : a))
      : this.rng.weighted(scored, (s) => s.score + 1);
    if (chosen.score === 0) return null; // a spot that covers no road at all
    return { spot: chosen.spot, key, cost: TOWER_TYPES[key].cost };
  }

  // Which fully-upgraded tower should branch, and down which path. Weaker
  // players pick a path at random; stronger ones read the wave.
  bestSpec(threat) {
    let best = null, bestV = -Infinity;
    for (const t of state.towers) {
      const options = specsFor(t.type).filter((s) => act.canSpecialize(t, s.key).ok);
      if (!options.length) continue;
      const cover = coverage(this.samples, t.x, t.y, t.range);
      if (cover === 0) continue;
      const pick = this.rng.chance(this.p.typeAccuracy)
        ? options.reduce((a, b) => (specValue(b, threat) > specValue(a, threat) ? b : a))
        : this.rng.pick(options);
      const v = (specValue(pick, threat) * cover) / pick.cost;
      if (v > bestV) { bestV = v; best = { tower: t, key: pick.key, cost: pick.cost }; }
    }
    return best;
  }

  // The upgrade that buys the most extra coverage-weighted damage per gold.
  // Only the realm's level cap is checked here; affordability is the caller's
  // problem, since it budgets against `spendable()` rather than raw gold.
  bestUpgrade(threat, army) {
    const cap = maxTowerLevelFor(LEVEL.index);
    let best = null, bestV = -Infinity;
    for (const t of state.towers) {
      if (t.level >= cap) continue;
      const cover = coverage(this.samples, t.x, t.y, t.range);
      if (cover === 0) continue;
      const cost = upgradeCost(t);
      // Upgrades are ~+45% damage; value that against what the tower already
      // contributes, scaled by how much road it actually watches.
      const v = (marginalValuePerGold(t.type, threat, army) * TOWER_TYPES[t.type].cost * 0.45 * cover) / cost;
      if (v > bestV) { bestV = v; best = { tower: t, cost }; }
    }
    return best;
  }

  // Waves launch themselves when the countdown expires, so the only decision
  // left is whether to send one in early — which pays the unused seconds as
  // gold. A player who has finished shopping should always call it in; a
  // slower one dithers and lets the clock run out for nothing.
  considerStartingWave() {
    if (state.waveIndex + 1 >= wavesFor(LEVEL).length) return;
    const threat = this.currentThreat();
    const army = armyDps(threat);
    const canStillBuy = !!(this.bestBuild(threat, army) || this.bestUpgrade(threat, army));
    if (canStillBuy && this.prepElapsed < this.prepPatience) return;
    // Weaker players don't reliably notice the bonus and let it tick away.
    if (canStillBuy && !this.rng.chance(this.p.abilityUse)) return;
    this.prepPatience = this.rng.float(...this.p.prepPatience);
    startNextWave();
  }

  // ------------------------------------------------------------ abilities
  useAbilities() {
    const live = state.enemies.filter((e) => !e.dead);
    if (!live.length) return;

    if (act.canCast("fire").ok && this.rng.chance(this.p.abilityUse)) {
      const spot = this.densestCluster(live, FIRE.radius);
      // Worth a cast on a real clump, or on anything beefy (boss/tank).
      if (spot && (spot.count >= 4 || live.some((e) => e.boss)))
        act.castIgnite(spot.x, spot.y);
    }

    if (act.canCast("soldiers").ok && this.rng.chance(this.p.abilityUse)) {
      // Reinforcements only matter where ground creeps are getting through.
      const ground = live.filter((e) => !e.flying);
      const lead = ground.reduce((a, e) => (!a || e.dist > a.dist ? e : a), null);
      if (lead && (lead.dist / PATH_LEN > 0.55 || ground.length >= 5))
        act.castReinforcements(lead.x, lead.y);
    }
  }

  // Centre the blast on whichever enemy has the most neighbours within
  // `radius` — a cheap stand-in for where a human would actually click.
  densestCluster(live, radius) {
    let best = null;
    for (const e of live) {
      let n = 0;
      for (const o of live) if (dist(e.x, e.y, o.x, o.y) <= radius) n++;
      if (!best || n > best.count) best = { x: e.x, y: e.y, count: n };
    }
    return best;
  }

  // ----------------------------------------------------------------- hero
  microHero() {
    const hero = state.hero;
    if (!hero || !hero.alive) return;
    if (this.sinceHeroOrder < 2.5) return;         // don't thrash the poor thing
    if (!this.rng.chance(this.p.heroMicro)) return;

    const ground = state.enemies.filter((e) => !e.dead && !e.flying);
    if (!ground.length) return;
    // Meet the creep that's furthest along, a little ahead of where it is.
    const lead = ground.reduce((a, e) => (e.dist > a.dist ? e : a));
    if (lead.dist / PATH_LEN < 0.25) return;       // still deep in the towers' teeth
    const intercept = pointAtDistance(PATH, PATH_LEN, Math.min(PATH_LEN - 1, lead.dist + 40));
    act.moveHero(intercept.x, intercept.y);
    this.sinceHeroOrder = 0;
  }
}
