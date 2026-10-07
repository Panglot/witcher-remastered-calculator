import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";
import { highlightedSkills, setLabels } from "../public/src/core/skillSets.js";

const cat = createCatalog(data);
const sorted = map => [...map.keys()].sort();

test("a set given by roles gets its ids from them and a role per skill", () => {
  const adrenaline = cat.skillSets.find(s => s.id === "adrenaline");
  assert.equal(adrenaline.tree, "general");
  assert.ok(adrenaline.ids.includes("c_rf") && adrenaline.ids.includes("c_foa"));
  assert.equal(adrenaline.role.c_rf, "builds");
  assert.equal(adrenaline.role.c_foa, "spends");
  assert.deepEqual(cat.skillSets.find(s => s.id === "aard").role, {});
});

test("sets come in tree order", () => {
  const trees = [...new Set(cat.skillSets.map(s => s.tree))];
  assert.deepEqual(trees, cat.order);
});

test("highlight: any selected set, or only the skills in all of them", () => {
  assert.deepEqual(sorted(highlightedSkills(cat, [], false)), []);
  assert.deepEqual(sorted(highlightedSkills(cat, ["strong", "vitality"], true)), ["g_bear"]);
  assert.deepEqual(sorted(highlightedSkills(cat, ["aard", "vitality"], true)), ["s_sw"]);
  assert.deepEqual(sorted(highlightedSkills(cat, ["adrenaline", "intensity"], true)), ["c_foa", "s_foc"]);
  const any = highlightedSkills(cat, ["aard", "quen"], false);
  assert.ok(any.has("s_fra") && any.has("s_es"));
  // An unknown id (a set since removed) is skipped.
  assert.deepEqual(sorted(highlightedSkills(cat, ["gone", "aard", "vitality"], true)), ["s_sw"]);
});

test("highlight counts the selected sets each skill is in", () => {
  const any = highlightedSkills(cat, ["adrenaline", "stamina", "strong"], false);
  assert.equal(any.get("c_rend"), 3);
  assert.equal(any.get("c_wh"), 2);
  assert.equal(highlightedSkills(cat, ["adrenaline", "stamina"], true).get("c_rend"), 2);
});

test("tooltip sets: the selected ones, or every one, with the role when the set has roles", () => {
  assert.deepEqual(setLabels(cat, "c_foa", [], false), []);
  assert.deepEqual(setLabels(cat, "c_foa", ["adrenaline"], false), ["Adrenaline (spends)"]);
  assert.deepEqual(setLabels(cat, "c_foa", [], true), ["Sign intensity (raises)", "Adrenaline (spends)"]);
  assert.deepEqual(setLabels(cat, "s_fra", ["aard"], false), ["Aard"]);
});
