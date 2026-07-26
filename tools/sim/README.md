# Level balance harness

Plays whole levels headlessly, thousands of times, and reports on whether
their difficulty holds up.

```bash
node tools/sim/cli.js                      # every realm, 300 runs per skill
node tools/sim/cli.js --trials 1000        # the full sweep
node tools/sim/cli.js -l 9 --waves         # one realm, wave-by-wave detail
node tools/sim/tune.js -l 9 -p hpScale --range 1.5:5.5:0.5
```

## How it works

`src/simulation.js` is the real game loop and it is DOM-free: everything it
wants to *show* someone goes through `src/simHooks.js`, which the harness
leaves as no-ops. So these runs are not a model of the game — they *are* the
game, driven at a fixed timestep with a bot on the controls.

The bot in `bot.js` never touches game state directly. Every move goes through
`src/actions.js`, the same functions `ui.js` calls from click handlers, so a
simulated run cannot play by different rules than a human one.

## Where the statistics come from

The simulation is completely deterministic — there is no RNG anywhere in
`simulation.js`. Running one level 1000 times with one fixed strategy would
produce 1000 identical results.

All variance therefore comes from the **player**. `bot.js` defines skill as a
handful of knobs — how well it reads a wave, how good its build spots are, how
fast it reacts, how much gold it leaves idle — and seeds them per run. A
level's difficulty is a distribution over how people might play it, and that
distribution is what the report samples.

Four profiles:

| profile   | what it represents                                          |
|-----------|-------------------------------------------------------------|
| `novice`  | slow, poor spots, hoards gold, rarely uses abilities         |
| `average` | the median player                                            |
| `expert`  | fast, near-optimal choices, active hero and abilities        |
| `perfect` | **not a difficulty** — the feasibility bound                 |

`perfect` is the important one. If `perfect` can't clear a level, the level
isn't hard, it's broken: no amount of human skill will get there.

## What gets checked

Static (straight off `levels.js`, no simulation):

- **opening affordability** — wave-1 HP per starting gold, against realm 1's
- **on-ramp** — whether wave 1 is harder than wave 3

Simulated, per level:

- **feasibility** — can `perfect` clear it at all
- **the campaign curve** — average-skill win rate vs. the target for that slot
- **triviality** — a novice who can't lose
- **skill sensitivity** — does playing well change the outcome
- **difficulty cliffs** — a wave whose leak rate jumps far above the ramp
- **single walls** — one wave causing most of a level's losses
- **front-loading** — waves 1–2 punishing before anything can be built
- **anticlimax** — the level peaking before its final wave
- **star thresholds** — is 3★ an achievement or a default
- **economy** — gold left idle, build spots never used

Across the campaign:

- **monotonicity** — a realm easier than the one before it
- **flat stretches** — three realms that play the same

Every threshold lives in `TARGETS` at the top of `analyze.js`. They're
opinions; edit them.

## Files

| file          | role                                                  |
|---------------|-------------------------------------------------------|
| `cli.js`      | entry point, worker pool, report assembly             |
| `tune.js`     | parameter sweeps and bisection (`--solve`)            |
| `harness.js`  | one trial: reset, step the real `update()`, record it |
| `bot.js`      | the synthetic player and its skill profiles           |
| `stats.js`    | percentiles, Wilson intervals, per-cell summaries     |
| `analyze.js`  | static profile + all the balance rules                |
| `report.js`   | console formatting                                    |
| `worker.js`   | one `(level, skill)` cell per thread                  |
| `rng.js`      | seeded mulberry32                                     |

`cli.js` exits non-zero when any level is graded BROKEN, so it can gate CI.

## Caveats

- The bot is a decent player, not a great one. Read `expert` as "a solid
  human", not "the theoretical optimum" — that's what `perfect` is for, and
  even `perfect` only searches the strategies `bot.js` knows about (greedy
  marginal-value-per-gold on build, upgrade, and tower type). A level it fails
  is worth investigating, not automatically condemning.
- Trials run at `dt = 1/30`. The browser uses a variable timestep capped at
  1/20, so results are representative but not frame-identical.
- Levels are patched in memory by `tune.js`; `levels.js` is never written to.
  Apply the numbers you like by hand.
