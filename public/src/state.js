// Page state and its copy in localStorage, so a refresh keeps the build you're working on.
// The key is versioned: change it only if the stored shape changes incompatibly.
const STORE_KEY = "w3r-skill-planner-v1";

export function defaultState(catalog) {
  const { slots, order } = catalog;
  return {
    // Build (see core/build.js)
    pts: {}, slots: Array(slots.total).fill(null), mut: ["green"].concat(Array(slots.groups - 1).fill("")), budget: 4, name: "",
    // View
    tab: order[0], sel: null, arch: []
  };
}

export function loadState(catalog) {
  const state = defaultState(catalog);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    // Copy only known keys, so fields from older versions don't linger.
    if (saved && saved.pts) Object.keys(state).forEach(k => { if (k in saved) state[k] = saved[k]; });
  } catch (e) {}
  if (!catalog.trees[state.tab]) state.tab = catalog.order[0];
  if (state.sel && !catalog.nodes[state.sel]) state.sel = null;
  return state;
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}
