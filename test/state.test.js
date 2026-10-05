import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../public/src/core/catalog.js";
import { defaultState, loadState, saveState, clearSavedState } from "../public/src/state.js";

const cat = createCatalog({
  rules: { maxRank: 3, slotGroups: 1, slotsPerGroup: 2, treeOrder: ["t"] },
  mutagens: { stats: {}, items: [] }, skillSets: [],
  trees: { t: { skills: [{ id: "r", name: "Root", root: true, col: 0, row: 0 }], links: [] } }
});

// A localStorage stand-in for the duration of one test.
function withStorage(fn) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); }
  };
  try { fn(store); } finally { delete globalThis.localStorage; }
}

test("reset saved data deletes the stored build and resets the same state object", () => {
  withStorage(store => {
    const state = defaultState(cat);
    state.pts = { r: 2 }; state.name = "Crossbow"; state.extra = "stale";
    saveState(state);
    assert.equal(store.size, 1);

    clearSavedState(cat, state);
    assert.equal(store.size, 0);
    assert.deepEqual(state, defaultState(cat));
    assert.deepEqual(loadState(cat), defaultState(cat));
  });
});
