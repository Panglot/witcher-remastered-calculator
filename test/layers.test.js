import { test } from "node:test";
import assert from "node:assert/strict";
import { createLayers } from "../public/src/ui/layers.js";

// A stack with fake page effects: the last inert call, and focus as a plain variable.
function setup() {
  const page = { inert: undefined, focused: null };
  const layers = createLayers({ setInert: live => { page.inert = live; }, focused: () => page.focused });
  return { layers, page };
}
// A focusable stand-in that records when it gets focus back.
const el = name => ({ name, isConnected: true, focus() { this.focused = true; } });
const key = k => ({ key: k, repeat: false });

test("Esc closes the top layer only, newest first", () => {
  const { layers } = setup();
  const left = { name: "stats", modal: false }, right = { name: "archetypes", modal: false };
  layers.open(left); layers.open(right);
  assert.equal(layers.escape(), true);
  assert.equal(layers.isOpen(right), false);
  assert.equal(layers.isOpen(left), true);
  layers.escape();
  assert.equal(layers.top(), null);
});

test("a layer's own escape() replaces closing it", () => {
  const { layers } = setup();
  let backs = 0;
  const menu = { name: "menu", modal: true, escape: () => { backs++; } };
  layers.open(menu);
  layers.escape();
  assert.equal(backs, 1);
  assert.equal(layers.isOpen(menu), true);
});

test("Esc with nothing open runs the idle action, if any", () => {
  const { layers } = setup();
  assert.equal(layers.escape(), false);
  let idle = 0;
  layers.onIdleEscape(() => { idle++; });
  assert.equal(layers.escape(), true);
  assert.equal(idle, 1);
  layers.onIdleEscape(() => false);
  assert.equal(layers.escape(), false);
});

test("opening twice or closing a closed layer does nothing", () => {
  const { layers } = setup();
  const a = { name: "a", modal: false };
  layers.open(a); layers.open(a);
  layers.escape();
  assert.equal(layers.top(), null);
  layers.close(a);
  assert.equal(layers.top(), null);
});

test("a confirm popup opened from the menu sits on top of it", () => {
  const { layers, page } = setup();
  const menuEl = el("menu"), popupEl = el("popup");
  const menu = { name: "menu", modal: true, live: () => [menuEl] };
  const confirm = { name: "confirm", modal: true, live: () => [popupEl] };
  layers.open(menu);
  assert.deepEqual(page.inert, [menuEl]);
  layers.open(confirm);
  assert.equal(layers.top(), confirm);
  assert.deepEqual(page.inert, [popupEl]);
  layers.escape();
  assert.equal(layers.top(), menu);
  assert.deepEqual(page.inert, [menuEl]);
  layers.escape();
  assert.equal(page.inert, null);
});

test("only modal layers make the page inert and block the planner's keys", () => {
  const { layers, page } = setup();
  const panel = { name: "stats", modal: false };
  layers.open(panel);
  assert.equal(page.inert, null);
  assert.equal(layers.blocking(), false);
  const popup = { name: "confirm", modal: true, live: () => [] };
  layers.open(popup);
  assert.deepEqual(page.inert, []);
  assert.equal(layers.blocking(), true);
  // Closed out of order, the side panel on top again leaves the page usable.
  layers.close(popup);
  assert.equal(page.inert, null);
  assert.equal(layers.blocking(), false);
});

test("keys go to the top layer first, then down to the first modal one", () => {
  const { layers } = setup();
  const got = [];
  const make = (name, modal, takes) => ({ name, modal, keys: e => { got.push(name); return takes.includes(e.key); } });
  layers.open(make("popup", true, ["e"]));
  layers.open(make("stats", false, []));
  layers.open(make("archetypes", false, ["h"]));

  assert.equal(layers.key(key("h")), true);
  assert.deepEqual(got, ["archetypes"]);
  got.length = 0;
  assert.equal(layers.key(key("e")), true);
  assert.deepEqual(got, ["archetypes", "stats", "popup"]);
  got.length = 0;
  // Nobody takes it; the modal popup keeps it from anything under it.
  assert.equal(layers.key(key("x")), false);
  assert.deepEqual(got, ["archetypes", "stats", "popup"]);
  assert.equal(layers.blocking(), true);
});

test("the right mouse button backs out of a modal top layer only", () => {
  const { layers } = setup();
  const panel = { name: "stats", modal: false };
  layers.open(panel);
  assert.equal(layers.back(), false);
  assert.equal(layers.isOpen(panel), true);
  let cancelled = false;
  const apply = { name: "apply", modal: true, escape: () => { cancelled = true; } };
  layers.open(apply);
  assert.equal(layers.back(), true);
  assert.equal(cancelled, true);
});

test("focus goes back to where it was when the top layer closes", () => {
  const { layers, page } = setup();
  const skill = el("skill"), menuItem = el("menu item");
  page.focused = skill;
  const menu = { name: "menu", modal: true };
  layers.open(menu);
  page.focused = menuItem;
  const confirm = { name: "confirm", modal: true };
  layers.open(confirm);
  layers.close(confirm);
  assert.equal(menuItem.focused, true);
  layers.close(menu);
  assert.equal(skill.focused, true);
});

test("a layer closed from under the top one leaves focus alone", () => {
  const { layers, page } = setup();
  const skill = el("skill");
  page.focused = skill;
  const left = { name: "stats", modal: false }, right = { name: "archetypes", modal: false };
  layers.open(left); layers.open(right);
  layers.close(left);
  assert.equal(skill.focused, undefined);
});
