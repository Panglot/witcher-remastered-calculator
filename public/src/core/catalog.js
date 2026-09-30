// Turns the raw game data (data/index.js) into lookups the planner and UI use.
// Pure: no DOM, no storage. Data mistakes are collected in `problems` instead of thrown,
// so the page still loads and tests can assert the list is empty.

/**
 * @typedef {Object} Skill
 * @property {string} id
 * @property {string} name
 * @property {number} col
 * @property {number} row
 * @property {string} text
 * @property {boolean} root      Open without a connected point.
 * @property {boolean} verified  Text checked in-game.
 * @property {string} note
 * @property {string} tree       Id of the tree it belongs to.
 * @property {string[]} nb       Ids of connected skills.
 */

/**
 * @param {{ rules: object, trees: Record<string, object>, archetypes: object[] }} data
 */
export function createCatalog(data) {
  const { rules, trees, archetypes } = data;
  const problems = [];
  /** @type {Record<string, Skill>} */
  const nodes = {};
  /** @type {[string, string][]} */
  const edges = [];

  const order = rules.treeOrder.filter(t => {
    if (trees[t]) return true;
    problems.push(`Tree "${t}" is listed in rules.treeOrder but isn't registered in data/index.js.`);
    return false;
  });

  order.forEach(t => trees[t].skills.forEach(s => {
    if (nodes[s.id]) problems.push(`Duplicate skill id "${s.id}" in ${t} (already used in ${nodes[s.id].tree}).`);
    nodes[s.id] = Object.assign({ root: false, verified: false, note: "" }, s, { tree: t, nb: [] });
  }));

  order.forEach(t => trees[t].links.forEach(link => {
    const [a, b] = link.split("-");
    if (!nodes[a] || !nodes[b]) { problems.push(`Link "${link}" in ${t} points to an unknown skill.`); return; }
    if (nodes[a].tree !== t || nodes[b].tree !== t) { problems.push(`Link "${link}" in ${t} crosses into another tree.`); return; }
    edges.push([a, b]);
    nodes[a].nb.push(b); nodes[b].nb.push(a);
  }));

  archetypes.forEach(a => a.ids.forEach(id => {
    if (!nodes[id]) problems.push(`Archetype "${a.id}" lists unknown skill "${id}".`);
  }));

  const slots = { groups: rules.slotGroups, perGroup: rules.slotsPerGroup, total: rules.slotGroups * rules.slotsPerGroup };

  return {
    rules, trees, archetypes, order, nodes, edges, slots, problems,
    maxRank: rules.maxRank,
    mutagens: rules.mutagens,
    /** @param {string} tree */
    skillsIn: tree => Object.values(nodes).filter(n => n.tree === tree)
  };
}
