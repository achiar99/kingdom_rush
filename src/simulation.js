// The per-frame game simulation: spawning, movement, combat, wave lifecycle.
//
// Note: this module and ui.js import from each other (simulation needs
// endGame/updateHud/etc for game-over and HUD refresh; ui needs
// startNextWave for the Start Wave button). That's a deliberate circular
// import — safe here because every cross-reference is only *called* inside
// a function body, long after both modules have finished loading.
import { CONFIG } from "./config.js";
import { wavesFor } from "./data/levels.js";
import { newUnlocksAt } from "./data/unlocks.js";
import { HERO, HERO_LEVELING } from "./data/hero.js";
import { FIRE, SUMMON } from "./data/abilities.js";
import { dist, pointAtDistance } from "./geometry.js";
import { state, PATH, PATH_LEN, LEVEL } from "./state.js";
import { makeEnemy, damageEnemy, gainHeroXp } from "./entities.js";
import { getDifficulty } from "./save.js";
import { closeMenus, updateHud, updateButtons, setTip, endGame } from "./ui.js";

export function startNextWave() {
  if (state.over || state.running) return;
  const waves = wavesFor(LEVEL);
  if (state.waveIndex + 1 >= waves.length) return;
  state.waveIndex++;
  const wave = waves[state.waveIndex];
  const hpMul = wave.hpMul * LEVEL.hpScale * getDifficulty().hpMul;
  // flatten the wave's groups into an ordered queue of individual spawns,
  // each carrying its own gap (delay until the NEXT spawn) and wave scaling.
  state.spawnQueue = [];
  for (const g of wave.groups)
    for (let i = 0; i < g.count; i++)
      state.spawnQueue.push({ type: g.type, gap: g.gap, hpMul, speedMul: wave.speedMul });
  state.spawnTimer = 0;
  state.running = true;
  closeMenus();
  updateHud();
  updateButtons();
}

export function waveCleared() {
  state.running = false;
  if (state.waveIndex + 1 >= wavesFor(LEVEL).length) {
    endGame(true);
  } else {
    state.gold += CONFIG.waveClearBonus;
    const fresh = newUnlocksAt(LEVEL.index, state.waveIndex + 2);
    setTip("Wave cleared! +" + CONFIG.waveClearBonus + " gold." +
      (fresh.length ? " 🔓 Unlocked: " + fresh.join(", ") + "!" : "") +
      " Build up, then start the next wave.");
  }
  updateHud();
  updateButtons();
}

export function update(dt) {
  if (state.over) return;

  // spawn creeps for the running wave
  if (state.running && state.spawnQueue.length) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const entry = state.spawnQueue.shift();
      state.enemies.push(makeEnemy(entry));
      state.spawnTimer = entry.gap;
    }
  }

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
    e.dist += e.speed * dt;
    const p = pointAtDistance(PATH, PATH_LEN, e.dist);
    e.x = p.x; e.y = p.y;
    if (e.dist >= PATH_LEN) {
      e.dead = true;
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
        magic: t.def.key === "magic", dead: false,
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

  // cull dead entities
  state.enemies = state.enemies.filter((e) => !e.dead);
  state.projectiles = state.projectiles.filter((p) => !p.dead);
  state.effects = state.effects.filter((fx) => fx.life > 0);

  // wave finished when queue drained and no enemies remain
  if (state.running && state.spawnQueue.length === 0 && state.enemies.length === 0)
    waveCleared();

  updateHud();
}

function onProjectileHit(p) {
  if (p.attack === "splash") {
    const ix = p.target.x, iy = p.target.y;
    for (const e of state.enemies)
      if (!e.dead && dist(ix, iy, e.x, e.y) <= p.splashRadius) damageEnemy(e, p.damage, p.magic);
    state.effects.push({ x: ix, y: iy, maxR: p.splashRadius, life: 0.35, maxLife: 0.35, color: "#ffb057" });
  } else {
    damageEnemy(p.target, p.damage, p.magic);
  }
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
      s.target.attackCd -= dt;
      if (s.target.attackCd <= 0) {
        s.hp -= CONFIG.enemy.meleeDamage;
        s.target.attackCd = CONFIG.enemy.attackInterval;
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

// target the enemy furthest along the path that's within range
export function acquireTarget(tower) {
  let best = null, bestDist = -1;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (dist(tower.x, tower.y, e.x, e.y) <= tower.range && e.dist > bestDist) {
      best = e; bestDist = e.dist;
    }
  }
  return best;
}

function updateBarracks(tower, dt) {
  const def = tower.def;
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
      s.target.attackCd -= dt;
      if (s.target.attackCd <= 0) {
        s.hp -= CONFIG.enemy.meleeDamage;
        s.sinceHit = 0; // reset the regen clock — just took a hit
        s.target.attackCd = CONFIG.enemy.attackInterval;
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

  // passive regen once it's been a few seconds since the hero last took a hit
  hero.sinceHit += dt;
  if (hero.sinceHit >= HERO.regenDelay && hero.hp < hero.maxHp)
    hero.hp = Math.min(hero.maxHp, hero.hp + HERO_LEVELING.regenAt(hero.level) * dt);

  // While under orders (forcedMove), skip target-acquisition entirely — the
  // hero ignores every enemy, not just the one it was just fighting, so a
  // whole cluster of creeps can't keep grabbing its attention on the way.
  // It resumes normal behavior once it actually reaches commandPos, below.
  if (!hero.forcedMove) {
    // drop dead / too-far targets — leashed to the hero's OWN current position,
    // not a fixed point, since it roams instead of sitting at one tower
    if (hero.target && (hero.target.dead || dist(hero.x, hero.y, hero.target.x, hero.target.y) > HERO.aggroRadius))
      hero.target = null;
    // acquire nearest ground enemy within aggro radius (flyers can't be reached)
    if (!hero.target) {
      let best = null, bestD = Infinity;
      for (const e of state.enemies) {
        if (e.dead || e.flying) continue;
        const d = dist(hero.x, hero.y, e.x, e.y);
        if (d <= HERO.aggroRadius && d < bestD) { best = e; bestD = d; }
      }
      hero.target = best;
    }
  }

  const dest = hero.target || hero.commandPos;
  const d = dist(hero.x, hero.y, dest.x, dest.y);
  if (hero.forcedMove && d <= 1) hero.forcedMove = false; // arrived — resume normal behavior
  if (hero.target && d <= HERO.meleeRange) {
    // locked in melee: block the creep and trade blows
    hero.target.engaged = true;
    hero.attackCd -= dt;
    if (hero.attackCd <= 0) {
      // damage scales with hero level; XP = damage dealt + bounty on the kill
      const dmg = HERO_LEVELING.damageAt(hero.level);
      damageEnemy(hero.target, dmg);
      let xp = dmg;
      if (hero.target.dead) xp += hero.target.reward;
      if (gainHeroXp(hero, xp))
        setTip("⭐ Hero reached level " + hero.level + (hero.level >= HERO_LEVELING.maxLevel ? " — max power!" : "!"));
      hero.attackCd = HERO.attackInterval;
    }
    hero.target.attackCd -= dt;
    if (hero.target.attackCd <= 0) {
      hero.hp -= CONFIG.enemy.meleeDamage;
      hero.sinceHit = 0; // reset the regen clock — just took a hit
      hero.target.attackCd = CONFIG.enemy.attackInterval;
      if (hero.hp <= 0) { hero.alive = false; hero.respawn = HERO.respawnTime; hero.target = null; }
    }
  } else if (d > 1) {
    // walk toward target (to intercept) or back to the commanded position
    const step = HERO.speed * dt;
    hero.x += ((dest.x - hero.x) / d) * Math.min(step, d);
    hero.y += ((dest.y - hero.y) / d) * Math.min(step, d);
  }
}
