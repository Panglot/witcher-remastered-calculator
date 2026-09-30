import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../public/src/core/catalog.js";
import { createPlanner } from "../public/src/core/planner.js";

// A small tree: r (root) - a - b, plus r - c. One slot group of 2.
const cat = createCatalog({
  rules: { maxRank: 3, slotGroups: 1, slotsPerGroup: 2, treeOrder: ["t"], mutagens: { "": "None", red: "Red" } },
  trees: {
    t: {
      mutagen: "red", passive: { per: 1.5 },
      skills: [
        { id: "r", name: "Root", root: true, col: 0, row: 0 },
        { id: "a", name: "A", col: 0, row: 1 },
        { id: "b", name: "B", col: 0, row: 2 },
        { id: "c", name: "C", col: 1, row: 1 }
      ],
      links: ["r-a", "a-b", "r-c"]
    }
  },
  archetypes: []
});
const planner = createPlanner(cat);
const build = (pts = {}) => ({ pts, slots: [null, null], mut: ["red"] });

test("only roots and neighbours of invested skills are open", () => {
  const b = build();
  assert.equal(planner.addPoint(b, "a").ok, false);
  assert.equal(planner.addPoint(b, "r").ok, true);
  assert.equal(planner.addPoint(b, "a").ok, true);
  assert.equal(planner.isOpen(b, "b"), true);
});

test("rank stops at maxRank", () => {
  const b = build({ r: 3 });
  const r = planner.addPoint(b, "r");
  assert.equal(r.ok, false);
  assert.match(r.msg, /already at rank 3/);
  assert.equal(b.pts.r, 3);
});

test("can't remove a last point that strands other skills", () => {
  const b = build({ r: 1, a: 1, b: 1 });
  const r = planner.removePoint(b, "a");
  assert.equal(r.ok, false);
  assert.match(r.msg, /B would lose its connection/);
  assert.equal(planner.removePoint(b, "b").ok, true);
  assert.equal(planner.removePoint(b, "a").ok, true);
  assert.deepEqual(b.pts, { r: 1 });
});

test("removing a skill's last point also unslots it", () => {
  const b = build({ r: 1, c: 1 });
  planner.toggleSlot(b, "c");
  planner.removePoint(b, "c");
  assert.deepEqual(b.slots, [null, null]);
});

test("slots need a point and run out", () => {
  const b = build({ r: 1, a: 1, c: 1 });
  assert.equal(planner.toggleSlot(b, "b").ok, false);
  planner.toggleSlot(b, "r"); planner.toggleSlot(b, "a");
  assert.match(planner.toggleSlot(b, "c").msg, /All 2 slots are full/);
  planner.toggleSlot(b, "r");
  assert.deepEqual(b.slots, [null, "a"]);
});

test("mutagen bonus counts matching slotted skills", () => {
  const b = build({ r: 1, a: 1 });
  planner.placeInSlot(b, 0, "r"); planner.placeInSlot(b, 1, "a");
  assert.deepEqual(planner.groupBonus(b, 0), { mutagen: "red", matches: 2, multiplier: 3 });
  b.mut[0] = "";
  assert.equal(planner.groupBonus(b, 0).multiplier, 0);
});

test("passive and spent totals", () => {
  const b = build({ r: 3, a: 2 });
  assert.equal(planner.spentAll(b), 5);
  assert.equal(planner.passiveValue(b, "t"), 7.5);
});
