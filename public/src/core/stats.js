// What a build adds up to, for the Statistics panel (ui/statistics.js): the points, then per tree
// its spent points, passive bonus, the mutagens of its colour with their bonus, and its slotted
// skills. Pure: works on a plain build object { pts, slots, mut, budget } and the catalog.
// Skill effects are not in yet (docs/roadmap.md, "Statistics panel, second pass").

/**
 * @typedef {{ id: string, name: string, rank: number }} SkillRank
 * @typedef {{ group: number, id: string, name: string, matches: number, value: number, label: string, unit: string }} MutagenBonus
 * @typedef {{ id: string, name: string, spent: number, passive: { label: string, value: number, unit: string },
 *   mutagen: string | null, mutagens: MutagenBonus[], slotted: SkillRank[] }} TreeStats
 *   mutagen: the colour this tree's skills match, null if none.
 */

/**
 * @param {ReturnType<import("./catalog.js").createCatalog>} catalog
 * @param {ReturnType<import("./planner.js").createPlanner>} planner
 */
export function createStats(catalog, planner) {
  const { nodes, order, trees, mutagens, slots } = catalog;
  const skillRank = (b, id) => ({ id, name: nodes[id].name, rank: planner.rank(b, id) });

  /** Points: the budget, how many are spent and how many are left (negative when overspent). */
  function points(b) {
    const spent = planner.spentAll(b);
    return { total: b.budget, spent, left: b.budget - spent };
  }

  /** Skills with points that sit in no slot, in tree order. Allowed, but often a mistake. */
  function unslotted(b) {
    return order.flatMap(t => catalog.skillsIn(t))
      .filter(n => planner.rank(b, n.id) > 0 && !planner.isSlotted(b, n.id))
      .map(n => skillRank(b, n.id));
  }

  /** @returns {TreeStats} */
  function tree(b, t) {
    const T = trees[t];
    const groups = [];
    for (let g = 0; g < slots.groups; g++) {
      const bonus = planner.groupBonus(b, g);
      if (!bonus.mutagen || bonus.color !== T.mutagen) continue;
      const m = mutagens[bonus.mutagen];
      groups.push({ group: g, id: m.id, name: m.name, matches: bonus.matches, value: bonus.value, label: m.stat.label, unit: m.stat.unit });
    }
    return {
      id: t, name: T.name, spent: planner.spentIn(b, t),
      passive: { label: T.passive.label, value: planner.passiveValue(b, t), unit: T.passive.unit },
      mutagen: T.mutagen || null,
      mutagens: groups,
      slotted: b.slots.filter(id => id && nodes[id] && nodes[id].tree === t).map(id => skillRank(b, id))
    };
  }

  /** Everything the Statistics panel shows. */
  function summary(b) {
    return { points: points(b), unslotted: unslotted(b), trees: order.map(t => tree(b, t)) };
  }

  return { points, unslotted, tree, summary };
}
