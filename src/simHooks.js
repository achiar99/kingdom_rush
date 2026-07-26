// The seam between the game rules and whoever is watching them run.
//
// simulation.js used to import ui.js directly, which meant the rules could
// only execute inside a browser with the real DOM present. Everything it
// needed from ui.js was presentation — refresh the HUD, close a popup, show
// the win/lose overlay — so those calls now go through this object instead.
//
// The defaults are no-ops: import simulation.js on its own (in Node, in a
// test, in the balance harness under tools/sim) and it just runs. ui.js calls
// installSimHooks() at load time to plug the real screen back in.
export const simHooks = {
  closeMenus() {},
  updateHud() {},
  updateButtons() {},
  setTip(_msg) {},
  // won: boolean, stars: 0-3 (0 on a loss). Fired once, after the run's
  // result has already been recorded in `progress`.
  onGameOver(_won, _stars) {},
};

export function installSimHooks(hooks) {
  Object.assign(simHooks, hooks);
}
