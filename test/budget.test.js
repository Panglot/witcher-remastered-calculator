import { test } from "node:test";
import assert from "node:assert/strict";
import { createBudget } from "../public/src/core/budget.js";

// The game's numbers (data/rules.js): level 100, 30 places of power, 3 points from items.
const budget = createBudget({ maxLevel: 100, placesOfPower: 30, items: [{ points: 2 }, { points: 1 }] });
const fresh = () => { const progress = budget.defaults(); return { progress, budget: budget.totalOf(progress) }; };

test("a new build: New Game at every max, level 100 giving 99 points", () => {
  const s = fresh();
  assert.deepEqual(s.progress, { ngPlus: false, level: 100, places: 30, other: 3, custom: false });
  assert.equal(s.budget, 132);
});

test("limits: NG+ doubles places of power and items, not the level", () => {
  assert.deepEqual(budget.limits(false), { level: [1, 100], places: [0, 30], other: [0, 3], total: [0, 132] });
  assert.deepEqual(budget.limits(true), { level: [1, 100], places: [0, 60], other: [0, 6], total: [0, 165] });
});

test("a source field: clamped, and the total follows", () => {
  const s = fresh();
  budget.setField(s, "level", 35);
  assert.equal(s.budget, 34 + 30 + 3);
  budget.setField(s, "places", 99);
  assert.equal(s.progress.places, 30);
  budget.setField(s, "level", 0);
  assert.equal(s.progress.level, 1);
});

test("a custom total: clamped; typing a source field brings the fields back", () => {
  const s = fresh();
  budget.setField(s, "level", 40);
  budget.setTotal(s, 500);
  assert.deepEqual([s.progress.custom, s.budget], [true, 132]);
  budget.setField(s, "other", 1);
  assert.deepEqual([s.progress.custom, s.progress.level, s.progress.places, s.budget], [false, 40, 30, 39 + 30 + 1]);
});

test("switching the playthrough keeps the points, clamped to what it can reach", () => {
  const s = fresh();
  budget.setNgPlus(s, true);
  assert.deepEqual([s.progress.places, s.progress.other, s.budget], [30, 3, 132]);
  budget.setMax(s);
  assert.deepEqual([s.progress.places, s.progress.other, s.budget], [60, 6, 165]);
  budget.setNgPlus(s, false);
  assert.deepEqual([s.progress.places, s.progress.other, s.budget], [30, 3, 132]);
  budget.setNgPlus(s, true);
  budget.setTotal(s, 150);
  budget.setNgPlus(s, false);
  assert.deepEqual([s.progress.custom, s.budget], [true, 132]);
});

test("setMax: every field at the playthrough's max; a custom total is dropped", () => {
  const s = fresh();
  budget.setTotal(s, 1);
  budget.setMax(s);
  assert.deepEqual([s.progress.custom, s.budget, s.progress.places], [false, 132, 30]);
});

test("normalize: no progress is a custom total, in NG+ when New Game can't reach it", () => {
  assert.deepEqual(budget.normalize(null, 20), { ngPlus: false, level: 100, places: 30, other: 3, custom: true });
  assert.equal(budget.normalize(undefined, 150).ngPlus, true);
  assert.deepEqual(budget.normalize({ level: 500, places: -3 }, 0), { ngPlus: false, level: 100, places: 0, other: 3, custom: false });
});
