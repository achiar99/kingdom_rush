// Seeded RNG. The game simulation itself is fully deterministic — no dice
// anywhere in simulation.js — so every bit of run-to-run variation in the
// balance harness comes from here, i.e. from the *player*. That's deliberate:
// a level's difficulty is a distribution over how people might play it, and
// this is the only knob that generates that distribution.
export class Rng {
  constructor(seed) {
    // mulberry32
    this.s = (seed >>> 0) || 1;
  }

  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.float(min, max + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  // Pick from `arr` with probability proportional to weightFn(item).
  // Falls back to a uniform pick when every weight is zero.
  weighted(arr, weightFn) {
    let total = 0;
    const w = arr.map((it) => { const v = Math.max(0, weightFn(it)); total += v; return v; });
    if (total <= 0) return this.pick(arr);
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
}
