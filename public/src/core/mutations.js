// Blood and Wine mutations, by the game's rules (PlayerAbilityManager.ws). Pure: works on a plain
// build object and the catalog (catalog.mutations, from data/mutations.js).
//
// Build data: b.mutations = { on, researched, equipped }:
// - on: mutations are part of the build (the slot panel switches to its mutation layout). Off, the
//   other two are empty.
// - researched: researched mutation ids. Research is all or nothing here: the game lets points go in
//   a bit at a time, but a part-researched mutation does nothing.
// - equipped: the one active mutation ("" for none). Only a researched one.
//
// Research costs skill points (the trees' budget, core/stats.js) and greater mutagens (shown, not
// limited) and needs every mutation in `requires` researched first. Strengthened Synapses' stage is
// how many of the `stages` thresholds the researched count reaches; each stage opens one mutation
// slot, but only while a mutation is equipped (UpdateMutationSkillSlotsLocks). A mutation slot takes
// skills of the equipped mutation's colours (UpdateMutationSkillSlots): mutation slots are the build's
// slots from catalog.slots.base on, like the game's slots 13 to 16.

/** A build's mutations when it has none. */
export const noMutations = () => ({ on: false, researched: [], equipped: "" });

/** A mutation's description with its numbers filled in; a number the planner can't know (null) shows as "?". */
export const mutationText = m => m.text.replace(/\{(\w+)\}/g, (_, k) => m.values[k] == null ? "?" : String(m.values[k]));

const done = { ok: true, msg: "" };
const refuse = msg => ({ ok: false, msg });

/** @param {ReturnType<import("./catalog.js").createCatalog>} catalog */
export function createMutations(catalog) {
  const { mutations, nodes, trees, slots } = catalog;
  const { items, order, stages } = mutations;
  const names = ids => ids.map(id => items[id].name).join(", ");

  const of = b => b.mutations || noMutations();
  const isOn = b => of(b).on;
  const isResearched = (b, id) => of(b).researched.includes(id);
  const equipped = b => of(b).equipped || "";
  const researchedCount = b => of(b).researched.length;

  /** Every mutation `id` needs, in any order. */
  const requirementsMet = (b, id) => items[id].requires.every(r => isResearched(b, r));

  /** Researched mutations that need `id`, directly or through others. */
  function dependants(b, id) {
    const out = new Set();
    const visit = x => order.forEach(m => {
      if (!out.has(m) && isResearched(b, m) && items[m].requires.includes(x)) { out.add(m); visit(m); }
    });
    visit(id);
    return order.filter(m => out.has(m));
  }

  /** Strengthened Synapses' stage: how many thresholds the researched count reaches. */
  const stage = b => stages.filter(n => researchedCount(b) >= n).length;
  /** Mutation slots open: one per stage, while a mutation is equipped. */
  const openSlots = b => equipped(b) ? stage(b) : 0;
  /** Researched mutations the next stage needs, or null at the last stage. */
  const nextStage = b => stage(b) < stages.length ? stages[stage(b)] : null;

  /** Skill colours the mutation slots take: the equipped mutation's. */
  const colors = b => equipped(b) ? items[equipped(b)].colors : [];

  // Mutation slot i (an index into b.slots) and its place among the mutation slots.
  const isMutationSlot = i => i >= slots.base && i < slots.total;
  const slotRank = i => i - slots.base;
  const slotOpen = (b, i) => isMutationSlot(i) && slotRank(i) < openSlots(b);
  const skillFits = (b, id) => colors(b).includes(trees[nodes[id].tree].mutagen);

  /** Why skill `id` can't go into slot i ("" when it can, or when i isn't a mutation slot). */
  function slotRefusal(b, i, id) {
    if (!isMutationSlot(i)) return "";
    if (!slotOpen(b, i)) return equipped(b) ? `Unlocks at ${stages[slotRank(i)]} researched mutations.` : "Activate a mutation to use this slot.";
    if (id && !skillFits(b, id)) return `This slot only takes ${allowedTrees(b)} abilities.`;
    return "";
  }
  const allowedTrees = b => catalog.order.filter(t => colors(b).includes(trees[t].mutagen)).map(t => trees[t].name).join(" and ");

  /** Takes skills out of mutation slots that are closed or don't take their colour. */
  function fitSlots(b) {
    b.slots = b.slots.map((id, i) => id && isMutationSlot(i) && slotRefusal(b, i, id) ? null : id);
  }

  /** Total cost of the researched mutations: { points, red, green, blue }. */
  function cost(b) {
    const total = { points: 0, red: 0, green: 0, blue: 0 };
    of(b).researched.forEach(id => Object.keys(total).forEach(k => { total[k] += items[id].cost[k] || 0; }));
    return total;
  }

  // State changes. Each returns { ok, msg }.

  /** Turns mutations on (an empty set) or off (research, the active mutation and mutation slots cleared). */
  function setOn(b, on) {
    b.mutations = on ? { ...noMutations(), on: true } : noMutations();
    fitSlots(b);
    return done;
  }

  const canResearch = (b, id) => isOn(b) && !isResearched(b, id) && requirementsMet(b, id);

  function research(b, id) {
    if (!isOn(b)) return refuse("Add mutations to the build first.");
    if (isResearched(b, id)) return refuse(`${items[id].name} is already researched.`);
    const missing = items[id].requires.filter(r => !isResearched(b, r));
    if (missing.length) return refuse(`Research ${names(missing)} first.`);
    of(b).researched = order.filter(m => m === id || isResearched(b, m));
    fitSlots(b);
    return done;
  }

  /**
   * Unresearches `id`. Mutations that need it block it, unless `cascade` takes them out too. An
   * unresearched active mutation is deactivated. `removed` lists what was unresearched.
   */
  function unresearch(b, id, { cascade = false } = {}) {
    if (!isResearched(b, id)) return { ...refuse(""), removed: [] };
    const deps = dependants(b, id);
    if (deps.length && !cascade) return { ...refuse(`Can't remove ${items[id].name}: ${names(deps)} need${deps.length === 1 ? "s" : ""} it. Remove those first.`), removed: [] };
    const removed = [id, ...deps];
    const m = of(b);
    m.researched = m.researched.filter(x => !removed.includes(x));
    if (removed.includes(m.equipped)) m.equipped = "";
    fitSlots(b);
    return { ...done, removed };
  }

  // The mutations a cascade would take with the next step back on `id` (the active one only deactivates).
  const cascadeOf = (b, id) => isResearched(b, id) && equipped(b) !== id ? dependants(b, id) : [];

  function equip(b, id) {
    if (!isResearched(b, id)) return refuse(`Research ${items[id].name} first.`);
    of(b).equipped = id;
    fitSlots(b);
    return done;
  }

  function unequip(b) {
    if (!equipped(b)) return refuse("");
    of(b).equipped = "";
    fitSlots(b);
    return done;
  }

  /**
   * Mutations from saved or shared data: unknown ids dropped, research kept only where its
   * requirements are (so a broken chain loses what hangs off it), the active one only if researched.
   */
  function normalize(m) {
    if (!m || typeof m !== "object" || !m.on) return noMutations();
    const wanted = new Set(Array.isArray(m.researched) ? m.researched.filter(id => Object.hasOwn(items, id)) : []);
    const researched = [];
    // Requirements come before the mutations that need them in no fixed order: repeat until stable.
    let grew = true;
    while (grew) {
      grew = false;
      order.forEach(id => {
        if (wanted.has(id) && !researched.includes(id) && items[id].requires.every(r => researched.includes(r))) { researched.push(id); grew = true; }
      });
    }
    const keep = order.filter(id => researched.includes(id));
    return { on: true, researched: keep, equipped: keep.includes(m.equipped) ? m.equipped : "" };
  }

  return {
    isOn, isResearched, equipped, researchedCount, requirementsMet, dependants, stage, openSlots, nextStage,
    colors, isMutationSlot, slotOpen, skillFits, slotRefusal, fitSlots, cost,
    setOn, canResearch, research, unresearch, cascadeOf, equip, unequip, normalize
  };
}
