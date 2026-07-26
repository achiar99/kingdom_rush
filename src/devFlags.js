// Development flags.
//
// The game runs in two places, so a "flag" has to be readable in both: the
// browser has no environment variables, and the balance harness in tools/sim
// has no URL. UNLOCK_ALL is therefore read from whichever exists —
//
//   browser   http://localhost:8777/?unlockAll=1     (sticks until you clear it)
//             http://localhost:8777/?unlockAll=0     (clears it)
//   node      TOWER_REALM_UNLOCK_ALL=1 node tools/sim/cli.js
//
// Nothing here ever writes to a save slot. Every consumer consults the flag at
// read time instead of stamping "unlocked" into `progress`, so turning the flag
// off leaves a save exactly as it was — you can't accidentally bake a cheat
// into someone's campaign.

function readBrowserFlag(param, storageKey) {
  if (typeof window === "undefined") return null;
  try {
    // A URL parameter both sets and clears the sticky value, so the flag is
    // switched the same way it's switched off.
    const raw = new URLSearchParams(window.location.search).get(param);
    if (raw !== null) {
      const on = raw !== "0" && raw !== "false" && raw !== "";
      if (on) window.localStorage.setItem(storageKey, "1");
      else window.localStorage.removeItem(storageKey);
      return on;
    }
    return window.localStorage.getItem(storageKey) === "1";
  } catch (e) {
    return null;   // storage blocked (file://, private mode) — fall through
  }
}

function readNodeFlag(envKey) {
  if (typeof process === "undefined" || !process.env) return null;
  const raw = process.env[envKey];
  if (raw === undefined) return null;
  return raw !== "0" && raw !== "false" && raw !== "";
}

// Everything the campaign gates is open: all fifty levels and all five stages,
// every tower and both abilities from wave 1, the full upgrade cap, and every
// star-store track at max rank.
export const UNLOCK_ALL =
  readBrowserFlag("unlockAll", "towerRealm.dev.unlockAll") ??
  readNodeFlag("TOWER_REALM_UNLOCK_ALL") ??
  false;
