import { test } from "node:test";
import assert from "node:assert/strict";
import { OPTIONS, defaultSettings, loadSettings, saveSettings, clearSavedSettings } from "../public/src/settings.js";

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

test("settings round-trip under their own key, apart from the build", () => {
  withStorage(store => {
    const s = defaultSettings();
    s.openSections.stats = ["combat"];
    saveSettings(s);
    assert.deepEqual([...store.keys()], ["w3r-skill-planner-settings-v1"]);
    assert.deepEqual(loadSettings().openSections, { stats: ["combat"] });
  });
});

test("broken or stale settings fall back to the defaults", () => {
  withStorage(store => {
    store.set("w3r-skill-planner-settings-v1", "{not json");
    assert.deepEqual(loadSettings(), defaultSettings());
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ openSections: "oops", old: 1 }));
    assert.deepEqual(loadSettings(), defaultSettings());
  });
});

test("an option keeps a saved value only if it is one of its choices", () => {
  withStorage(store => {
    assert.equal(defaultSettings().holdMs, 1000);
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ holdMs: 0 }));
    assert.equal(loadSettings().holdMs, 0);
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ holdMs: 750 }));
    assert.equal(loadSettings().holdMs, 1000);
  });
});

test("the background is random by default and keeps only a known choice", () => {
  withStorage(store => {
    assert.equal(defaultSettings().background, "random");
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ background: "cycle" }));
    assert.equal(loadSettings().background, "cycle");
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ background: "toussaint" }));
    assert.equal(loadSettings().background, "toussaint");
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ background: "atlantis" }));
    assert.equal(loadSettings().background, "random");
  });
});

test("clearing settings deletes the saved copy and resets the object in place", () => {
  withStorage(store => {
    const s = loadSettings();
    s.holdMs = 0;
    s.openSections.stats = ["combat"];
    saveSettings(s);
    clearSavedSettings(s);
    assert.equal(store.size, 0);
    assert.deepEqual(s, defaultSettings());
  });
});

test("every option's default is one of its choices", () => {
  const d = defaultSettings();
  Object.values(OPTIONS).forEach(o => assert.ok(o.choices.some(c => c.value === d[o.key]), o.key));
});

test("skill descriptions are classic by default and keep only a known choice", () => {
  withStorage(store => {
    assert.equal(defaultSettings().skillText, "classic");
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ skillText: "modern" }));
    assert.equal(loadSettings().skillText, "modern");
    store.set("w3r-skill-planner-settings-v1", JSON.stringify({ skillText: "fancy" }));
    assert.equal(loadSettings().skillText, "classic");
  });
});
