/* Tower Realm — a small Kingdom Rush-style tower defense.
 * Vanilla Canvas, no dependencies. Runs from a static server (see index.html).
 *
 * Four tower archetypes:
 *   archer    — cheap, fast single-target projectiles, long range
 *   artillery — slow, heavy SPLASH damage in a radius, short range
 *   magic     — expensive, high single-target damage, fast bolts
 *   barracks  — no attack; spawns SOLDIERS that block & melee creeps on the road
 */

(() => {
  "use strict";

  // ---------------------------------------------------------------- config
  const CONFIG = {
    width: 900,
    height: 560,
    startGold: 220,
    startLives: 20,
    waveClearBonus: 30,
    enemy: {
      meleeDamage: 14,      // damage an engaged creep deals to a soldier per hit
      attackInterval: 1.0,  // seconds between creep melee hits
    },
  };

  // Enemy archetypes. `armor` is fractional damage reduction against NON-magic
  // hits (archer/artillery/soldiers); Magic ignores it. `flying` creeps can't be
  // blocked or hit by Barracks soldiers. hp/speed are further scaled per wave.
  const ENEMY_TYPES = {
    grunt:   { name: "Grunt",   radius: 12, hp: 45,  speed: 55,  reward: 12, armor: 0,    flying: false,
               colors: { light: "#f08a7d", mid: "#c0392b", dark: "#7d1d13" } },
    runner:  { name: "Runner",  radius: 9,  hp: 26,  speed: 108, reward: 10, armor: 0,    flying: false,
               colors: { light: "#ffe9a0", mid: "#e6b422", dark: "#9a7410" } },
    armored: { name: "Armored", radius: 12, hp: 70,  speed: 48,  reward: 18, armor: 0.55, flying: false,
               colors: { light: "#cdd6e2", mid: "#8b97a8", dark: "#4f5a6b" } },
    tank:    { name: "Tank",    radius: 18, hp: 190, speed: 34,  reward: 28, armor: 0.2,  flying: false,
               colors: { light: "#b98a6a", mid: "#7c4f30", dark: "#472a17" } },
    flyer:   { name: "Flyer",   radius: 11, hp: 52,  speed: 74,  reward: 16, armor: 0,    flying: true,
               colors: { light: "#c9b6ff", mid: "#7d5fd6", dark: "#452f8c" } },
    boss:    { name: "Boss",    radius: 26, hp: 1100, speed: 26, reward: 160, armor: 0.35, flying: false, boss: true,
               colors: { light: "#ff9d76", mid: "#b5361e", dark: "#5e160c" } },
  };

  // Tower archetypes. Stats live here so the whole game is easy to rebalance.
  const TOWER_TYPES = {
    archer: {
      key: "archer", name: "Archer", icon: "🏹", cost: 70,
      attack: "single", range: 130, damage: 14, fireRate: 1.9,
      projectileSpeed: 460, projColor: "#ffe27a",
      palette: { light: "#dff5c8", mid: "#8bbf5a", dark: "#4c7a2e" },
    },
    artillery: {
      key: "artillery", name: "Artillery", icon: "💣", cost: 100,
      attack: "splash", range: 110, damage: 26, fireRate: 0.55,
      projectileSpeed: 300, splashRadius: 48, projColor: "#ffb057",
      palette: { light: "#f6d7a2", mid: "#c98a3c", dark: "#7d4d18" },
    },
    magic: {
      key: "magic", name: "Magic", icon: "🔮", cost: 115,
      attack: "single", range: 140, damage: 42, fireRate: 1.05,
      projectileSpeed: 560, projColor: "#d79bff",
      palette: { light: "#f0dcff", mid: "#a86be0", dark: "#5f359c" },
    },
    barracks: {
      key: "barracks", name: "Barracks", icon: "⚔️", cost: 90,
      attack: "none", range: 100,            // engagement radius for soldiers
      soldierCount: 3, soldierHp: 65, soldierDamage: 11,
      soldierAttackInterval: 0.8, soldierSpeed: 85, soldierRespawn: 5,
      meleeRange: 20,
      palette: { light: "#cfd6e6", mid: "#7a8296", dark: "#464d5e" },
    },
  };
  const TYPE_LIST = ["archer", "artillery", "barracks", "magic"];

  // The active level's geometry/theme is loaded into these by loadLevel().
  let PATH = [];
  let BUILD_SPOTS = [];
  let PATH_LEN = 0;
  let THEME = null;
  let LEVEL = null; // current level def

  // Wave definitions. Each wave is a list of spawn `groups` (type + count + gap),
  // spawned in order. hpMul/speedMul scale the whole wave so later ones bite.
  const WAVES = [
    { hpMul: 1.0, speedMul: 1.0, groups: [
      { type: "grunt", count: 8, gap: 0.9 } ] },
    { hpMul: 1.15, speedMul: 1.0, groups: [
      { type: "grunt", count: 6, gap: 0.8 },
      { type: "runner", count: 6, gap: 0.4 } ] },
    { hpMul: 1.3, speedMul: 1.0, groups: [
      { type: "grunt", count: 6, gap: 0.7 },
      { type: "armored", count: 4, gap: 0.8 } ] },
    { hpMul: 1.4, speedMul: 1.05, groups: [
      { type: "runner", count: 8, gap: 0.35 },
      { type: "flyer", count: 4, gap: 0.7 } ] },
    { hpMul: 1.5, speedMul: 1.05, groups: [
      { type: "armored", count: 6, gap: 0.6 },
      { type: "tank", count: 2, gap: 1.4 } ] },
    { hpMul: 1.6, speedMul: 1.1, groups: [
      { type: "grunt", count: 6, gap: 0.5 },
      { type: "flyer", count: 6, gap: 0.5 },
      { type: "runner", count: 8, gap: 0.3 } ] },
    { hpMul: 1.7, speedMul: 1.1, groups: [
      { type: "tank", count: 3, gap: 1.2 },
      { type: "armored", count: 6, gap: 0.6 },
      { type: "flyer", count: 5, gap: 0.5 } ] },
    { hpMul: 1.8, speedMul: 1.15, groups: [
      { type: "runner", count: 10, gap: 0.3 },
      { type: "armored", count: 6, gap: 0.5 },
      { type: "tank", count: 2, gap: 1.2 },
      { type: "boss", count: 1, gap: 0.5 } ] },
  ];

  // Visual themes for the ground + road, selected per level.
  const THEMES = {
    greenwood: { grass: ["#3d724a", "#274d33"], checker: "rgba(255,255,255,0.02)",
      path: { rim: "#7a5a34", body: "#b08a52", track: "#d8b578" } },
    frostpeak: { grass: ["#7fa8c9", "#4d739a"], checker: "rgba(255,255,255,0.05)",
      path: { rim: "#8a9bb0", body: "#c3d2e2", track: "#eaf2fb" } },
    emberfall: { grass: ["#3a2320", "#160d0b"], checker: "rgba(255,120,60,0.04)",
      path: { rim: "#5a2313", body: "#8f3a1e", track: "#c9642f" } },
  };

  // Levels: each has its own map geometry, theme, economy and difficulty.
  // `hpScale` multiplies every creep's HP; `node` is the map-screen position (%).
  const LEVELS = [
    {
      id: "greenwood", name: "Greenwood Vale", difficulty: "Easy",
      theme: "greenwood", startGold: 220, startLives: 20, hpScale: 1.0,
      node: { x: 17, y: 74 },
      path: [
        { x: -30, y: 120 }, { x: 220, y: 120 }, { x: 220, y: 340 },
        { x: 460, y: 340 }, { x: 460, y: 120 }, { x: 700, y: 120 },
        { x: 700, y: 440 }, { x: 930, y: 440 },
      ],
      spots: [
        { x: 120, y: 220 }, { x: 320, y: 250 }, { x: 320, y: 430 },
        { x: 560, y: 250 }, { x: 560, y: 430 }, { x: 620, y: 60 },
        { x: 800, y: 250 }, { x: 800, y: 530 }, { x: 130, y: 40 },
      ],
    },
    {
      id: "frostpeak", name: "Frostpeak Pass", difficulty: "Normal",
      theme: "frostpeak", startGold: 210, startLives: 20, hpScale: 1.35,
      node: { x: 50, y: 44 },
      path: [
        { x: -30, y: 460 }, { x: 180, y: 460 }, { x: 180, y: 140 },
        { x: 380, y: 140 }, { x: 380, y: 420 }, { x: 560, y: 420 },
        { x: 560, y: 140 }, { x: 760, y: 140 }, { x: 760, y: 460 }, { x: 930, y: 460 },
      ],
      spots: [
        { x: 90, y: 250 }, { x: 280, y: 250 }, { x: 280, y: 500 },
        { x: 470, y: 280 }, { x: 470, y: 90 }, { x: 660, y: 250 },
        { x: 660, y: 500 }, { x: 850, y: 280 }, { x: 300, y: 90 },
      ],
    },
    {
      id: "emberfall", name: "Emberfall Keep", difficulty: "Hard",
      theme: "emberfall", startGold: 250, startLives: 18, hpScale: 1.8,
      node: { x: 82, y: 24 },
      path: [
        { x: -30, y: 70 }, { x: 830, y: 70 }, { x: 830, y: 190 },
        { x: 70, y: 190 }, { x: 70, y: 310 }, { x: 830, y: 310 },
        { x: 830, y: 430 }, { x: 70, y: 430 }, { x: 70, y: 540 }, { x: 930, y: 540 },
      ],
      spots: [
        { x: 200, y: 130 }, { x: 430, y: 130 }, { x: 660, y: 130 },
        { x: 200, y: 250 }, { x: 430, y: 250 }, { x: 660, y: 250 },
        { x: 430, y: 370 }, { x: 200, y: 485 }, { x: 660, y: 485 },
      ],
    },
  ];

  function loadLevel(idx) {
    LEVEL = LEVELS[idx];
    LEVEL.index = idx;
    PATH = LEVEL.path;
    BUILD_SPOTS = LEVEL.spots;
    THEME = THEMES[LEVEL.theme];
    PATH_LEN = pathLength();
  }

  // ---------------------------------------------------------------- state
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const state = {
    gold: 0, lives: 0, waveIndex: -1,
    enemies: [], towers: [], projectiles: [], effects: [],
    spawnQueue: [], spawnTimer: 0,
    running: false, over: false, paused: false, speed: 1,
    hoverSpot: null, menuSpot: null, selected: null,
  };

  // ---------------------------------------------------------------- helpers
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function spotOccupied(spot) {
    return state.towers.some((t) => t.spot === spot);
  }

  function pathLength() {
    let total = 0;
    for (let i = 1; i < PATH.length; i++)
      total += dist(PATH[i - 1].x, PATH[i - 1].y, PATH[i].x, PATH[i].y);
    return total;
  }

  // Convert a distance travelled along the path into an {x, y} position.
  function pointAtDistance(d) {
    let remaining = d;
    for (let i = 1; i < PATH.length; i++) {
      const a = PATH[i - 1], b = PATH[i];
      const seg = dist(a.x, a.y, b.x, b.y);
      if (remaining <= seg) {
        const t = seg === 0 ? 0 : remaining / seg;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      remaining -= seg;
    }
    return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
  }

  // Nearest point on the path to (px,py) — used to rally soldiers onto the road.
  function nearestPointOnPath(px, py) {
    let best = { x: PATH[0].x, y: PATH[0].y }, bestD = Infinity;
    for (let i = 1; i < PATH.length; i++) {
      const a = PATH[i - 1], b = PATH[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const x = a.x + dx * t, y = a.y + dy * t;
      const d = dist(px, py, x, y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  function damageEnemy(e, dmg, isMagic) {
    if (e.dead) return;
    if (!isMagic && e.armor) dmg *= 1 - e.armor; // armor resists non-magic damage
    e.hp -= dmg;
    if (e.hp <= 0) { e.dead = true; state.gold += e.reward; }
  }

  // ---------------------------------------------------------------- factory
  // entry: { type, hpMul, speedMul } — a single queued spawn.
  function makeEnemy(entry) {
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

  const MAX_LEVEL = 3;
  const SELL_REFUND = 0.7; // fraction of total invested gold returned on sell

  function makeTower(spot, typeKey) {
    const type = TOWER_TYPES[typeKey];
    const t = { spot, x: spot.x, y: spot.y, type: typeKey, def: type,
                cooldown: 0, level: 1, invested: type.cost };
    computeStats(t);
    if (type.attack === "none") {
      t.rally = nearestPointOnPath(spot.x, spot.y);
      t.soldiers = [];
      for (let i = 0; i < type.soldierCount; i++) t.soldiers.push(makeSoldier(t, i));
    }
    return t;
  }

  // Derive a tower's live stats from its base def and current level. Called on
  // build and after each upgrade so all combat code can read t.range/t.damage/etc.
  function computeStats(t) {
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

  function upgradeCost(t) { return Math.round(t.def.cost * (0.8 + 0.6 * t.level)); }
  function sellValue(t) { return Math.round(t.invested * SELL_REFUND); }

  function makeSoldier(tower, i) {
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

  // ---------------------------------------------------------------- waves
  function startNextWave() {
    if (state.over || state.running) return;
    if (state.waveIndex + 1 >= WAVES.length) return;
    state.waveIndex++;
    const wave = WAVES[state.waveIndex];
    // flatten the wave's groups into an ordered queue of individual spawns,
    // each carrying its own gap (delay until the NEXT spawn) and wave scaling.
    state.spawnQueue = [];
    for (const g of wave.groups)
      for (let i = 0; i < g.count; i++)
        state.spawnQueue.push({ type: g.type, gap: g.gap,
          hpMul: wave.hpMul * LEVEL.hpScale, speedMul: wave.speedMul });
    state.spawnTimer = 0;
    state.running = true;
    closeMenus();
    updateHud();
    updateButtons();
  }

  function waveCleared() {
    state.running = false;
    if (state.waveIndex + 1 >= WAVES.length) {
      endGame(true);
    } else {
      state.gold += CONFIG.waveClearBonus;
      setTip("Wave cleared! +" + CONFIG.waveClearBonus + " gold. Build up, then start the next wave.");
    }
    updateHud();
    updateButtons();
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
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

    // reset per-frame engagement flags; barracks soldiers re-set them
    for (const e of state.enemies) e.engaged = false;

    // barracks soldiers: acquire, move, melee, block
    for (const t of state.towers) if (t.def.attack === "none") updateBarracks(t, dt);

    // move enemies that aren't blocked in melee
    for (const e of state.enemies) {
      if (e.engaged) continue;
      e.dist += e.speed * dt;
      const p = pointAtDistance(e.dist);
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

  function acquireTarget(tower) {
    // target the enemy furthest along the path that's within range
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
          s.x = s.home.x; s.y = s.home.y; s.target = null; s.attackCd = 0;
        }
        continue;
      }
      // drop dead / out-of-range targets
      if (s.target && (s.target.dead || dist(tower.x, tower.y, s.target.x, s.target.y) > tower.range))
        s.target = null;
      // acquire nearest ground enemy within engagement radius (flyers can't be blocked)
      if (!s.target) {
        let best = null, bestD = Infinity;
        for (const e of state.enemies) {
          if (e.dead || e.flying) continue;
          const d = dist(tower.x, tower.y, e.x, e.y);
          if (d <= tower.range && d < bestD) { best = e; bestD = d; }
        }
        s.target = best;
      }

      const dest = s.target || s.home;
      const d = dist(s.x, s.y, dest.x, dest.y);
      if (s.target && d <= def.meleeRange) {
        // locked in melee: block the creep and trade blows
        s.target.engaged = true;
        s.attackCd -= dt;
        if (s.attackCd <= 0) { damageEnemy(s.target, tower.soldierDamage); s.attackCd = def.soldierAttackInterval; }
        s.target.attackCd -= dt;
        if (s.target.attackCd <= 0) {
          s.hp -= CONFIG.enemy.meleeDamage;
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

  // ---------------------------------------------------------------- render
  const LIGHT = { x: -0.5, y: -0.6 };

  function groundShadow(cx, cy, rx, ry) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function shadedSphere(cx, cy, r, light, mid, dark) {
    const hx = cx + LIGHT.x * r * 0.55;
    const hy = cy + LIGHT.y * r * 0.55;
    const g = ctx.createRadialGradient(hx, hy, r * 0.1, cx, cy, r);
    g.addColorStop(0, light);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, dark);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    drawGround();
    drawPath();
    drawBuildSpots();

    const endP = PATH[PATH.length - 1];
    drawCastle(endP.x - 26, endP.y);

    // rally flags + soldiers (draw under towers/enemies mixing by y)
    for (const t of state.towers) if (t.def.attack === "none") drawRally(t);

    for (const t of state.towers) drawTower(t);

    // soldiers + enemies sorted together by y for depth layering
    const walkers = [];
    for (const e of state.enemies) walkers.push({ y: e.y, kind: "enemy", ref: e });
    for (const t of state.towers)
      if (t.def.attack === "none")
        for (const s of t.soldiers) if (s.alive) walkers.push({ y: s.y, kind: "soldier", ref: s });
    walkers.sort((a, b) => a.y - b.y);
    for (const w of walkers) (w.kind === "enemy" ? drawEnemy : drawSoldier)(w.ref);

    for (const fx of state.effects) drawEffect(fx);
    for (const p of state.projectiles) drawProjectile(p);

    // range ring for a selected tower (manage mode)
    if (state.selected) {
      ctx.beginPath();
      ctx.arc(state.selected.x, state.selected.y, state.selected.range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(90,209,165,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(90,209,165,0.55)";
      ctx.stroke();
    }

    // range preview when hovering a buildable spot or the build menu is open
    const previewSpot = state.menuSpot || (state.hoverSpot && !spotOccupied(state.hoverSpot) ? state.hoverSpot : null);
    if (previewSpot && !spotOccupied(previewSpot)) {
      ctx.beginPath();
      ctx.arc(previewSpot.x, previewSpot.y, TOWER_TYPES.archer.range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(90,209,165,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(90,209,165,0.4)";
      ctx.stroke();
    }

    if (state.paused && !state.over) drawPausedBanner();
  }

  function drawPausedBanner() {
    ctx.fillStyle = "rgba(10,12,18,0.5)";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = "#e8ecf4";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⏸ Paused", CONFIG.width / 2, CONFIG.height / 2);
  }

  function drawGround() {
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
    g.addColorStop(0, THEME.grass[0]);
    g.addColorStop(1, THEME.grass[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = THEME.checker;
    for (let y = 0; y < CONFIG.height; y += 40)
      for (let x = 0; x < CONFIG.width; x += 40)
        if (((x + y) / 40) % 2 === 0) ctx.fillRect(x, y, 40, 40);
    const v = ctx.createRadialGradient(
      CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.3,
      CONFIG.width / 2, CONFIG.height / 2, CONFIG.height * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  }

  function strokePath(width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
  }

  function drawPath() {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.save();
    ctx.translate(0, 3);
    strokePath(46, "rgba(0,0,0,0.25)");
    ctx.restore();
    strokePath(44, THEME.path.rim);
    strokePath(38, THEME.path.body);
    strokePath(26, THEME.path.track);
    strokePath(6, "rgba(255,240,200,0.12)");
  }

  function drawBuildSpots() {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
    for (const s of BUILD_SPOTS) {
      if (spotOccupied(s)) continue;
      const affordable = state.gold >= TOWER_TYPES.archer.cost;
      groundShadow(s.x, s.y + 3, 20, 8);
      shadedSphere(s.x, s.y, 15, "#8a8f9c", "#6c7280", "#474c58");
      ctx.beginPath();
      ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = affordable ? `rgba(255,207,82,${0.55 + 0.4 * pulse})` : "rgba(255,255,255,0.25)";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = affordable ? `rgba(255,207,82,${0.5 + 0.3 * pulse})` : "rgba(255,255,255,0.3)";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", s.x, s.y);
    }
  }

  function towerBase(t) {
    groundShadow(t.x + 4, t.y + 10, 22, 9);
    shadedSphere(t.x, t.y + 6, 18, "#9aa2b8", "#5c6685", "#39415c");
    shadedSphere(t.x, t.y, 16, "#aeb6cc", "#6b769a", "#454e70");
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    // level pips: gold dots along the bottom of the base for levels above 1
    for (let i = 0; i < t.level - 1; i++) {
      ctx.beginPath();
      ctx.arc(t.x - 4 + i * 8, t.y + 15, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffcf52";
      ctx.fill();
    }
  }

  function barrel(t, len, w, color, light) {
    const target = acquireTarget(t);
    let ang = -Math.PI / 4;
    if (target) ang = Math.atan2(target.y - (t.y - 7), target.x - t.x);
    ctx.save();
    ctx.translate(t.x, t.y - 7);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = light;
    ctx.fillRect(0, -w / 2, len, 2);
    ctx.restore();
  }

  function drawTower(t) {
    const p = t.def.palette;
    if (t.type === "barracks") {
      // squat keep with a flag instead of a turret
      towerBase(t);
      ctx.fillStyle = "#6a5334";
      ctx.fillRect(t.x - 2, t.y - 24, 4, 20);
      ctx.fillStyle = t.def.palette.dark;
      ctx.beginPath();
      ctx.moveTo(t.x + 2, t.y - 24);
      ctx.lineTo(t.x + 18, t.y - 20);
      ctx.lineTo(t.x + 2, t.y - 14);
      ctx.closePath();
      ctx.fill();
      return;
    }
    towerBase(t);
    if (t.type === "magic") {
      // floating glowing orb, no barrel
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
      const gr = ctx.createRadialGradient(t.x, t.y - 9, 1, t.x, t.y - 9, 16);
      gr.addColorStop(0, "rgba(230,200,255,0.9)");
      gr.addColorStop(1, "rgba(150,90,220,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 9, 14 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      shadedSphere(t.x, t.y - 9, 9, p.light, p.mid, p.dark);
      return;
    }
    if (t.type === "artillery") {
      shadedSphere(t.x, t.y - 6, 11, p.light, p.mid, p.dark);
      barrel(t, 20, 9, "#4a3a24", "#7a6038");
      return;
    }
    // archer
    shadedSphere(t.x, t.y - 7, 10, p.light, p.mid, p.dark);
    barrel(t, 17, 5, "#3a4260", "#565f82");
  }

  function drawRally(t) {
    const r = t.rally;
    ctx.strokeStyle = "rgba(90,209,165,0.5)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#caa15f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - 12);
    ctx.lineTo(r.x, r.y + 4);
    ctx.stroke();
    ctx.fillStyle = "#5ad1a5";
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - 12);
    ctx.lineTo(r.x + 10, r.y - 9);
    ctx.lineTo(r.x, r.y - 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawSoldier(s) {
    groundShadow(s.x + 1, s.y + 6, 9, 4);
    shadedSphere(s.x, s.y, 7, "#bcd0ff", "#5b78c8", "#2f4788");
    ctx.beginPath();
    ctx.arc(s.x + LIGHT.x * 3, s.y + LIGHT.y * 3, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
    // small hp bar
    const w = 16, h = 3, pct = Math.max(0, s.hp / s.maxHp);
    if (pct < 1) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(s.x - w / 2, s.y - 14, w, h);
      ctx.fillStyle = "#5ad1a5";
      ctx.fillRect(s.x - w / 2, s.y - 14, w * pct, h);
    }
  }

  function drawEnemy(e) {
    const r = e.radius;
    const lift = e.flying ? 18 : 0;      // flyers hover above their ground shadow
    const cy = e.y - lift;
    const col = e.colors;

    // ground shadow stays on the path; flyers cast a smaller, detached one
    if (e.flying) groundShadow(e.x + 3, e.y + 3, r * 1.0, r * 0.45);
    else groundShadow(e.x + 2, e.y + r * 0.7, r * 1.3, r * 0.5);

    if (e.flying) drawWings(e.x, cy, r);

    // shaded body
    shadedSphere(e.x, cy, r, col.light, col.mid, col.dark);
    // glossy rim + specular highlight
    ctx.beginPath();
    ctx.arc(e.x, cy, r, Math.PI * 0.15, Math.PI * 0.75);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x + LIGHT.x * r * 0.5, cy + LIGHT.y * r * 0.5, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();

    if (e.armor) drawArmor(e.x, cy, r);
    if (e.boss) drawCrown(e.x, cy, r);

    // hp bar (width scales with size)
    const w = Math.max(24, r * 2), h = e.boss ? 6 : 4;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(e.x - w / 2, cy - r - 12, w, h);
    ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
    ctx.fillRect(e.x - w / 2, cy - r - 12, w * pct, h);
  }

  function drawWings(x, y, r) {
    const flap = Math.sin(performance.now() / 90) * 0.35;
    ctx.fillStyle = "rgba(60,40,90,0.85)";
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(s * r * 0.9, -2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawArmor(x, y, r) {
    // steel plate band across the body with rivets
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(230,238,250,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.15);
    ctx.lineTo(x + r, y - r * 0.15);
    ctx.stroke();
    ctx.fillStyle = "rgba(20,26,38,0.35)";
    ctx.fillRect(x - r, y + r * 0.15, r * 2, r * 0.85);
    ctx.restore();
    for (const rx of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.arc(x + rx * r, y - r * 0.15, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = "#eef2fa";
      ctx.fill();
    }
  }

  function drawCrown(x, y, r) {
    const top = y - r - 4;
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, top);
    ctx.lineTo(x - r * 0.6, top - 7);
    ctx.lineTo(x - r * 0.3, top - 2);
    ctx.lineTo(x, top - 9);
    ctx.lineTo(x + r * 0.3, top - 2);
    ctx.lineTo(x + r * 0.6, top - 7);
    ctx.lineTo(x + r * 0.6, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawProjectile(p) {
    const R = p.attack === "splash" ? 12 : 9;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    g.addColorStop(0, "rgba(255,255,235,0.95)");
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, p.color + "00"); // hex + "00" = fully transparent outer edge
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.attack === "splash" ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fffbe0";
    ctx.fill();
  }

  function drawEffect(fx) {
    const t = 1 - fx.life / fx.maxLife;
    const r = fx.maxR * (0.4 + 0.6 * t);
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,176,87,${0.4 * (1 - t)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,230,150,${0.8 * (1 - t)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawCastle(x, y) {
    groundShadow(x + 32, y + 24, 42, 14);
    const block = (bx, by, bw, bh, base, top) => {
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, top);
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(bx + bw - 3, by, 3, bh);
    };
    block(x, y - 26, 52, 52, "#4a5160", "#8a93a6");
    for (let i = 0; i < 4; i++) block(x + i * 14, y - 36, 9, 12, "#3f4654", "#7d879b");
    const dg = ctx.createLinearGradient(x + 20, y - 6, x + 20, y + 26);
    dg.addColorStop(0, "#5a3320");
    dg.addColorStop(1, "#2e190f");
    ctx.fillStyle = dg;
    ctx.fillRect(x + 20, y - 6, 12, 32);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(x + 23, y - 46, 6, 14);
    ctx.fillStyle = "#8a2820";
    ctx.fillRect(x + 23, y - 46, 6, 3);
  }

  // ---------------------------------------------------------------- popup menus
  const buildMenu = document.getElementById("buildMenu");
  const towerMenu = document.getElementById("towerMenu");

  function positionMenu(menuEl, x, y) {
    menuEl.style.left = (x / CONFIG.width) * 100 + "%";
    menuEl.style.top = (y / CONFIG.height) * 100 + "%";
  }

  function closeMenus() { closeBuildMenu(); closeManageMenu(); }

  // --- build menu (empty spot) ---
  function openBuildMenu(spot) {
    closeManageMenu();
    state.menuSpot = spot;
    buildMenu.innerHTML = "";
    for (const key of TYPE_LIST) {
      const def = TOWER_TYPES[key];
      const btn = document.createElement("button");
      btn.className = "tower-opt";
      btn.disabled = state.gold < def.cost;
      btn.title = def.name + " — " + def.cost + " gold";
      btn.innerHTML =
        `<span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="ct">💰${def.cost}</span>`;
      btn.addEventListener("click", (ev) => { ev.stopPropagation(); buildTower(spot, key); });
      buildMenu.appendChild(btn);
    }
    positionMenu(buildMenu, spot.x, spot.y);
    buildMenu.classList.add("show");
  }

  function closeBuildMenu() {
    state.menuSpot = null;
    buildMenu.classList.remove("show");
  }

  function buildTower(spot, key) {
    const def = TOWER_TYPES[key];
    if (spotOccupied(spot)) return closeBuildMenu();
    if (state.gold < def.cost) { setTip("Not enough gold for " + def.name + " (need " + def.cost + ")."); return; }
    state.gold -= def.cost;
    state.towers.push(makeTower(spot, key));
    setTip("");
    closeBuildMenu();
    updateHud();
  }

  // --- manage menu (existing tower): upgrade / sell ---
  function openManageMenu(tower) {
    closeBuildMenu();
    state.selected = tower;
    const def = tower.def;
    const maxed = tower.level >= MAX_LEVEL;
    const upCost = upgradeCost(tower);
    const stars = "★".repeat(tower.level) + "☆".repeat(MAX_LEVEL - tower.level);
    towerMenu.innerHTML = "";

    const head = document.createElement("div");
    head.className = "thead";
    head.innerHTML = `<b>${def.icon} ${def.name}</b><div class="stars">${stars}</div>`;
    towerMenu.appendChild(head);

    const up = document.createElement("button");
    up.className = "up";
    up.disabled = maxed || state.gold < upCost;
    up.textContent = maxed ? "Max level" : `⬆ Upgrade  💰${upCost}`;
    up.addEventListener("click", (ev) => { ev.stopPropagation(); upgradeTower(tower); });
    towerMenu.appendChild(up);

    const sell = document.createElement("button");
    sell.className = "sell";
    sell.textContent = `Sell  💰${sellValue(tower)}`;
    sell.addEventListener("click", (ev) => { ev.stopPropagation(); sellTower(tower); });
    towerMenu.appendChild(sell);

    positionMenu(towerMenu, tower.x, tower.y);
    towerMenu.classList.add("show");
  }

  function closeManageMenu() {
    state.selected = null;
    towerMenu.classList.remove("show");
  }

  function upgradeTower(t) {
    if (t.level >= MAX_LEVEL) return;
    const cost = upgradeCost(t);
    if (state.gold < cost) { setTip("Not enough gold to upgrade (need " + cost + ")."); return; }
    state.gold -= cost;
    t.level++;
    t.invested += cost;
    computeStats(t);
    setTip("");
    updateHud();
    openManageMenu(t); // refresh the panel with new level / costs
  }

  function sellTower(t) {
    const refund = sellValue(t);
    state.gold += refund;
    state.towers = state.towers.filter((x) => x !== t);
    closeManageMenu();
    updateHud();
    setTip("Sold " + t.def.name + " for " + refund + " gold.");
  }

  // ---------------------------------------------------------------- input
  canvas.addEventListener("mousemove", (ev) => {
    const { x, y } = canvasPos(ev);
    state.hoverSpot = BUILD_SPOTS.find((s) => dist(x, y, s.x, s.y) <= 18) || null;
    canvas.style.cursor = state.hoverSpot ? "pointer" : "default";
  });

  canvas.addEventListener("click", (ev) => {
    if (state.over) return;
    const { x, y } = canvasPos(ev);
    const spot = BUILD_SPOTS.find((s) => dist(x, y, s.x, s.y) <= 18);
    if (!spot) { closeMenus(); return; }
    if (spotOccupied(spot)) openManageMenu(state.towers.find((t) => t.spot === spot));
    else openBuildMenu(spot);
  });

  // click anywhere else / Escape closes any open menu
  document.addEventListener("click", (ev) => {
    if (!buildMenu.contains(ev.target) && !towerMenu.contains(ev.target) && ev.target !== canvas)
      closeMenus();
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeMenus(); });

  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  // ---------------------------------------------------------------- ui
  const el = (id) => document.getElementById(id);
  function updateHud() {
    el("gold").textContent = state.gold;
    el("lives").textContent = state.lives;
    el("wave").textContent = Math.max(0, state.waveIndex + 1);
    refreshManageMenu();
  }

  // Keep the open manage-menu's Upgrade button in sync as gold changes live
  // (e.g. from kills while the panel is open), without rebuilding the panel.
  function refreshManageMenu() {
    if (!state.selected || !towerMenu.classList.contains("show")) return;
    const t = state.selected;
    const up = towerMenu.querySelector(".up");
    if (!up) return;
    const maxed = t.level >= MAX_LEVEL;
    up.disabled = maxed || state.gold < upgradeCost(t);
  }
  function updateButtons() {
    const btn = el("startBtn");
    if (state.over) { btn.disabled = true; return; }
    btn.disabled = state.running || state.waveIndex + 1 >= WAVES.length;
    btn.textContent = state.waveIndex === -1 ? "Start wave 1" : "Start wave " + (state.waveIndex + 2);
    if (state.waveIndex + 1 >= WAVES.length && !state.running) btn.textContent = "All waves done";
  }
  function setTip(msg) { el("tip").textContent = msg; }

  function endGame(won) {
    state.over = true;
    state.running = false;
    closeMenus();
    const nextIdx = LEVEL.index + 1;
    if (won) { markComplete(LEVEL.id); unlockLevel(nextIdx); }

    el("overlayTitle").textContent = won ? "🏆 Victory!" : "💀 Defeated";
    el("overlaySub").textContent = won
      ? LEVEL.name + " defended against every wave!"
      : "The creeps overran " + LEVEL.name + ".";

    const btns = el("overlayBtns");
    btns.innerHTML = "";
    const mk = (label, cls, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener("click", fn);
      btns.appendChild(b);
    };
    if (won && LEVELS[nextIdx]) mk("Next level ▶", "", () => startLevel(nextIdx));
    mk(won ? "Replay" : "Retry", "secondary", () => startLevel(LEVEL.index));
    mk("🗺 World map", "secondary", showMap);
    el("overlay").classList.add("show");
    updateButtons();
  }

  el("startBtn").addEventListener("click", startNextWave);
  el("resetBtn").addEventListener("click", () => startLevel(LEVEL.index));
  el("mapBtn").addEventListener("click", showMap);
  el("speedBtn").addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
    el("speedBtn").textContent = "Speed: " + state.speed + "×";
  });
  el("pauseBtn").addEventListener("click", () => {
    if (state.over) return;
    state.paused = !state.paused;
    el("pauseBtn").textContent = state.paused ? "▶ Resume" : "⏸ Pause";
  });

  el("exportBtn").addEventListener("click", exportProgress);
  el("importBtn").addEventListener("click", () => el("importFile").click());
  el("importFile").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (file) importProgressFromFile(file);
    ev.target.value = ""; // allow re-importing the same filename later
  });
  el("wipeBtn").addEventListener("click", wipeProgress);

  function resetGame() {
    Object.assign(state, {
      gold: LEVEL.startGold, lives: LEVEL.startLives, waveIndex: -1,
      enemies: [], towers: [], projectiles: [], effects: [],
      spawnQueue: [], spawnTimer: 0,
      running: false, over: false, paused: false, speed: 1, hoverSpot: null, menuSpot: null, selected: null,
    });
    el("levelName").textContent = LEVEL.name;
    el("speedBtn").textContent = "Speed: 1×";
    el("pauseBtn").textContent = "⏸ Pause";
    el("overlay").classList.remove("show");
    el("waveMax").textContent = WAVES.length;
    closeMenus();
    setTip("Place towers, then start wave 1.");
    updateHud();
    updateButtons();
  }

  // ---------------------------------------------------------------- world map
  // Progress auto-saves to localStorage (instant, survives reloads on this
  // browser/origin) and can also be exported/imported as a real .json file
  // on disk — for backups or moving progress to another browser/machine.
  const SAVE_KEY = "towerRealm.progress";
  const SAVE_VERSION = 1;

  function defaultProgress() { return { unlocked: 1, done: [] }; }

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      return sanitizeProgress(raw) || defaultProgress();
    } catch (e) { return defaultProgress(); }
  }

  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) {} }

  // Accepts a bare {unlocked,done} object OR a wrapped export file
  // ({ app, version, progress }); returns null if the shape is unusable.
  function sanitizeProgress(raw) {
    if (!raw || typeof raw !== "object") return null;
    const src = raw.progress && typeof raw.progress === "object" ? raw.progress : raw;
    const validIds = new Set(LEVELS.map((lv) => lv.id));
    const unlocked = Math.min(LEVELS.length, Math.max(1, Number(src.unlocked) || 1));
    const done = Array.isArray(src.done) ? src.done.filter((id) => validIds.has(id)) : [];
    return { unlocked, done };
  }

  let progress = loadProgress();
  function markComplete(id) { if (!progress.done.includes(id)) progress.done.push(id); saveProgress(); }
  function unlockLevel(idx) {
    if (idx < LEVELS.length && idx + 1 > progress.unlocked) { progress.unlocked = idx + 1; saveProgress(); }
  }

  function exportProgress() {
    const payload = {
      app: "tower-realm-save", version: SAVE_VERSION,
      savedAt: new Date().toISOString(), progress,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tower-realm-save.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSaveTip("Save exported to your downloads.");
  }

  function importProgressFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed = null;
      try { parsed = JSON.parse(reader.result); } catch (e) { /* fall through to error tip */ }
      const clean = sanitizeProgress(parsed);
      if (!clean) { setSaveTip("That file doesn't look like a Tower Realm save."); return; }
      progress = clean;
      saveProgress();
      renderMap();
      setSaveTip("Save imported — " + progress.done.length + " level(s) completed.");
    };
    reader.onerror = () => setSaveTip("Couldn't read that file.");
    reader.readAsText(file);
  }

  function wipeProgress() {
    if (!confirm("Erase all saved progress? This can't be undone.")) return;
    progress = defaultProgress();
    saveProgress();
    renderMap();
    setSaveTip("Progress erased.");
  }

  function setSaveTip(msg) { el("saveTip").textContent = msg; }

  function showMap() {
    state.paused = true;                 // freeze any in-progress game underneath
    el("overlay").classList.remove("show");
    closeMenus();
    document.body.classList.add("view-map");
    renderMap();
  }

  function startLevel(idx) {
    loadLevel(idx);
    document.body.classList.remove("view-map");
    resetGame();
  }

  function renderMap() {
    // dashed trail connecting the level nodes
    const svg = el("mapTrail");
    const pts = LEVELS.map((lv) => (lv.node.x / 100 * 900) + " " + (lv.node.y / 100 * 560));
    svg.innerHTML = `<path d="M ${pts.join(" L ")}" fill="none" stroke="rgba(255,243,208,0.45)" ` +
      `stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round"/>`;

    const nodes = el("mapNodes");
    nodes.innerHTML = "";
    LEVELS.forEach((lv, i) => {
      const unlocked = i < progress.unlocked;
      const done = progress.done.includes(lv.id);
      const btn = document.createElement("button");
      btn.className = "map-node" + (unlocked ? "" : " locked") + (done ? " done" : "");
      btn.style.left = lv.node.x + "%";
      btn.style.top = lv.node.y + "%";
      const disc = unlocked ? (i + 1) : "🔒";
      btn.innerHTML =
        `<div class="disc">${disc}${done ? '<span class="badge">✅</span>' : ""}</div>` +
        `<div class="label">${lv.name}</div><div class="diff">${lv.difficulty}</div>`;
      if (unlocked) btn.addEventListener("click", () => startLevel(i));
      nodes.appendChild(btn);
    });
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);
    if (LEVEL) {                          // only simulate/draw once a level is loaded
      if (!state.paused) for (let i = 0; i < state.speed; i++) update(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  // boot into the world map
  showMap();
  requestAnimationFrame(loop);
})();
