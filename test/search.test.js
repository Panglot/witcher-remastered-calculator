import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";
import { createSearch, queryWords } from "../public/src/core/search.js";

const cat = createCatalog(data);
const search = createSearch(cat);
const skillNamed = name => Object.values(cat.nodes).find(n => n.name === name);

test("query words: lowercase, blank parts dropped", () => {
  assert.deepEqual(queryWords("  Sign  INTENSITY "), ["sign", "intensity"]);
  assert.deepEqual(queryWords(""), []);
  assert.deepEqual(queryWords(undefined), []);
});

test("an empty query finds nothing", () => {
  const f = search.find("   ");
  assert.equal(f.skill.size, 0);
  assert.equal(f.mutagen.size, 0);
});

test("skills by name, any case", () => {
  const rend = skillNamed("Rend");
  assert.ok(search.find("rEnD").skill.has(rend.id));
});

test("skills by their text, numbers of every rank filled in", () => {
  const rend = skillNamed("Rend");
  assert.ok(search.find("ignores enemy defenses").skill.has(rend.id));
  assert.ok(search.find("30%").skill.has(rend.id));
});

test("skills by the names and roles of their sets", () => {
  const set = cat.skillSets.find(s => s.id === "adrenaline");
  const found = search.find(set.name).skill;
  set.ids.forEach(id => assert.ok(found.has(id), id));
  assert.ok(search.find(`${set.name} spends`).skill.has("c_foa"));
  assert.ok(!search.find(`${set.name} spends`).skill.has("c_rf"));
});

test("every word must match, in any order", () => {
  const rend = skillNamed("Rend");
  assert.ok(search.find("defenses rend").skill.has(rend.id));
  assert.ok(!search.find("rend zzzz").skill.has(rend.id));
});

test("mutagens by name, stat and type", () => {
  const red = Object.values(cat.mutagens).filter(m => m.color === "red").map(m => m.id).sort();
  assert.deepEqual([...search.find("red mutagen").mutagen].sort(), red);
  assert.deepEqual([...search.find(cat.mutagens[red[0]].stat.label).mutagen].sort(), red);
  assert.equal(search.find(cat.mutagens[red[0]].type).mutagen.size, Object.keys(cat.mutagens).length);
});

test("sets by their label with the role, brackets typed or not", () => {
  const set = cat.skillSets.find(s => s.id === "adrenaline");
  const label = `${set.name} (spends`.toLowerCase();
  assert.ok(search.find(label).skill.has("c_foa"));
  assert.ok(!search.find(label).skill.has("c_rf"));
});
