import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";
import { createPlanner } from "../public/src/core/planner.js";
import { createMutations, noMutations } from "../public/src/core/mutations.js";
import { createSlotKinds } from "../public/src/core/slotKinds.js";
import { createStats } from "../public/src/core/stats.js";
import { encodeBuildCode, decodeBuildCode, applyBuildData } from "../public/src/core/build.js";

const cat = createCatalog(data);
const planner = createPlanner(cat);
const muts = createMutations(cat);
const { base } = cat.slots;
// A build with mutations on and these researched (requirements included by the caller).
const build = (researched = [], equipped = "") => ({
  pts: {}, slots: Array(cat.slots.total).fill(null), mut: Array(cat.slots.groups).fill(""),
  budget: 200, progress: cat.budget.normalize(null, 200), name: "",
  mutations: { on: true, researched: inOrder(researched), equipped }
});
// Mutation ids by name, so tests read like the game.
const id = name => cat.mutations.order.find(m => cat.mutations.items[m].name === name);
// Research is kept in the game's order (data/mutations.js).
const inOrder = ids => [...ids].sort((x, y) => cat.mutations.order.indexOf(x) - cat.mutations.order.indexOf(y));
const DC = id("Deadly Counter"), BB = id("Bloodbath"), MS = id("Magic Sensibilities"), PC = id("Piercing Cold"),
  AR = id("Adrenaline Rush"), SL = id("Second Life"), TB = id("Toxic Blood"), EU = id("Euphoria");

test("game data: 12 mutations, 4 slot stages, colours from the research cost", () => {
  assert.deepEqual(cat.problems, []);
  assert.equal(cat.mutations.order.length, 12);
  assert.deepEqual(cat.mutations.stages, [2, 4, 8, 12]);
  assert.deepEqual([cat.slots.base, cat.slots.mutation, cat.slots.total], [12, 4, 16]);
  assert.deepEqual(cat.mutations.items[AR].colors, ["red", "blue"]);
  assert.deepEqual(cat.mutations.items[AR].requires.sort(), [BB, PC].sort());
});

test("research needs every requirement, and mutations on", () => {
  const b = build();
  assert.equal(muts.research(b, BB).ok, false);
  assert.match(muts.research(b, BB).msg, /Deadly Counter/);
  assert.equal(muts.research(b, DC).ok, true);
  assert.equal(muts.research(b, BB).ok, true);
  assert.equal(muts.canResearch(b, AR), false);
  muts.research(b, MS); muts.research(b, PC);
  assert.equal(muts.canResearch(b, AR), true);
  const off = { ...build(), mutations: noMutations() };
  assert.equal(muts.research(off, DC).ok, false);
});

test("research costs skill points, counted as spent, and greater mutagens", () => {
  const stats = createStats(cat, planner, null, muts);
  const b = build([DC, BB]);
  assert.deepEqual(muts.cost(b), { points: 5, red: 5, green: 0, blue: 0 });
  assert.equal(stats.points(b).spent, 5);
  assert.deepEqual(stats.mutationCost(b), { researched: 2, points: 5, red: 5, green: 0, blue: 0 });
  assert.equal(stats.mutationCost(build()), null);
});

test("Strengthened Synapses: a stage per threshold, slots open only with a mutation active", () => {
  const b = build([DC, BB, MS]);
  assert.equal(muts.stage(b), 1);
  assert.equal(muts.openSlots(b), 0);
  muts.equip(b, BB);
  assert.equal(muts.openSlots(b), 1);
  assert.equal(muts.slotOpen(b, base), true);
  assert.equal(muts.slotOpen(b, base + 1), false);
  assert.match(muts.slotRefusal(b, base + 1, "c_mm"), /Unlocks at 4 researched mutations/);
});

test("mutation slots take only the active mutation's colours; General never fits", () => {
  const b = build([DC, BB], BB);
  b.pts = { c_mm: 1, s_aard: 1 };
  const general = Object.values(cat.nodes).find(n => n.tree === "general").id;
  assert.equal(muts.slotRefusal(b, base, Object.values(cat.nodes).find(n => n.tree === "combat").id), "");
  assert.match(muts.slotRefusal(b, base, Object.values(cat.nodes).find(n => n.tree === "signs").id), /only takes Combat abilities/);
  assert.notEqual(muts.slotRefusal(b, base, general), "");
});

test("switching or deactivating the mutation takes out skills that no longer fit", () => {
  const combat = Object.values(cat.nodes).find(n => n.tree === "combat").id;
  const b = build([DC, BB, MS, PC], BB);
  b.pts = { [combat]: 1 };
  b.slots[base] = combat;
  muts.equip(b, PC);
  assert.equal(b.slots[base], null);
  muts.equip(b, BB);
  b.slots[base] = combat;
  assert.equal(muts.equip(b, AR).ok, false); // not researched: refused, nothing changes
  assert.equal(b.slots[base], combat);
  muts.unequip(b);
  assert.equal(b.slots[base], null);
});

test("unresearching: blocked by dependants, or with cascade removes them and deactivates", () => {
  const b = build([DC, BB, MS, PC, AR, SL], AR);
  const blocked = muts.unresearch(b, BB);
  assert.equal(blocked.ok, false);
  assert.match(blocked.msg, /Adrenaline Rush, Second Life/);
  const r = muts.unresearch(b, BB, { cascade: true });
  assert.deepEqual(r.removed, [BB, ...inOrder([AR, SL])]);
  assert.deepEqual(b.mutations.researched, inOrder([DC, MS, PC]));
  assert.equal(b.mutations.equipped, "");
});

test("turning mutations off clears research, the active one and the mutation slots", () => {
  const combat = Object.values(cat.nodes).find(n => n.tree === "combat").id;
  const b = build([DC, BB], BB);
  b.pts = { [combat]: 1 }; b.slots[base] = combat;
  muts.setOn(b, false);
  assert.deepEqual(b.mutations, noMutations());
  assert.equal(b.slots[base], null);
});

test("normalize drops unknown ids, research without its requirements and an unresearched active one", () => {
  assert.deepEqual(muts.normalize({ on: true, researched: [BB, "nope", TB, EU], equipped: BB }),
    { on: true, researched: inOrder([TB, EU]), equipped: "" });
  assert.deepEqual(muts.normalize(null), noMutations());
  assert.deepEqual(muts.normalize({ on: false, researched: [DC] }), noMutations());
});

test("build codes carry mutations; codes without them load with none and 16 slots", () => {
  const combat = Object.values(cat.nodes).find(n => n.tree === "combat").id;
  const a = build([DC, BB], BB);
  a.pts = { [combat]: 1 }; a.slots[base] = combat;
  const s = build();
  applyBuildData(cat, s, decodeBuildCode(encodeBuildCode(a)));
  assert.deepEqual(s.mutations, a.mutations);
  assert.equal(s.slots[base], combat);
  const old = build();
  applyBuildData(cat, old, decodeBuildCode("W3R1." + btoa(JSON.stringify({ p: { [combat]: 1 }, s: [combat, ...Array(11).fill(null)], m: ["", "", "", ""], b: 4 }))));
  assert.deepEqual(old.mutations, noMutations());
  assert.equal(old.slots.length, 16);
  assert.equal(old.slots[0], combat);
});

test("slot kinds: a mutation slot refuses skills while closed or of the wrong colour", () => {
  const kinds = createSlotKinds(cat, planner, { mutations: muts });
  const combat = Object.values(cat.nodes).find(n => n.tree === "combat" && n.root).id;
  const signs = Object.values(cat.nodes).find(n => n.tree === "signs" && n.root).id;
  const b = { ...build([DC, BB]), tab: "combat", sel: null, selSlot: null, selMut: null, selGroup: null };
  b.pts = { [combat]: 1, [signs]: 1 };
  assert.equal(kinds.skill.equip(b, combat, base).ok, false);
  muts.equip(b, BB);
  assert.equal(kinds.skill.equip(b, signs, base).ok, false);
  assert.equal(kinds.skill.equip(b, combat, base).ok, true);
  assert.ok(!kinds.skill.dropTargets(b, signs).includes(base));
  assert.ok(kinds.skill.dropTargets(b, signs).includes(0));
});

test("planner: removing a needed last point is refused, or with cascade takes what hangs off it", () => {
  const tree = cat.skillsIn("combat"), root = tree.find(n => n.root);
  const child = tree.find(n => n.from.includes(root.id));
  const b = build();
  b.pts = { [root.id]: 1, [child.id]: 1 };
  b.slots[0] = child.id;
  assert.equal(planner.removePoint(b, root.id).ok, false);
  const r = planner.removePoint(b, root.id, { cascade: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.removed.sort(), [root.id, child.id].sort());
  assert.deepEqual(b.pts, {});
  assert.equal(b.slots[0], null);
});

test("cascade preview: what the next removal would take with it", () => {
  const tree = cat.skillsIn("combat"), root = tree.find(n => n.root);
  const child = tree.find(n => n.from.includes(root.id));
  const b = build([DC, BB, MS, PC, AR, SL], AR);
  b.pts = { [root.id]: 2, [child.id]: 1 };
  assert.deepEqual(planner.cascadeOf(b, root.id), []); // a point to spare: nothing goes
  b.pts[root.id] = 1;
  assert.deepEqual(planner.cascadeOf(b, root.id), [child.id]);
  assert.deepEqual(muts.cascadeOf(b, BB), inOrder([AR, SL]));
  assert.deepEqual(muts.cascadeOf(b, AR), []); // the active one only deactivates
});
