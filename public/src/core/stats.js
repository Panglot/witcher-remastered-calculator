// What a build adds up to, for the Statistics panel (ui/statistics.js): the points, the build-wide
// totals (data/totals.js) and per tree its spent points and passive bonus. Pure: works on a plain
// build object { pts, slots, mut, budget } and the catalog.
/**
 * @typedef {{ id: string, name: string, count: number, matches: number }} MutagenKind
 *   count: how many of this mutagen are equipped; matches: their matching skills added up.
 * @typedef {{ label: string, unit: string, value: number, synergy: number, kinds: MutagenKind[] }} MutagenBonus
 *   value: the bonus of every equipped mutagen of the colour added up, before Synergy; synergy:
 *   what Synergy adds to it (planner.groupBonus); kinds in slot group order.
 * @typedef {{ id: string, name: string, spent: number, passive: { label: string, value: number, unit: string } }} TreeStats
 * @typedef {{ type: "mutagen" | "synergy" | "passive" | "skill", name: string, value: number, when: string, counted: boolean }} TotalPart
 *   when: the condition it needs, "" when it always applies. counted: false for a skill that needs
 *   another armor type than the one that gives the most.
 * @typedef {{ id: string, label: string, unit: string, color: string, value: number, max: number, parts: TotalPart[] }} Total
 *   value: what always applies; max: with every condition met (the same when nothing is conditional).
 *   parts: the ones that always apply first.
 * @typedef {{ total: number, spent: number, skills: number, mutations: number, slots: number, left: number, bySlots: boolean }} Points
 *   spent: on skills and mutation research, split into skills and mutations; slots: the total the slots in use need to be open (0
 *   without locks), counted in left only with locking on; left: points left to spend, negative for
 *   the points needed; bySlots: the slots, not the skills, set what is needed.
 * @typedef {{ researched: number, points: number, red: number, green: number, blue: number }} MutationCost
 *   what the researched mutations cost: skill points and greater mutagens per colour.
 */
import { LOCK_NONE } from "./slotLocks.js";

/**
 * @param {ReturnType<import("./catalog.js").createCatalog>} catalog
 * @param {ReturnType<import("./planner.js").createPlanner>} planner
 * @param {ReturnType<import("./slotLocks.js").createSlotLocks>} [locks]  without them slots need nothing
 * @param {ReturnType<import("./mutations.js").createMutations>} [mutations]  without it research costs nothing
 */
export function createStats(catalog, planner, locks = null, mutations = null) {
  const { nodes, order, trees, mutagens, slots, totals: totalsData } = catalog;
  const round = v => Math.round(v * 10) / 10;

  /**
   * Points: the budget, how many are spent and how many are left. With locks (`mode`, settings.js
   * slotLocking) a slot in use that the budget doesn't open needs points too: what is needed is
   * the larger of the two, so a slot that opens at 45 with 40 spent and a total of 0 needs 45.
   * Without locking the slots' need is still reported (slots), for the tooltip, but not counted.
   * @returns {Points}
   */
  function points(b, mode = LOCK_NONE) {
    const skills = planner.spentAll(b), research = mutations ? mutations.cost(b).points : 0;
    const spent = skills + research, total = b.budget;
    const slots = locks ? locks.required(b) : 0;
    const short = mode !== LOCK_NONE && slots > total;
    return { total, spent, skills, mutations: research, slots, left: short ? total - Math.max(spent, slots) : total - spent, bySlots: short && slots > spent };
  }

  /** @returns {MutagenBonus | null} The equipped mutagens of one colour, summed and grouped by kind. */
  function mutagenBonus(b, color) {
    let total = null;
    for (let g = 0; g < slots.groups; g++) {
      const bonus = planner.groupBonus(b, g);
      if (!bonus.mutagen || bonus.color !== color) continue;
      const m = mutagens[bonus.mutagen];
      total = total || { label: m.stat.label, unit: m.stat.unit, value: 0, synergy: 0, kinds: [] };
      total.value += bonus.base;
      total.synergy = round(total.synergy + bonus.synergy);
      let kind = total.kinds.find(k => k.id === m.id);
      if (!kind) total.kinds.push(kind = { id: m.id, name: m.name, count: 0, matches: 0 });
      kind.count++;
      kind.matches += bonus.matches;
    }
    return total;
  }

  /** @returns {TreeStats} */
  function tree(b, t) {
    const T = trees[t];
    return {
      id: t, name: T.name, spent: planner.spentIn(b, t),
      passive: { label: T.passive.label, value: planner.passiveValue(b, t), unit: T.passive.unit }
    };
  }

  /** The parts of one stat that raise it in this build. */
  function totalParts(b, st) {
    const parts = [];
    for (const src of st.sources) {
      if (src.mutagen) {
        const m = mutagenBonus(b, src.mutagen);
        if (!m) continue;
        parts.push({ type: "mutagen", name: "Mutagens", value: m.value, when: "", counted: true });
        if (m.synergy) parts.push({ type: "synergy", name: nodes[totalsData.synergy.skill].name, value: m.synergy, when: "", counted: true });
      } else if (src.passive) {
        const value = planner.passiveValue(b, src.passive);
        if (value) parts.push({ type: "passive", name: `${trees[src.passive].name} tree`, value, when: "", counted: true });
      } else {
        const value = round(planner.skillNumber(b, src) * (src.times || 1));
        if (value) parts.push({ type: "skill", name: nodes[src.skill].name, value, when: src.when || "", counted: true, armor: src.armor });
      }
    }
    // Geralt wears one armor set: only the armor type that gives the most counts.
    const byArmor = {};
    parts.forEach(p => { if (p.armor) byArmor[p.armor] = (byArmor[p.armor] || 0) + p.value; });
    const best = Object.keys(byArmor).sort((x, y) => byArmor[y] - byArmor[x])[0];
    return parts.map(({ armor, ...p }) => armor && armor !== best ? { ...p, counted: false } : p);
  }

  /**
   * The build-wide totals: each stat of data/totals.js that something other than a tree passive
   * raises in this build, with what makes it up. Conditional parts (armor, Adrenaline, stacks)
   * count only towards `max`. A stat `within` a broader one is left out while it matches it.
   * @returns {Total[]}
   */
  function totals(b) {
    const sum = parts => round(parts.reduce((total, p) => p.counted ? total + p.value : total, 0));
    const listed = totalsData.stats.flatMap(st => {
      const all = totalParts(b, st);
      if (!all.some(p => p.type !== "passive")) return [];
      const always = all.filter(p => !p.when);
      const parts = always.concat(all.filter(p => p.when));
      return [{ id: st.id, label: st.label, unit: st.unit, color: st.color || "", value: sum(always), max: sum(all), parts, within: st.within }];
    });
    const byId = Object.fromEntries(listed.map(t => [t.id, t]));
    const repeats = t => byId[t.within] && byId[t.within].value === t.value && byId[t.within].max === t.max;
    return listed.filter(t => !repeats(t)).map(({ within, ...t }) => t);
  }

  /** @returns {MutationCost | null} What the researched mutations cost; null when none is researched. */
  function mutationCost(b) {
    if (!mutations || !mutations.researchedCount(b)) return null;
    return { researched: mutations.researchedCount(b), ...mutations.cost(b) };
  }

  /** Everything the Statistics panel shows. */
  function summary(b) {
    return { points: points(b), totals: totals(b), trees: order.map(t => tree(b, t)), mutations: mutationCost(b) };
  }

  return { points, mutagenBonus, totals, tree, mutationCost, summary };
}
