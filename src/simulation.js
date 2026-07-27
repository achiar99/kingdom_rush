// The per-frame game simulation: spawning, movement, combat, wave lifecycle.
//
// This module is deliberately DOM-free. Everything the running game wants to
// *show* someone goes through simHooks (no-ops until ui.js installs the real
// screen), so the exact same rules can be driven headlessly — see the balance
// harness in tools/sim, which runs whole levels thousands of times.
import { CONFIG } from "./config.js";
import { wavesFor } from "./data/levels.js";
import { MASTERS } from "./data/enemyKits.js";
import { newUnlocksAt } from "./data/unlocks.js";
import { HERO_LEVELING, HEROES, DEFAULT_HERO } from "./data/hero.js";
import { FIRE, SUMMON } from "./data/abilities.js";
import { dist, pointAtDistance } from "./geometry.js";
import { state, PATH, PATHS, PATH_LEN, LEVEL } from "./state.js";
import { makeEnemy, damageEnemy, gainHeroXp, makeHero } from "./entities.js";
import { getDifficulty, markComplete, unlockLevel, progress } from "./save.js";
import {
  heroPowerMul, startGoldMul, startLivesBonus, earlyCallGoldBonus,
} from "./data/store.js";
import { simHooks } from "./simHooks.js";

// Wipe the world back to the start of the currently-loaded level. Pure state,
// no DOM: ui.js's resetGame() calls this and then relabels the HUD, and the
// balance harness calls it between runs. Returns the bits the caller needs to
// display (which difficulty and hero this run is being played with).
export function resetRun() {
  const diff = getDifficulty();
  const heroDef = HEROES[progress.hero] || HEROES[DEFAULT_HERO];
  const endP = PATH[PATH.length - 1];
  // The path's true end can sit off-screen (top-exit maps end at y=-8), and
  // the hero used to spawn beside it — standing in the sky, on the horizon
  // line. Guard the spawn into the field.
  const heroX = Math.min(CONFIG.width - 40, Math.max(40, endP.x - 70));
  const heroY = Math.min(CONFIG.height - 40, Math.max(40, endP.y));
  Object.assign(state, {
    gold: Math.round(LEVEL.startGold * diff.goldMul * startGoldMul()),
    lives: Math.round(LEVEL.startLives * diff.livesMul) + startLivesBonus(),
    waveIndex: -1,
    enemies: [], towers: [], projectiles: [], effects: [],
    hero: makeHero({ x: heroX, y: heroY }, heroDef), // starts guarding the castle
    summonedSoldiers: [], abilityCooldowns: { soldiers: 0, fire: 0 },
    spawnQueue: [], clock: 0, wavePaid: [],
    nextWaveIn: 0,     // no clock before wave 1 — the player opens the battle
    running: false, over: false, paused: false, speed: 1,
    hoverSpot: null, menuSpot: null, selected: null, repositioning: null,
    heroSelected: false, placingAbility: null, hoverPos: null,
  });
  return { diff, heroDef };
}

// Called by the player's button, and by update() when the countdown expires.
// The only difference between the two is how much time was left on the clock,
// which is exactly what the early-call bonus pays for — so both go through
// here and the bonus falls out on its own.
//
// Note there is no `state.running` guard: the clock to wave N+1 starts when
// wave N starts, not when wave N dies, so waves are expected to overlap and
// this can legitimately be called with creeps still on the road.
export function startNextWave() {
  if (state.over) return;
  const waves = wavesFor(LEVEL);
  if (state.waveIndex + 1 >= waves.length) return;

  const bonus = earlyCallBonus();
  if (bonus > 0) {
    state.gold += bonus;
    simHooks.setTip("Wave called in early — +" + bonus + " gold.");
  }

  state.waveIndex++;
  const wave = waves[state.waveIndex];
  const hpMul = wave.hpMul * LEVEL.hpScale * getDifficulty().hpMul;
  // Flatten the wave's groups into individual spawns scheduled against the
  // battle clock. Absolute times rather than a single running gap timer,
  // because two or three waves can now be spawning at once and one shared
  // countdown cannot represent that.
  let at = state.clock;
  let n = 0;                        // running spawn index, for route assignment
  for (const g of wave.groups)
    for (let i = 0; i < g.count; i++) {
      state.spawnQueue.push({ type: g.type, at, hpMul, speedMul: wave.speedMul,
                              wave: state.waveIndex,
        // On a fork the wave splits evenly between the roads, alternating
        // spawn by spawn so both branches see pressure from the first creep.
        // The master always takes the primary route — its walk is the fight
        // the finale is tuned around.
        route: g.type === "master" ? 0 : n++ % PATHS.length });
      at += g.gap;
    }
  state.spawnQueue.sort((a, b) => a.at - b.at);
  state.running = true;

  // Start the clock for the wave AFTER this one right now. This is the whole
  // point of the overlap model: the player can always see how long they have.
  //
  // The interval is derived from the wave rather than fixed, because the old
  // constant measured build time AFTER a wave was already dead. Reused as-is
  // it stacked six or seven waves on top of each other — a wave spawns in
  // about nine seconds but its creeps need seventy-five or more to walk the
  // road, so a flat clock can never keep up. Counting from the end of this
  // wave's own spawn keeps a long wave from being buried by the next one.
  const spawnSec = at - state.clock;
  const upcoming = waves[state.waveIndex + 1];
  state.nextWaveIn = upcoming
    ? spawnSec + CONFIG.nextWaveDelay * (upcoming.leadIn ?? 1) : 0;

  // The one wave in each stage that gets its own billing.
  if (wave.master) simHooks.setTip("⚔ " + MASTERS[LEVEL.kit].name + " takes the field.");
  simHooks.closeMenus();
  simHooks.updateHud();
  simHooks.updateButtons();
}

// What calling the next wave in right now would pay. Zero once the countdown
// has run out, so an auto-started wave never awards anything. Deliberately
// available mid-combat — under overlap there is no "between waves" any more.
export function earlyCallBonus() {
  if (state.over) return 0;
  const paid = Math.min(state.nextWaveIn, CONFIG.earlyCallMaxSeconds);
  return Math.max(0, Math.floor(paid) * (CONFIG.earlyCallGold + earlyCallGoldBonus()));
}

// Pay a wave's clear bonus the moment its last creep dies.
//
// "The board is empty" used to mark a wave boundary; with waves overlapping it
// no longer does, and on a busy level the board may never empty at all. So
// each wave is tracked on its own — a wave is done when it has nothing left
// queued to spawn and nothing left alive, whatever else is happening.
function settleFinishedWaves() {
  for (let w = 0; w <= state.waveIndex; w++) {
    if (state.wavePaid[w]) continue;
    if (state.spawnQueue.some((s) => s.wave === w)) continue;
    if (state.enemies.some((e) => e.wave === w && !e.dead)) continue;
    state.wavePaid[w] = true;
    state.gold += CONFIG.waveClearBonus;
    const fresh = newUnlocksAt(LEVEL.index, w + 2);
    simHooks.setTip("Wave " + (w + 1) + " cleared! +" + CONFIG.waveClearBonus + " gold." +
      (fresh.length ? " 🔓 Unlocked: " + fresh.join(", ") + "!" : ""));
  }
}

// Star rating is based on % of that playthrough's starting lives left at the
// end — thresholds scale with the level/difficulty's actual life total
// instead of a fixed number, so e.g. Emberfall (18 lives) or Hard (×0.8)
// rate fairly against the same bar as a standard 20-life Normal run.
export function starsForRun() {
  const startingLives = Math.round(LEVEL.startLives * getDifficulty().livesMul) + startLivesBonus();
  const pct = state.lives / startingLives;
  return pct >= 0.9 ? 3 : pct >= 0.55 ? 2 : 1;
}

// Terminal state for a run: freeze the world, bank the result in `progress`,
// then let whoever is watching (ui.js's overlay, the balance harness) react.
export function endGame(won) {
  state.over = true;
  state.running = false;
  simHooks.closeMenus();
  const stars = won ? starsForRun() : 0;
  if (won) { markComplete(LEVEL.id, stars); unlockLevel(LEVEL.index + 1); }
  simHooks.onGameOver(won, stars);
  simHooks.updateButtons();
}

export function update(dt) {
  if (state.over) return;

  state.clock += dt;

  // The clock runs whether or not a wave is on the road; at zero the next wave
  // launches with no bonus paid. startNextWave() is the single entry point, so
  // a wave that arrives this way behaves identically to one the player called
  // in — it just doesn't pay, and it may well arrive on top of the last one.
  if (state.nextWaveIn > 0) {
    state.nextWaveIn -= dt;
    if (state.nextWaveIn <= 0) {
      state.nextWaveIn = 0;
      startNextWave();
    }
  }

  // Spawn everything now due, which may be creeps from more than one wave.
  while (state.spawnQueue.length && state.spawnQueue[0].at <= state.clock)
    state.enemies.push(makeEnemy(state.spawnQueue.shift()));

  // ability cooldowns tick down regardless of anything else happening
  if (state.abilityCooldowns.soldiers > 0) state.abilityCooldowns.soldiers -= dt;
  if (state.abilityCooldowns.fire > 0) state.abilityCooldowns.fire -= dt;

  // Ignite's burn: damage over time, ignores armor (like Magic), independent
  // of position — it doesn't care where the enemy has wandered to since.
  for (const e of state.enemies) {
    if (e.dead || !e.burning) continue;
    damageEnemy(e, (e.burnDps || FIRE.dps) * dt, true);
    e.burnFor -= dt;
    if (e.burnFor <= 0) e.burning = false;
  }

  // Revenants knit themselves back together — but only while nothing is
  // burning them, which is what makes Ignite and the Shrine of Hekate the
  // answer to them rather than raw damage.
  for (const e of state.enemies) {
    if (e.dead || !e.regen || e.burning) continue;
    if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
  }

  // crippling effects wear off
  for (const e of state.enemies) {
    if (!e.slowFor) continue;
    e.slowFor -= dt;
    if (e.slowFor <= 0) { e.slowFor = 0; e.slowMul = 1; }
  }

  // Wind down each creep's swing timer exactly once per frame.
  //
  // This used to be decremented by every blocker touching the creep, so a
  // creep surrounded by three hoplites swung three times as fast as the same
  // creep facing one — the phalanx was quietly making things worse the more
  // of it there was. Blockers now only *check* whether the swing is ready.
  for (const e of state.enemies) if (e.attackCd > 0) e.attackCd -= dt;

  // reset per-frame engagement flags; barracks soldiers re-set them
  for (const e of state.enemies) e.engaged = false;

  // barracks soldiers: acquire, move, melee, block
  for (const t of state.towers) if (t.def.attack === "none") updateBarracks(t, dt);

  // "Reinforcements" ability: temporary soldiers, gone after their lifespan
  updateSummonedSoldiers(dt);

  // the hero: acquire, move, melee, block (same shape as a barracks soldier,
  // but roams freely instead of being tied to a tower)
  updateHero(dt);

  // move enemies that aren't blocked in melee
  for (const e of state.enemies) {
    if (e.engaged) continue;
    e.dist += e.speed * (e.slowMul ?? 1) * dt;
    const p = pointAtDistance(e.path || PATH, e.pathLen || PATH_LEN, e.dist);
    e.x = p.x; e.y = p.y;
    if (e.dist >= (e.pathLen || PATH_LEN)) {
      e.dead = true;
      // A stage master reaching the temple ends the run outright, however many
      // lives are left. Everything else in the game is attrition you can absorb;
      // this one is a fight you either win or lose, and letting it be survivable
      // would make the climax of a stage just another leak.
      if (e.def.role === "master") {
        simHooks.setTip("💀 " + e.def.name + " reached the temple.");
        endGame(false);
        return;
      }
      state.lives--;
      if (state.lives <= 0) { endGame(false); return; }
    }
  }

  // attacking towers acquire targets and fire
  for (const t of state.towers) {
    if (t.def.attack === "none") continue;
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const target = acquireTarget(t);
    if (target) {
      state.projectiles.push({
        x: t.x, y: t.y - 7, target, damage: t.damage,
        speed: t.projectileSpeed, color: t.def.projColor,
        attack: t.def.attack, splashRadius: t.splashRadius || 0,
        magic: t.def.key === "magic", hitsAir: t.hitsAir, dead: false,
        chain: t.chain || 0, slow: t.slow, dot: t.dot, airBonus: t.airBonus || 1,
        // What fired it, and from where. render/effects.js needs the first to
        // pick a shape — an arrow, a boulder, a bolt, an arcane mote — and the
        // second to lob artillery along a visual arc.
        kind: t.type, spec: t.spec || null,
        x0: t.x, y0: t.y - 7, flight: dist(t.x, t.y - 7, target.x, target.y),
      });
      t.cooldown = 1 / t.fireRate;
    }
  }

  // projectiles home toward their target
  for (const p of state.projectiles) {
    if (p.target.dead) { p.dead = true; continue; }
    const d = dist(p.x, p.y, p.target.x, p.target.y);
    const step = p.speed * dt;
    if (d <= step) {
      onProjectileHit(p);
      p.dead = true;
    } else {
      p.x += ((p.target.x - p.x) / d) * step;
      p.y += ((p.target.y - p.y) / d) * step;
    }
  }

  // explosion / hit effects fade out
  for (const fx of state.effects) fx.life -= dt;
  
  // A brood that dies seeds two swarm where it fell. Done here rather than in
  // damageEnemy so the list isn't mutated while something is iterating it —
  // and the young start slightly BEHIND the parent so a brood killed on the
  // castle steps can't dump two free leaks over the line.
  const spawned = [];
  for (const e of state.enemies) {
    if (!e.dead || !e.splits || e.spawnedYoung) continue;
    e.spawnedYoung = true;
    for (let i = 0; i < e.splits; i++) {
      const back = 14 + i * 12;
      spawned.push(makeEnemy(
        { type: "swarm", wave: e.wave, route: e.routeIdx, hpMul: e.hpMul * 0.55, speedMul: e.speedMul },
        Math.max(0, e.dist - back)));
    }
  }
  if (spawned.length) state.enemies.push(...spawned);

  // cull dead entities
  state.enemies = state.enemies.filter((e) => !e.dead);
  state.projectiles = state.projectiles.filter((p) => !p.dead);
  state.effects = state.effects.filter((fx) => fx.life > 0);

  settleFinishedWaves();

  // `running` now means "combat is happening", not "a wave is in progress" —
  // under overlap those stopped being the same thing.
  state.running = state.spawnQueue.length > 0 || state.enemies.length > 0;

  // The level is won when every wave has been sent and the board is clear.
  if (!state.running && state.waveIndex + 1 >= wavesFor(LEVEL).length && state.waveIndex >= 0)
    endGame(true);

  simHooks.updateHud();
}

// One landed hit, including whatever specialisation rider the projectile is
// carrying. `chain`, `slow`, `dot` and `airBonus` are the whole effect
// vocabulary — every specialisation in data/towerTypes.js is written in terms
// of these four, so adding one never means touching combat code.
function applyHit(p, e) {
  const dmg = p.damage * (e.flying ? p.airBonus : 1);
  damageEnemy(e, dmg, p.magic);
  if (p.slow) {
    // Keep the strongest slow currently on the creep rather than stacking.
    e.slowMul = Math.min(e.slowMul ?? 1, p.slow.mul);
    e.slowFor = Math.max(e.slowFor || 0, p.slow.dur);
  }
  if (p.dot) {
    // Rides the same burn machinery Ignite uses.
    e.burning = true;
    e.burnDps = Math.max(e.burnDps || 0, p.dot.dps);
    e.burnFor = Math.max(e.burnFor || 0, p.dot.dur);
  }
  return dmg;
}

// The nearest `n` other live enemies to (x, y) — how a volley or an arc of
// prophecy finds its extra targets.
function nearestOthers(x, y, n, exclude, hitsAir) {
  const pool = [];
  for (const e of state.enemies) {
    if (e.dead || e === exclude) continue;
    if (e.flying && !hitsAir) continue;
    pool.push({ e, d: dist(x, y, e.x, e.y) });
  }
  pool.sort((a, b) => a.d - b.d);
  return pool.slice(0, n).map((o) => o.e);
}

// One swing from a creep at whatever is blocking it.
//
// Most creeps hit only the unit that engaged them. A master cleaves: every
// blocker standing around it takes the same blow. That is the difference
// between a phalanx *delaying* a boss and a phalanx *stopping* one — three
// hoplites taking it in turn could hold a master indefinitely, which made the
// stage finale a stalemate instead of a fight.
function enemyStrike(e, primary) {
  const land = (u) => {
    if (!u || u.hp <= 0) return;
    u.hp -= e.meleeDamage;
    u.sinceHit = 0;                 // knocks back the out-of-combat regen clock
  };
  land(primary);
  if (!e.cleave) return;

  const near = (u) => u && u.hp > 0 && dist(u.x, u.y, e.x, e.y) <= e.cleave;
  for (const t of state.towers) {
    if (t.def.attack !== "none") continue;
    for (const s of t.soldiers)
      if (s !== primary && s.alive && near(s)) land(s);
  }
  for (const s of state.summonedSoldiers)
    if (s !== primary && s.alive && near(s)) land(s);
  if (state.hero && state.hero !== primary && state.hero.alive && near(state.hero)) land(state.hero);
}

function onProjectileHit(p) {
  if (p.chain > 0) {
    // Hits its target, then carries on into the next nearest creeps.
    applyHit(p, p.target);
    for (const e of nearestOthers(p.target.x, p.target.y, p.chain - 1, p.target, p.hitsAir))
      if (dist(p.target.x, p.target.y, e.x, e.y) <= 120) applyHit(p, e);
    state.effects.push({ x: p.target.x, y: p.target.y, maxR: 60, life: 0.25,
      maxLife: 0.25, color: p.color, kind: "arcane" });
    return;
  }
  if (p.attack === "splash") {
    const ix = p.target.x, iy = p.target.y;
    for (const e of state.enemies) {
      if (e.dead || dist(ix, iy, e.x, e.y) > p.splashRadius) continue;
      // A blast on the ground doesn't reach anything airborne — otherwise the
      // Ballista would still be answering flyers through its splash, which is
      // exactly the weakness it's supposed to have.
      if (e.flying && !p.hitsAir) continue;
      applyHit(p, e);
    }
    state.effects.push({ x: ix, y: iy, maxR: p.splashRadius, life: 0.4, maxLife: 0.4,
      color: "#ffb057", kind: p.spec === "scorpion" ? "sparks" : "rubble" });
  } else {
    const dealt = applyHit(p, p.target);
    // A small mark where it struck. Without this an arrow simply vanished into
    // the creep and there was no feedback that anything had connected.
    state.effects.push({
      x: p.target.x, y: p.target.y, maxR: 13, life: 0.18, maxLife: 0.18,
      color: p.color, kind: p.magic ? "arcane" : "sparks",
    });
    // ranged heroes earn their XP when the arrow/bolt actually lands
    if (p.fromHero && state.hero)
      awardHeroXp(state.hero, dealt + (p.target.dead ? p.target.reward : 0));
  }
}

// gainHeroXp + the level-up announcement, shared by melee hits and projectiles
function awardHeroXp(hero, xp) {
  if (gainHeroXp(hero, xp))
    simHooks.setTip("⭐ " + hero.def.name + " reached level " + hero.level +
      (hero.level >= HERO_LEVELING.maxLevel ? " — max power!" : "!"));
}

// "Reinforcements" ability units — combat is the same shape as a Barracks
// soldier (acquire nearest ground target, melee, block) but anchored to
// their own spawn point instead of a tower's rally, no respawn, and removed
// outright once `life` runs out regardless of whether they're mid-fight.
function updateSummonedSoldiers(dt) {
  for (const s of state.summonedSoldiers) {
    s.life -= dt;
    if (!s.alive) continue;

    if (s.target && (s.target.dead || dist(s.x, s.y, s.target.x, s.target.y) > SUMMON.aggroRadius))
      s.target = null;
    if (!s.target) {
      let best = null, bestD = Infinity;
      for (const e of state.enemies) {
        if (e.dead || e.flying) continue;
        const d = dist(s.x, s.y, e.x, e.y);
        if (d <= SUMMON.aggroRadius && d < bestD) { best = e; bestD = d; }
      }
      s.target = best;
    }

    const dest = s.target || s.home;
    const d = dist(s.x, s.y, dest.x, dest.y);
    if (s.target && d <= SUMMON.meleeRange) {
      s.target.engaged = true;
      s.attackCd -= dt;
      if (s.attackCd <= 0) { damageEnemy(s.target, SUMMON.damage); s.attackCd = SUMMON.attackInterval; }
      if (s.target.attackCd <= 0) {
        enemyStrike(s.target, s);
        s.target.attackCd = s.target.meleeInterval;
        if (s.hp <= 0) s.alive = false;
      }
    } else if (d > 1) {
      const step = SUMMON.speed * dt;
      s.x += ((dest.x - s.x) / d) * Math.min(step, d);
      s.y += ((dest.y - s.y) / d) * Math.min(step, d);
    }
  }
  state.summonedSoldiers = state.summonedSoldiers.filter((s) => s.life > 0);
}

// Target the enemy furthest along the path that's within range — skipping
// flyers entirely for towers that can't shoot upward (the Ballista).
//
// A stage master outranks that rule and is always fired on first.
//
// Without this the master was effectively invulnerable, and not because of its
// health: "furthest along" plus "slowest thing in the wave" meant its own
// escort overtook it and soaked every shot on the board. A perfect defence
// stripped 5-21% off it before it walked the entire path, and dropping its HP
// from 4200 to 600 barely moved the needle — it was never being shot at. Now
// everything turns to face the boss, which is also what you'd expect it to do.
// "Furthest along" is measured as distance REMAINING to the temple, not
// distance travelled — on a fork two creeps are on different roads of
// different lengths, and travelled distance stops meaning anything between
// them. Remaining distance is the thing a tower actually cares about: who
// gets to the gate first.
const remaining = (e) => (e.pathLen || PATH_LEN) - e.dist;

export function acquireTarget(tower) {
  let best = null, bestRem = Infinity, bestIsMaster = false;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.flying && !tower.hitsAir) continue;
    if (dist(tower.x, tower.y, e.x, e.y) > tower.range) continue;
    const isMaster = e.def.role === "master";
    if (bestIsMaster && !isMaster) continue;          // a master already has priority
    if (isMaster && !bestIsMaster) { best = e; bestRem = remaining(e); bestIsMaster = true; continue; }
    if (remaining(e) < bestRem) { best = e; bestRem = remaining(e); }
  }
  return best;
}

function updateBarracks(tower, dt) {
  const def = tower.stats;   // spec overrides folded in by computeStats
  for (const s of tower.soldiers) {
    if (!s.alive) {
      s.respawn -= dt;
      if (s.respawn <= 0) {
        s.alive = true; s.hp = tower.soldierHp; s.maxHp = tower.soldierHp;
        s.x = s.home.x; s.y = s.home.y; s.target = null; s.attackCd = 0; s.sinceHit = 0;
        s.forcedMove = false;
      }
      continue;
    }

    // passive regen once it's been a few seconds since this soldier last took a hit
    s.sinceHit += dt;
    if (s.sinceHit >= def.soldierRegenDelay && s.hp < s.maxHp)
      s.hp = Math.min(s.maxHp, s.hp + def.soldierRegenRate * dt);

    // While under orders (forcedMove, from a rally relocation), skip target-
    // acquisition entirely — same idea as the hero's commandHero — so a
    // whole cluster of creeps near the old spot can't keep grabbing this
    // soldier's attention on the way to the new one. Resumes below on arrival.
    if (!s.forcedMove) {
      // drop dead / out-of-range targets — leashed to the rally point, not the
      // tower itself, so relocating the rally moves the whole engagement area
      if (s.target && (s.target.dead || dist(tower.rally.x, tower.rally.y, s.target.x, s.target.y) > tower.range))
        s.target = null;
      // acquire nearest ground enemy within engagement radius (flyers can't be blocked)
      if (!s.target) {
        let best = null, bestD = Infinity;
        for (const e of state.enemies) {
          if (e.dead || e.flying) continue;
          const d = dist(tower.rally.x, tower.rally.y, e.x, e.y);
          if (d <= tower.range && d < bestD) { best = e; bestD = d; }
        }
        s.target = best;
      }
    }

    const dest = s.target || s.home;
    const d = dist(s.x, s.y, dest.x, dest.y);
    if (s.forcedMove && d <= 1) s.forcedMove = false; // arrived — resume normal behavior
    if (s.target && d <= def.meleeRange) {
      // locked in melee: block the creep and trade blows
      s.target.engaged = true;
      s.attackCd -= dt;
      if (s.attackCd <= 0) { damageEnemy(s.target, tower.soldierDamage); s.attackCd = def.soldierAttackInterval; }
      if (s.target.attackCd <= 0) {
        enemyStrike(s.target, s);
        s.target.attackCd = s.target.meleeInterval;
        if (s.hp <= 0) { s.alive = false; s.respawn = def.soldierRespawn; s.target = null; }
      }
    } else if (d > 1) {
      // walk toward target (to intercept) or back to rally point
      const step = def.soldierSpeed * dt;
      s.x += ((dest.x - s.x) / d) * Math.min(step, d);
      s.y += ((dest.y - s.y) / d) * Math.min(step, d);
    }
  }
}

function updateHero(dt) {
  const hero = state.hero;
  if (!hero) return;

  if (!hero.alive) {
    hero.respawn -= dt;
    if (hero.respawn <= 0) {
      hero.alive = true; hero.hp = hero.maxHp; // level (and its max HP) survives death
      hero.x = hero.commandPos.x; hero.y = hero.commandPos.y;
      hero.target = null; hero.attackCd = 0; hero.sinceHit = 0; hero.forcedMove = false;
    }
    return;
  }

  const def = hero.def;

  // passive regen once it's been a few seconds since the hero last took a hit
  hero.sinceHit += dt;
  if (hero.sinceHit >= def.regenDelay && hero.hp < hero.maxHp)
    hero.hp = Math.min(hero.maxHp, hero.hp + HERO_LEVELING.regenAt(def, hero.level) * dt);

  // Melee heroes chase anything inside their aggro radius; ranged heroes
  // hold their ground and only grapple creeps that walk right into them
  // (their real weapon is the shooting block further down).
  const aggro = def.attack === "ranged" ? def.meleeRange : def.aggroRadius;

  // While under orders (forcedMove), skip target-acquisition entirely — the
  // hero ignores every enemy, not just the one it was just fighting, so a
  // whole cluster of creeps can't keep grabbing its attention on the way.
  // It resumes normal behavior once it actually reaches commandPos, below.
  if (!hero.forcedMove) {
    // drop dead / too-far targets — leashed to the hero's OWN current position,
    // not a fixed point, since it roams instead of sitting at one tower
    if (hero.target && (hero.target.dead || dist(hero.x, hero.y, hero.target.x, hero.target.y) > aggro))
      hero.target = null;
    // acquire nearest ground enemy within aggro radius (flyers can't be blocked)
    if (!hero.target) {
      let best = null, bestD = Infinity;
      for (const e of state.enemies) {
        if (e.dead || e.flying) continue;
        const d = dist(hero.x, hero.y, e.x, e.y);
        if (d <= aggro && d < bestD) { best = e; bestD = d; }
      }
      hero.target = best;
    }
  }

  const dest = hero.target || hero.commandPos;
  const d = dist(hero.x, hero.y, dest.x, dest.y);
  if (hero.forcedMove && d <= 1) hero.forcedMove = false; // arrived — resume normal behavior
  const inMelee = hero.target && d <= def.meleeRange;
  if (inMelee) {
    // locked in melee: block the creep and trade blows
    hero.target.engaged = true;
    hero.attackCd -= dt;
    if (hero.attackCd <= 0) {
      // damage scales with hero level; XP = damage dealt + bounty on the kill
      const dmg = HERO_LEVELING.damageAt(def, hero.level) * heroPowerMul();
      damageEnemy(hero.target, dmg, !!def.magic);
      awardHeroXp(hero, dmg + (hero.target.dead ? hero.target.reward : 0));
      hero.attackCd = def.attackInterval;
    }
    if (hero.target.attackCd <= 0) {
      enemyStrike(hero.target, hero);
      hero.target.attackCd = hero.target.meleeInterval;
      if (hero.hp <= 0) { hero.alive = false; hero.respawn = def.respawnTime; hero.target = null; }
    }
  } else if (d > 1) {
    // walk toward target (to intercept) or back to the commanded position
    const step = def.speed * dt;
    hero.x += ((dest.x - hero.x) / d) * Math.min(step, d);
    hero.y += ((dest.y - hero.y) / d) * Math.min(step, d);
  }

  // ranged heroes: whenever not grappled (and not under a move order), shoot
  // the furthest-along enemy in range — including flyers
  if (def.attack === "ranged") {
    hero.shootCd -= dt;
    if (hero.shootCd <= 0 && !inMelee && !hero.forcedMove) {
      let best = null, bestRem = Infinity, bestIsMaster = false;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist(hero.x, hero.y, e.x, e.y) > def.range) continue;
        const isMaster = e.def.role === "master";
        if (bestIsMaster && !isMaster) continue;
        if (isMaster && !bestIsMaster) { best = e; bestRem = remaining(e); bestIsMaster = true; continue; }
        if (remaining(e) < bestRem) { best = e; bestRem = remaining(e); }
      }
      if (best) {
        state.projectiles.push({
          x: hero.x, y: hero.y - 10, target: best,
          damage: HERO_LEVELING.damageAt(def, hero.level) * heroPowerMul(),
          speed: def.projectileSpeed, color: def.projColor,
          attack: "single", splashRadius: 0, magic: !!def.magic,
          hitsAir: true, fromHero: true, dead: false,
          // A champion shoots what they carry: Atalanta an arrow, Circe a mote.
          kind: def.magic ? "magic" : "archer", spec: null,
          x0: hero.x, y0: hero.y - 10, flight: dist(hero.x, hero.y - 10, best.x, best.y),
        });
        hero.shootCd = def.attackInterval;
      }
    }
  }
}
