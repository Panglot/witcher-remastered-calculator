import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, loadSettings, saveSettings } from "../public/src/settings.js";

// A localStorage stand-in for the duration of one test.
function withStorage(fn) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); }
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
