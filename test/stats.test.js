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

test("a tree's stats: spent points and passive", () => {
  const t = stats.tree(build({ pts: { r: 2, a: 1, x: 1 } }), "t");
  assert.deepEqual(t, { id: "t", name: "Tee", spent: 3, passive: { label: "Gain", value: 4.5, unit: "%" } });
});

test("mutagen bonus: the equipped mutagens of a colour, summed, one kind per mutagen", () => {
  // Group 0 holds r (match) and x (no match); group 1 holds a (match). Same mutagen twice: one kind.
  const b = build({ pts: { r: 2, a: 1, x: 1 }, slots: ["r", "x", "a", null], mut: ["red-x", "red-x"] });
  assert.deepEqual(stats.mutagenBonus(b, "red"), {
    label: "Attack power", unit: "%", value: 20,
    kinds: [{ id: "red-x", name: "Red mutagen", count: 2, matches: 2 }]
  });
  assert.equal(stats.mutagenBonus(b, "blue"), null);
});

test("different mutagens of one colour: one summed bonus, a kind each in slot group order", () => {
  const two = createCatalog({
    rules: { maxRank: 3, slotGroups: 2, slotsPerGroup: 2, treeOrder: ["t"] },
    mutagens: {
      stats: { red: { label: "Attack power", unit: "%" } },
      items: [{ id: "big", name: "Greater red mutagen", color: "red", value: 10 }, { id: "small", name: "Lesser red mutagen", color: "red", value: 5 }]
    },
    trees: { t: { name: "Tee", mutagen: "red", passive: { label: "Gain", per: 1, unit: "%" },
      skills: [{ id: "r", name: "Root", root: true, col: 0, row: 0 }, { id: "a", name: "A", col: 0, row: 1 }], links: ["r-a"] } },
    skillSets: []
  });
  const s = createStats(two, createPlanner(two));
  const m = s.mutagenBonus(build({ pts: { r: 1, a: 1 }, slots: [null, null, "r", "a"], mut: ["small", "big"] }), "red");
  assert.deepEqual(m.kinds.map(k => [k.id, k.count, k.matches]), [["small", 1, 0], ["big", 1, 2]]);
  assert.equal(m.value, 5 + 3 * 10);
});

test("totals: slotted skills at their rank, times their count; mutagens raised by Synergy", () => {
  const cat = createCatalog({
    rules: { maxRank: 3, slotGroups: 1, slotsPerGroup: 4, treeOrder: ["t"] },
    mutagens: { stats: { red: { label: "Attack power", unit: "%" } }, items: [{ id: "red-x", name: "Red mutagen", color: "red", value: 10 }] },
    trees: {
      t: {
        name: "Tee", mutagen: "red", passive: { label: "Gain", per: 1, unit: "%" },
        skills: [
          { id: "r", name: "Root", game: "g_r", root: true, col: 0, row: 0 },
          { id: "syn", name: "Synergy", game: "g_syn", col: 0, row: 1 }, { id: "wolf", name: "Wolf", game: "g_wolf", col: 0, row: 2 },
          { id: "bear", name: "Bear", game: "g_bear", col: 0, row: 3 }, { id: "off", name: "Off", game: "g_off", col: 0, row: 4 }
        ],
        links: ["r-syn", "syn-wolf", "wolf-bear", "bear-off"]
      }
    },
    skillSets: [],
    skillText: {
      g_r: { name: "Root", maxRank: 3, text: "" },
      g_syn: { name: "Synergy", maxRank: 3, text: "", values: { bonus: [10, 20, 30] } },
      g_wolf: { name: "Wolf", maxRank: 3, text: "", values: { ap: [2, 4, 6], vit: [1, 2, 3] } },
      g_bear: { name: "Bear", maxRank: 3, text: "", values: { vit: [2, 4, 6] } },
      g_off: { name: "Off", maxRank: 3, text: "", values: { g: [5, 10, 15] } }
    },
    totals: {
      synergy: { skill: "syn", value: "bonus" },
      stats: [
        { id: "ap", label: "Attack power", unit: "%", sources: [{ mutagen: "red" }, { skill: "wolf", value: "ap", times: 4, when: "4 Medium", armor: "medium" }] },
        { id: "vit", label: "Vitality", unit: "%", sources: [{ skill: "wolf", value: "vit", times: 4, when: "4 Medium", armor: "medium" }, { skill: "bear", value: "vit", times: 4, when: "4 Heavy", armor: "heavy" }] },
        { id: "gain", label: "Gain", unit: "%", sources: [{ passive: "t" }, { skill: "off", value: "g" }] }
      ]
    }
  });
  assert.deepEqual(cat.problems, []);
  const s = createStats(cat, createPlanner(cat));
  // off has points but no slot: Gain has only the passive, so it isn't listed.
  const b = build({ pts: { r: 1, syn: 3, wolf: 2, bear: 1, off: 1 }, slots: ["syn", "wolf", "bear", "r"], mut: ["red-x"] });
  const [ap, vit, ...rest] = s.totals(b);
  assert.deepEqual(rest, []);
  // Red mutagen with 4 matching skills: 10 x 5 = 50; Synergy rank 3: +30% of it; Wolf rank 2: 4 x 4.
  // Wolf is conditional: only in max.
  assert.deepEqual(ap.parts.map(p => [p.type, p.value, p.when]), [["mutagen", 50, ""], ["synergy", 15, ""], ["skill", 16, "4 Medium"]]);
  assert.deepEqual([ap.value, ap.max], [65, 81]);
  // Wolf (medium) 4 x 2 = 8, Bear (heavy) 4 x 2 = 8 at rank 1: a tie keeps the first; the other doesn't count.
  assert.deepEqual(vit.parts.map(p => p.counted), [true, false]);
  assert.deepEqual([vit.value, vit.max], [0, 8]);
});

test("totals of an empty build: nothing listed", () => {
  assert.deepEqual(stats.totals(build({})), []);
});
