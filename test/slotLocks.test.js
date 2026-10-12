import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../public/src/core/catalog.js";
import { createPlanner } from "../public/src/core/planner.js";
import { createSlotKinds } from "../public/src/core/slotKinds.js";
import { createSlotLocks, LOCK_NONE, LOCK_SOFT, LOCK_HARD } from "../public/src/core/slotLocks.js";
import { createStats } from "../public/src/core/stats.js";

// One tree "t" (r - a) and two groups of one socket: socket 0 opens at 0 points, socket 1 at 10;
// the diamonds at 2 and 20.
const cat = createCatalog({
  rules: { maxRank: 3, slotGroups: 2, slotsPerGroup: 1, treeOrder: ["t"], slotUnlocks: { sockets: [0, 10], mutagens: [2, 20] } },
  mutagens: { stats: { red: { label: "Attack", unit: "%" } }, items: [{ id: "red-x", color: "red", value: 5 }] },
  trees: {
    t: {
      mutagen: "red", passive: { per: 1 },
      skills: [{ id: "r", name: "Root", root: true, col: 0, row: 0 }, { id: "a", name: "A", col: 0, row: 1 }],
      links: ["r-a"]
    }
  },
  skillSets: []
});
const planner = createPlanner(cat);
const locks = createSlotLocks(cat);
const stats = createStats(cat, planner, locks);
let mode = LOCK_SOFT;
const kinds = createSlotKinds(cat, planner, { locks, mode: () => mode });
const state = o => ({ pts: { r: 1, a: 1 }, slots: [null, null], mut: ["", ""], budget: 5, tab: "t", sel: null, selSlot: null, selGroup: null, selMut: null, ...o });

test("a slot is locked while the total is below its value, in soft and hard mode only", () => {
  const s = state();
  assert.deepEqual([0, 1].map(i => locks.isLocked(s, "skill", i, LOCK_SOFT)), [false, true]);
  assert.deepEqual([0, 1].map(i => locks.isLocked(s, "mutagen", i, LOCK_HARD)), [false, true]);
  assert.equal(locks.isLocked(s, "skill", 1, LOCK_NONE), false);
  assert.equal(locks.isLocked(state({ budget: 10 }), "skill", 1, LOCK_SOFT), false);
  assert.equal(locks.isBlocked(s, "skill", 1, LOCK_SOFT), false);
  assert.equal(locks.isBlocked(s, "skill", 1, LOCK_HARD), true);
});

test("required: the most any holder in use needs, sockets and diamonds", () => {
  assert.equal(locks.required(state()), 0);
  assert.equal(locks.required(state({ slots: ["r", "a"] })), 10);
  assert.equal(locks.required(state({ slots: ["r", null], mut: ["", "red-x"] })), 20);
});

test("soft: locked holders still take items", () => {
  mode = LOCK_SOFT;
  const s = state();
  assert.ok(kinds.skill.equip(s, "r", 1).ok);
  assert.ok(kinds.mutagen.equip(s, "red-x", 1).ok);
  assert.deepEqual(kinds.skill.dropTargets(s, "a"), [0, 1]);
  assert.equal(kinds.skill.lockedAt(s, 1), true);
  assert.equal(kinds.skill.blockedAt(s, 1), false);
});

test("hard: nothing new goes into a locked holder; what is there stays", () => {
  mode = LOCK_HARD;
  const s = state();
  assert.deepEqual(kinds.skill.equip(s, "r", 1), { ok: false, msg: "Unlocks at 10 points." });
  assert.equal(kinds.mutagen.equip(s, "red-x", 1).ok, false);
  assert.deepEqual(kinds.skill.dropTargets(s, "r"), [0]);
  assert.equal(kinds.skill.move(s, "r", null, 1).ok, false);
  assert.deepEqual(s.slots, [null, null]);
  // Apply mode starts on an open holder, past an empty locked one.
  assert.equal(kinds.skill.target(state({ slots: ["a", null] }), "r"), 0);
  // A loaded build with a skill in the locked socket: it can move out to an empty holder, but not
  // swap with a skill, which would go into the locked one.
  const loaded = state({ slots: ["a", "r"] });
  assert.deepEqual(kinds.skill.dropTargets(loaded, "r", 1), []);
  assert.equal(kinds.skill.move(loaded, "r", 1, 0).ok, false);
  assert.deepEqual(loaded.slots, ["a", "r"]);
  const alone = state({ slots: [null, "r"] });
  assert.deepEqual(kinds.skill.dropTargets(alone, "r", 1), [0]);
  assert.ok(kinds.skill.move(alone, "r", 1, 0).ok);
  assert.deepEqual(alone.slots, ["r", null]);
  mode = LOCK_SOFT;
});

test("points: locked slots in use need points too, and say when they set the number", () => {
  // Spent 2, total 5, socket 1 (10) in use: 10 needed, 5 short, set by the slots.
  const s = state({ slots: [null, "r"] });
  assert.deepEqual(stats.points(s, LOCK_SOFT), { total: 5, spent: 2, skills: 2, mutations: 0, slots: 10, left: -5, bySlots: true });
  // Without locking the slots need nothing.
  assert.deepEqual(stats.points(s, LOCK_NONE), { total: 5, spent: 2, skills: 2, mutations: 0, slots: 0, left: 3, bySlots: false });
  // Spent 6, below the slots' 10: still the slots. With only the first diamond (2) in use, the skills.
  const heavy = state({ pts: { r: 3, a: 3 }, slots: [null, "r"], budget: 0 });
  assert.deepEqual(stats.points(heavy, LOCK_SOFT), { total: 0, spent: 6, skills: 6, mutations: 0, slots: 10, left: -10, bySlots: true });
  const heavier = state({ pts: { r: 3, a: 3 }, slots: ["r", null], mut: ["red-x", ""], budget: 0 });
  assert.deepEqual(stats.points(heavier, LOCK_SOFT), { total: 0, spent: 6, skills: 6, mutations: 0, slots: 2, left: -6, bySlots: false });
  // The total opens every slot in use: only the skills count.
  assert.deepEqual(stats.points(state({ slots: [null, "r"], budget: 12 }), LOCK_SOFT), { total: 12, spent: 2, skills: 2, mutations: 0, slots: 10, left: 10, bySlots: false });
});
