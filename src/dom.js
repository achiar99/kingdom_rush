// Tiny shared DOM lookup helper used across the UI/save/world-map modules.
export const el = (id) => document.getElementById(id);

// Shows exactly one of the three top-level screens (slot-select / world-map
// / play) by stamping a single view-* class onto <body>. See index.html for
// the CSS rules that key off it.
export function setView(name) {
  document.body.classList.remove("view-slots", "view-map", "view-play");
  document.body.classList.add("view-" + name);
}
