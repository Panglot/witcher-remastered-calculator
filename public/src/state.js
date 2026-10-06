// Page state and its copy in localStorage, so a refresh keeps the build you're working on.
// The key is versioned: change it only if the stored shape changes incompatibly.
const STORE_KEY = "w3r-skill-planner-v1";

export function defaultState(catalog) {
  const { slots, order, budget } = catalog;
  const progress = budget.defaults();
  return {
    // Build (see core/build.js). budget: the points the build has, from progress (core/budget.js).
    pts: {}, slots: Array(slots.total).fill(null), mut: Array(slots.groups).fill(""), budget: budget.totalOf(progress), progress, name: "",
    // View. sel / selMut: selected skill / mutagen; selSlot / selGroup: the socket / diamond it was
    // picked from, null when picked in its panel (core/slotKinds.js).
    tab: order[0], sel: null, selSlot: null, selMut: null, selGroup: null, skillSets: []
  };
}

export function loadState(catalog) {
  const state = defaultState(catalog);
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    // Copy only known keys, so fields from older versions don't linger.
    if (saved && saved.pts) Object.keys(state).forEach(k => { if (k in saved) state[k] = saved[k]; });
  } catch (e) {}
  // Saved before progress was kept: the budget was typed in, so it stays a custom total.
  state.progress = catalog.budget.normalize(saved && saved.pts ? saved.progress : state.progress, state.budget);
  state.budget = catalog.budget.budgetOf(state.progress, state.budget);
  if (!catalog.tabs.includes(state.tab)) state.tab = catalog.order[0];
  if (state.sel && !catalog.nodes[state.sel]) state.sel = null;
  if (state.selMut && !catalog.mutagenId(state.selMut)) state.selMut = null;
  // Highlighted skill sets that no longer exist (renamed or removed in data/skillSets.js) are dropped.
  state.skillSets = Array.isArray(state.skillSets) ? state.skillSets.filter(id => catalog.skillSets.some(s => s.id === id)) : [];
  // Saved before mutagen sizes, `mut` held colours.
  state.mut = Array.isArray(state.mut) && state.mut.length === catalog.slots.groups
    ? state.mut.map(catalog.mutagenId) : Array(catalog.slots.groups).fill("");
  // A holder index that no longer holds the selection is ignored on use (core/slotKinds.js, heldAt).
  ["selSlot", "selGroup"].forEach(k => { if (!Number.isInteger(state[k])) state[k] = null; });
  return state;
}

/** Deletes the saved build and resets `state` in place to a new one (panels hold on to the object). */
export function clearSavedState(catalog, state) {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  Object.keys(state).forEach(k => { delete state[k]; });
  Object.assign(state, defaultState(catalog));
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}
