import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog, MUTAGEN_TAB } from "../public/src/core/catalog.js";
import { createPlanner } from "../public/src/core/planner.js";
import { createSlotKinds } from "../public/src/core/slotKinds.js";

// One tree "t" (r - a) and two groups of one socket, so each kind has two holders.
const cat = createCatalog({
  rules: { maxRank: 3, slotGroups: 2, slotsPerGroup: 1, treeOrder: ["t"] },
  mutagens: { stats: { red: { label: "Attack", unit: "%" } }, items: [{ id: "red-x", color: "red", value: 5 }, { id: "red-y", color: "red", value: 3 }] },
  trees: {
    t: {
      mutagen: "red", passive: { per: 1 },
      skills: [{ id: "r", name: "Root", root: true, col: 0, row: 0 }, { id: "a", name: "A", col: 0, row: 1 }],
      links: ["r-a"]
    }
  },
  skillSets: []
});
const kinds = createSlotKinds(cat, createPlanner(cat));
const state = () => ({ pts: { r: 1, a: 1 }, slots: [null, null], mut: ["", ""], tab: "t", sel: null, selSlot: null, selMut: null, selGroup: null });

// The same scenarios for both kinds: what holds them, an item and the tabs.
const CASES = [
  { name: "skill", kind: kinds.skill, list: "slots", item: "r", tab: "t", other: MUTAGEN_TAB },
  { name: "mutagen", kind: kinds.mutagen, list: "mut", item: "red-x", tab: MUTAGEN_TAB, other: "t" }
];

for (const { name, kind, list, item, tab, other } of CASES) {
  const empty = name === "skill" ? null : "";

  test(`${name}: a full holder is selected and framed instead of the panel item`, () => {
    const s = state();
    s[list][1] = item; s.tab = other;
    kind.select(s, kind.itemAt(s, 1), 1);
    assert.equal(s.tab, tab);
    assert.equal(kind.selected(s), item);
    assert.equal(kind.framedAt(s, 1), true);
    assert.equal(kind.framedInPanel(s, item), false);
    kind.select(s, item);
    assert.equal(kind.framedAt(s, 1), false);
    assert.equal(kind.framedInPanel(s, item), true);
  });

  test(`${name}: a holder picked under a tab showing its kind keeps that tab`, () => {
    const s = state();
    s[list][1] = item; s.tab = tab === MUTAGEN_TAB ? tab : "u";
    kind.select(s, item, 1);
    assert.equal(s.tab, tab === MUTAGEN_TAB ? tab : "u");
    assert.equal(kind.framedAt(s, 1), true);
  });

  test(`${name}: an emptied holder hands the frame back to the panel`, () => {
    const s = state();
    s[list][0] = item;
    kind.select(s, item, 0);
    kind.clear(s, 0);
    assert.equal(kind.itemAt(s, 0), null);
    assert.equal(kind.framedAt(s, 0), false);
    assert.equal(kind.framedInPanel(s, item), true);
  });

  test(`${name}: open shows the kind's tab`, () => {
    const s = state();
    kind.select(s, item); s.tab = other;
    kind.open(s);
    assert.equal(s.tab, tab);
  });

  test(`${name}: an equip starts on the first empty holder, else the item's own, else the first`, () => {
    const s = state();
    assert.equal(kind.target(s, item), 0);
    s[list][0] = "x";
    assert.equal(kind.target(s, item), 1);
    s[list][1] = item;
    assert.equal(kind.target(s, item), 1);
    s[list][1] = "y";
    assert.equal(kind.target(s, item), 0);
  });

  test(`${name}: a hovered item lights every holder, full or empty, but the one it is in`, () => {
    const s = state();
    s[list][1] = "x";
    assert.deepEqual(kind.dropTargets(s, item), [0, 1]);
    s[list][1] = item;
    assert.deepEqual(kind.dropTargets(s, item, 1), [0]);
  });

  test(`${name}: equip puts the item over what the holder had`, () => {
    const s = state();
    s[list][1] = "x";
    assert.equal(kind.canEquip(s, item), true);
    assert.equal(kind.equip(s, item, 1).ok, true);
    assert.equal(s[list][1], item);
    assert.equal(s[list][0], empty);
  });

  test(`${name}: a drag from the panel equips over what the holder had`, () => {
    const s = state();
    s[list][1] = "x";
    assert.equal(kind.move(s, item, null, 1).ok, true);
    assert.equal(s[list][1], item);
  });

  test(`${name}: a drag from a holder to an empty one moves the item`, () => {
    const s = state();
    s[list][0] = item;
    assert.equal(kind.move(s, item, 0, 1).ok, true);
    assert.deepEqual(s[list], [empty, item]);
  });

  test(`${name}: a drag from a holder to a full one swaps them`, () => {
    const s = state();
    const other = name === "skill" ? "a" : "red-y";
    s[list] = [item, other];
    assert.equal(kind.move(s, item, 0, 1).ok, true);
    assert.deepEqual(s[list], [other, item]);
  });
}

test("the kinds differ only in their rules: one copy of a skill, any number of a mutagen", () => {
  const s = state();
  kinds.skill.equip(s, "r", 0); kinds.skill.equip(s, "r", 1);
  assert.deepEqual(s.slots, [null, "r"]);
  kinds.mutagen.equip(s, "red-x", 0); kinds.mutagen.equip(s, "red-x", 1);
  assert.deepEqual(s.mut, ["red-x", "red-x"]);
});

test("a skill needs a point to be equipped", () => {
  const s = state();
  s.pts = {};
  assert.equal(kinds.skill.canEquip(s, "r"), false);
  assert.equal(kinds.skill.equip(s, "r", 0).ok, false);
  assert.deepEqual(kinds.skill.dropTargets(s, "r"), []);
  assert.deepEqual(s.slots, [null, null]);
});

test("only skills take points from a holder", () => {
  const s = state();
  assert.equal(kinds.skill.canRaise(s, "r"), true);
  kinds.skill.raise(s, "r");
  assert.equal(s.pts.r, 2);
  assert.equal(kinds.mutagen.canRaise(s, "red-x"), false);
});

test("only an empty mutagen holder opens its tab on a click", () => {
  assert.equal(kinds.skill.emptyOpensTab, false);
  assert.equal(kinds.mutagen.emptyOpensTab, true);
});
