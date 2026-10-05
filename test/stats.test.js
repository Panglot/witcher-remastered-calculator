import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../public/src/core/catalog.js";
import { createPlanner } from "../public/src/core/planner.js";
import { createStats } from "../public/src/core/stats.js";

// Two trees: t (red mutagen) and u (no mutagen). Two slot groups of 2.
const cat = createCatalog({
  rules: { maxRank: 3, slotGroups: 2, slotsPerGroup: 2, treeOrder: ["t", "u"] },
  mutagens: {
    stats: { red: { label: "Attack power", unit: "%" }, blue: { label: "Sign intensity", unit: "%" } },
    items: [{ id: "red-x", name: "Red mutagen", color: "red", value: 5 }, { id: "blue-x", name: "Blue mutagen", color: "blue", value: 5 }]
  },
  trees: {
    t: {
      name: "Tee", mutagen: "red", passive: { label: "Gain", per: 1.5, unit: "%" },
      skills: [{ id: "r", name: "Root", root: true, col: 0, row: 0 }, { id: "a", name: "A", col: 0, row: 1 }],
      links: ["r-a"]
    },
    u: {
      name: "You", mutagen: null, passive: { label: "Other", per: 1, unit: "%" },
      skills: [{ id: "x", name: "X", root: true, col: 0, row: 0 }],
      links: []
    }
  },
  skillSets: []
});
const stats = createStats(cat, createPlanner(cat));
const build = o => ({ pts: {}, slots: [null, null, null, null], mut: ["", ""], budget: 4, ...o });

test("points: total, spent and left, negative when overspent", () => {
  assert.deepEqual(stats.points(build({ pts: { r: 2, x: 1 } })), { total: 4, spent: 3, left: 1 });
  assert.equal(stats.points(build({ pts: { r: 3, a: 2 } })).left, -1);
});

test("unslotted lists skills with points outside every slot, in tree order", () => {
  const b = build({ pts: { x: 1, r: 2, a: 1 }, slots: ["a", null, null, null] });
  assert.deepEqual(stats.unslotted(b), [{ id: "r", name: "Root", rank: 2 }, { id: "x", name: "X", rank: 1 }]);
});

test("a tree's stats: spent, passive, slotted skills and only the mutagens of its colour", () => {
  const b = build({ pts: { r: 2, a: 1, x: 1 }, slots: ["r", "x", "a", null], mut: ["red-x", "red-x"] });
  const t = stats.tree(b, "t");
  assert.equal(t.spent, 3);
  assert.deepEqual(t.passive, { label: "Gain", value: 4.5, unit: "%" });
  assert.deepEqual(t.slotted.map(s => [s.id, s.rank]), [["r", 2], ["a", 1]]);
  // Group 0 holds r (match) and x (no match); group 1 holds a (match).
  assert.deepEqual(t.mutagens.map(m => [m.group, m.matches, m.value]), [[0, 1, 10], [1, 1, 10]]);
  assert.equal(t.mutagens[0].label, "Attack power");

  const u = stats.tree(b, "u");
  assert.equal(u.mutagen, null);
  assert.deepEqual(u.mutagens, []);
  assert.deepEqual(u.slotted.map(s => s.id), ["x"]);
});

test("a mutagen of another colour shows in no tree without that colour", () => {
  const b = build({ mut: ["blue-x", ""] });
  assert.deepEqual(stats.summary(b).trees.flatMap(t => t.mutagens), []);
});
