// Skill set queries for the highlight (ui/tree.js) and the tooltip (ui/tooltip.js). Sets are the
// catalog's (core/catalog.js): { id, name, tree, ids, role }.

/**
 * The skills to highlight for the selected sets: those in any of them, or with `all` only those in
 * every one of them.
 * @param {{ skillSets: { id: string, ids: string[] }[] }} catalog
 * @param {string[]} selected set ids
 * @param {boolean} all
 * @returns {Set<string>}
 */
export function highlightedSkills(catalog, selected, all) {
  const lists = selected.map(id => catalog.skillSets.find(s => s.id === id)).filter(Boolean).map(s => s.ids);
  if (!lists.length) return new Set();
  if (!all) return new Set(lists.flat());
  return new Set(lists[0].filter(id => lists.every(l => l.includes(id))));
}

/**
 * The sets a skill is in, as "Name" or "Name (role)": the selected ones, or with `always` every one.
 * @param {{ skillSets: { id: string, name: string, ids: string[], role: Record<string, string> }[] }} catalog
 * @param {string} skillId
 * @param {string[]} selected set ids
 * @param {boolean} always
 * @returns {string[]}
 */
export function setLabels(catalog, skillId, selected, always) {
  return catalog.skillSets
    .filter(s => s.ids.includes(skillId) && (always || selected.includes(s.id)))
    .map(s => s.role[skillId] ? `${s.name} (${s.role[skillId]})` : s.name);
}
