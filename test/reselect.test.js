import { test } from "node:test";
import assert from "node:assert/strict";
import { createReselect, RESELECT_MS } from "../public/src/ui/reselect.js";

// What a click event carries that matters here: its click count (0 for one sent by a key).
const click = detail => ({ detail });

// A reselect on mocked timers, and how many times it deselected.
function setup(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const r = createReselect(), done = { count: 0 };
  const off = () => { done.count++; };
  return { r, done, off, wait: () => t.mock.timers.tick(RESELECT_MS) };
}

test("a click on what its press just selected keeps it", t => {
  const { r, done, off, wait } = setup(t);
  r.press(false);
  r.click(click(1), true, off);
  wait();
  assert.equal(done.count, 0);
});

test("a click on what was already selected deselects it, once no second click came", t => {
  const { r, done, off } = setup(t);
  r.press(true);
  r.click(click(1), true, off);
  t.mock.timers.tick(RESELECT_MS - 1);
  assert.equal(done.count, 0);
  t.mock.timers.tick(1);
  assert.equal(done.count, 1);
});

test("a double-click on the selected item keeps it selected", t => {
  const { r, done, off, wait } = setup(t);
  r.press(true);
  r.click(click(1), true, off);
  r.press(true);
  r.click(click(2), true, off);
  wait();
  assert.equal(done.count, 0);
});

test("a double-click on an unselected item selects it at once and keeps it", t => {
  const { r, done, off, wait } = setup(t);
  r.press(false);
  r.click(click(1), false, off);
  r.press(true);
  r.click(click(2), true, off);
  wait();
  assert.equal(done.count, 0);
});

test("a press that held until its action ran keeps the selection", t => {
  const { r, done, off, wait } = setup(t);
  r.press(true);
  r.held();
  r.click(click(1), true, off);
  wait();
  assert.equal(done.count, 0);
});

test("Enter deselects at once, even after a press whose click never came (a drag)", t => {
  const { r, done, off } = setup(t);
  r.press(false);
  r.click(click(0), true, off);
  assert.equal(done.count, 1);
  r.click(click(0), false, off);
  assert.equal(done.count, 1);
});

test("cancel calls off a waiting deselect", t => {
  const { r, done, off, wait } = setup(t);
  r.press(true);
  r.click(click(1), true, off);
  r.cancel();
  wait();
  assert.equal(done.count, 0);
});
