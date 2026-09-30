// Skill-tree rules: unlocking, ranks, slots and mutagen bonuses.
// Pure: every function works on a plain build object { pts, slots, mut } and the catalog.
// Actions mutate the build and return { ok, msg }; msg explains a refusal and is "" on success.

const done = { ok: true, msg: "" };
const refuse = msg => ({ ok: false, msg });

/** @param {ReturnType<import("./catalog.js").createCatalog>} catalog */
export function createPlanner(catalog) {
  const { nodes, maxRank, order, slots, trees } = catalog;

  const rank = (b, id) => b.pts[id] || 0;
  const isOpen = (b, id) => nodes[id].root || nodes[id].nb.some(n => rank(b, n) > 0);
  const isSlotted = (b, id) => b.slots.includes(id);
  const spentIn = (b, tree) => Object.keys(b.pts).reduce((s, id) => s + (nodes[id] && nodes[id].tree === tree ? b.pts[id] : 0), 0);
  const spentAll = b => order.reduce((s, t) => s + spentIn(b, t), 0);

  // Skills that would lose every path to a root if `id` lost its last point.
  function strandedIfRemoved(b, id) {
    const t = nodes[id].tree;
    const invested = Object.keys(b.pts).filter(k => k !== id && rank(b, k) > 0 && nodes[k].tree === t);
    const pool = new Set(invested), reached = new Set();
    const queue = invested.filter(k => nodes[k].root);
    queue.forEach(k => reached.add(k));
    while (queue.length) {
      const k = queue.shift();
      nodes[k].nb.forEach(n => { if (pool.has(n) && !reached.has(n)) { reached.add(n); queue.push(n); } });
    }
    return invested.filter(k => !reached.has(k));
  }

  function addPoint(b, id) {
    if (rank(b, id) >= maxRank) return refuse(`${nodes[id].name} is already at rank ${maxRank}.`);
    if (!isOpen(b, id)) return refuse(`Locked. Put a point in a connected skill first: ${nodes[id].nb.map(n => nodes[n].name).join(", ")}.`);
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

  function canPlace(b, id) {
    return !!id && !!nodes[id] && rank(b, id) > 0 && !isSlotted(b, id);
  }

  function placeInSlot(b, index, id) {
    if (!canPlace(b, id)) return refuse("Select a skill with at least one point, then click an empty slot.");
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

  function clearAll(b) {
    b.pts = {};
    b.slots = Array(slots.total).fill(null);
    return done;
  }

  // Slot ids of one group, in order (null for empty slots).
  const groupSlots = (b, g) => b.slots.slice(g * slots.perGroup, (g + 1) * slots.perGroup);

  // Mutagen bonus for a group: one extra copy per slotted skill whose tree matches the mutagen colour.
  function groupBonus(b, g) {
    const mutagen = b.mut[g] || "";
    const matches = mutagen ? groupSlots(b, g).filter(id => id && trees[nodes[id].tree].mutagen === mutagen).length : 0;
    return { mutagen, matches, multiplier: mutagen ? 1 + matches : 0 };
  }

  // Passive bonus a tree grants for the points spent in it.
  function passiveValue(b, tree) {
    return Math.round(spentIn(b, tree) * trees[tree].passive.per * 10) / 10;
  }

  const unslotted = b => Object.keys(b.pts).filter(id => rank(b, id) > 0 && !isSlotted(b, id));

  return {
    rank, isOpen, isSlotted, spentIn, spentAll, strandedIfRemoved,
    addPoint, removePoint, toggleSlot, canPlace, placeInSlot, clearSlot, clearTree, clearAll,
    groupSlots, groupBonus, passiveValue, unslotted
  };
}
