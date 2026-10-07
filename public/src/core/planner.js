// Skill-tree rules: unlocking, ranks, slots and mutagen bonuses.
// Pure: every function works on a plain build object { pts, slots, mut } and the catalog.
// `mut` holds one mutagen id per slot group ("" = none); a mutagen can fill any number of groups.
// Actions mutate the build and return { ok, msg }; msg explains a refusal and is "" on success.
// Skills in slots and mutagens in groups have matching actions (canEquip, equip, clear), so
// core/slotKinds.js can treat them alike.
import { rankValues } from "./skillText.js";

const done = { ok: true, msg: "" };
const refuse = msg => ({ ok: false, msg });

/** @param {ReturnType<import("./catalog.js").createCatalog>} catalog */
export function createPlanner(catalog) {
  const { nodes, maxRank, order, slots, trees, mutagens, totals } = catalog;

  const rank = (b, id) => b.pts[id] || 0;
  // A skill opens from a point in a skill that links to it: one way, or both ways in a tree with
  // twoWayLinks (catalog.js fills `from` and `to` for it).
  const isOpen = (b, id) => nodes[id].root || nodes[id].from.some(n => rank(b, n) > 0);
  const isSlotted = (b, id) => b.slots.includes(id);
  const spentIn = (b, tree) => Object.keys(b.pts).reduce((s, id) => s + (nodes[id] && nodes[id].tree === tree ? b.pts[id] : 0), 0);
  const spentAll = b => order.reduce((s, t) => s + spentIn(b, t), 0);

  // Invested skills of a tree reached from an invested root along links, leaving out `skip`.
  function reached(b, tree, skip = "") {
    const pool = new Set(Object.keys(b.pts).filter(k => k !== skip && rank(b, k) > 0 && nodes[k].tree === tree));
    const seen = new Set([...pool].filter(k => nodes[k].root)), queue = [...seen];
    while (queue.length) nodes[queue.shift()].to.forEach(n => { if (pool.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); } });
    return seen;
  }

  // Skills that would lose every path to a root if `id` lost its last point. Skills already cut
  // off (an older build code) don't block the removal.
  function strandedIfRemoved(b, id) {
    const t = nodes[id].tree, before = reached(b, t), after = reached(b, t, id);
    return [...before].filter(k => k !== id && !after.has(k));
  }

  // A point can go in (the game starts its hold fill only then).
  const canAddPoint = (b, id) => rank(b, id) < maxRank && isOpen(b, id);
  // A point can come out: the skill has one, and taking its last leaves no skill cut off.
  const canRemovePoint = (b, id) => rank(b, id) > 1 || (rank(b, id) === 1 && !strandedIfRemoved(b, id).length);

  function addPoint(b, id) {
    if (rank(b, id) >= maxRank) return refuse(`${nodes[id].name} is already at rank ${maxRank}.`);
    if (!isOpen(b, id)) return refuse(`Locked. Put a point in a skill that leads to it first: ${nodes[id].from.map(n => nodes[n].name).join(", ")}.`);
    b.pts[id] = rank(b, id) + 1;
    return done;
  }

  function removePoint(b, id) {
    if (rank(b, id) === 0) return refuse("");
    if (rank(b, id) > 1) { b.pts[id] = rank(b, id) - 1; return done; }
    const stranded = strandedIfRemoved(b, id);
    if (stranded.length) return refuse(`Can't remove the last point: ${stranded.map(k => nodes[k].name).join(", ")} would lose its connection. Remove those first.`);
    delete b.pts[id];
    b.slots = b.slots.map(s => s === id ? null : s);
    return done;
  }

  function toggleSlot(b, id) {
    const at = b.slots.indexOf(id);
    if (at >= 0) { b.slots[at] = null; return done; }
    if (rank(b, id) === 0) return refuse("Put at least one point in a skill before slotting it.");
    const free = b.slots.indexOf(null);
    if (free < 0) return refuse(`All ${slots.total} slots are full. Clear one first.`);
    b.slots[free] = id;
    return done;
  }

  // A skill can go in a slot once it has a point.
  const canEquipSkill = (b, id) => !!id && !!nodes[id] && rank(b, id) > 0;

  // Puts a skill in a slot like the game's apply mode: over any skill already there, and out of
  // the slot it was in, so equipping an equipped skill moves it.
  function equipSkill(b, index, id) {
    if (!canEquipSkill(b, id)) return refuse("Put at least one point in a skill before equipping it.");
    b.slots = b.slots.map(s => s === id ? null : s);
    b.slots[index] = id;
    return done;
  }

  function clearSlot(b, index) {
    b.slots[index] = null;
    return done;
  }

  function clearTree(b, tree) {
    Object.keys(b.pts).forEach(id => { if (nodes[id].tree === tree) delete b.pts[id]; });
    b.slots = b.slots.map(s => s && b.pts[s] ? s : null);
    return done;
  }

  // Full reset: refunds every point and unequips every skill and mutagen.
  function clearAll(b) {
    b.pts = {};
    b.slots = Array(slots.total).fill(null);
    b.mut = Array(slots.groups).fill("");
    return done;
  }

  // Slot ids of one group, in order (null for empty slots).
  const groupSlots = (b, g) => b.slots.slice(g * slots.perGroup, (g + 1) * slots.perGroup);

  // Unlike a skill, a mutagen can fill any number of groups, so equipping one never moves it.
  const canEquipMutagen = (b, id) => !!id && Object.hasOwn(mutagens, id);

  // Puts a mutagen in a group, over any mutagen already there.
  function equipMutagen(b, g, id) {
    if (!canEquipMutagen(b, id)) return refuse(`No mutagen "${id}".`);
    b.mut[g] = id;
    return done;
  }

  function clearMutagen(b, g) {
    b.mut[g] = "";
    return done;
  }

  // Takes a mutagen out of every group holding it.
  function unequipMutagen(b, id) {
    b.mut = b.mut.map(m => m === id ? "" : m);
    return done;
  }

  /** A slotted skill's number at its rank, 0 when the skill isn't slotted or the rank lacks it. */
  function skillNumber(b, { skill, value }) {
    if (!isSlotted(b, skill)) return 0;
    const n = nodes[skill];
    return rankValues(n, rank(b, skill))[value] ?? n.missing[value] ?? 0;
  }

  // Percent the slotted Synergy skill (data/totals.js `synergy`) adds to every mutagen bonus.
  const synergyPercent = b => totals.synergy ? skillNumber(b, totals.synergy) : 0;

  // Mutagen bonus for a group, as the game shows it: the mutagen's value, plus one extra copy per
  // slotted skill whose tree matches its colour (`base`), raised by Synergy (`synergy`).
  // `value` is the total (0 without a mutagen).
  function groupBonus(b, g) {
    const m = mutagens[b.mut[g]];
    const matches = m ? groupSlots(b, g).filter(id => id && trees[nodes[id].tree].mutagen === m.color).length : 0;
    const multiplier = m ? 1 + matches : 0;
    const base = m ? m.value * multiplier : 0;
    // The game rounds the total to the nearest whole number, checked in game: Blue mutagen 7 with
    // Synergy 10% = 7.7, shown as 8; with 2 matching skills 21 + 10% = 23.1, shown as 23.
    const value = Math.round(base * (1 + synergyPercent(b) / 100));
    return { mutagen: m ? m.id : "", color: m ? m.color : "", matches, multiplier, base, synergy: value - base, value };
  }

  // Passive bonus a tree grants for the points spent in it.
  function passiveValue(b, tree) {
    return Math.round(spentIn(b, tree) * trees[tree].passive.per * 10) / 10;
  }

  return {
    rank, isOpen, canAddPoint, canRemovePoint, isSlotted, spentIn, spentAll, strandedIfRemoved,
    addPoint, removePoint, toggleSlot, canEquipSkill, equipSkill, clearSlot, clearTree, clearAll,
    canEquipMutagen, equipMutagen, clearMutagen, unequipMutagen, groupSlots, groupBonus, passiveValue,
    skillNumber, synergyPercent
  };
}
