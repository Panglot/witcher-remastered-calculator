// Turns the raw game data (data/index.js) into lookups the planner and UI use.
// Pure: no DOM, no storage. Data mistakes are collected in `problems` instead of thrown,
// so the page still loads and tests can assert the list is empty.
import { createBudget } from "./budget.js";

/**
 * @typedef {Object} Skill
 * @property {string} id
 * @property {string} name
 * @property {string} game      The game's skill id, e.g. "sword_s22" (names its icon).
 * @property {number} col       The game's gridColumn, in thirds of a skill step.
 * @property {number} row       The game's gridRow, in thirds of a skill step.
 * @property {boolean} midLines Lines end at the skill's vertical middle, not its edge.
 * @property {string|string[]} text  Tooltip template, or one per rank (data/skillText.js, core/skillText.js).
 * @property {Record<string, (number|null)[]>} values  Numbers per placeholder, one per rank.
 * @property {Record<string, number>} missing  Numbers for the ranks where `values` has null and the text says them in words.
 * @property {string[]} dynamic  Values that depend on the character (the base character is used).
 * @property {boolean} root      Open without a connected point.
 * @property {boolean} verified  Text checked in-game.
 * @property {string} note
 * @property {string} tree       Id of the tree it belongs to.
 * @property {string[]} from     Ids of the skills whose point opens this one.
 * @property {string[]} to       Ids of the skills a point in this one opens.
 */

/**
 * @typedef {Object} Mutagen  See data/mutagens.js.
 * @property {string} id
 * @property {string} name
 * @property {string} color     Matches the trees' `mutagen` colour.
 * @property {string} size
 * @property {number} value     Bonus of the mutagen alone.
 * @property {number} col       Cell in the Mutagens tab grid.
 * @property {number} row
 * @property {string} type      Tooltip item type ("Alchemy ingredient").
 * @property {string} rarity    Tooltip rarity line ("Common item").
 * @property {{ label: string, unit: string }} stat
 */

// The Mutagens tab follows the tree tabs.
export const MUTAGEN_TAB = "mutagens";

/**
 * @param {{ rules: object, trees: Record<string, object>, skillSets: object[], mutagens?: object,
 *   skillText?: Record<string, object>, totals?: object }} data  skillText: extracted text by game id
 *   (data/skillText.js). totals: what adds up to the build-wide totals (data/totals.js).
 */
export function createCatalog(data) {
  const { rules, trees, skillSets } = data;
  const mutagenData = Object.assign({ stats: {}, items: [], aliases: {}, item: {} }, data.mutagens);
  const problems = [];
  /** @type {Record<string, Skill>} */
  const nodes = {};
  /** One-way links [from, to]: a point in `from` opens `to`. @type {[string, string][]} */
  const edges = [];

  /** A skill's extracted text and numbers, checked against the tree data. */
  function textOf(s, t) {
    if (!data.skillText) return {};
    const x = data.skillText[s.game];
    if (!x) { problems.push(`Skill "${s.id}" in ${t} has no text in data/skillText.js (game id "${s.game}").`); return {}; }
    if (x.name !== s.name) problems.push(`Skill "${s.id}" is named "${s.name}", the game calls it "${x.name}".`);
    if (x.maxRank !== rules.maxRank) problems.push(`Skill "${s.id}" has ${x.maxRank} ranks in the game, not ${rules.maxRank}.`);
    const { text, values = {}, missing = {}, dynamic = [] } = x;
    return { text, values, missing, dynamic };
  }

  const order = rules.treeOrder.filter(t => {
    if (trees[t]) return true;
    problems.push(`Tree "${t}" is listed in rules.treeOrder but isn't registered in data/index.js.`);
    return false;
  });

  order.forEach(t => trees[t].skills.forEach(s => {
    if (nodes[s.id]) problems.push(`Duplicate skill id "${s.id}" in ${t} (already used in ${nodes[s.id].tree}).`);
    nodes[s.id] = Object.assign({ root: false, verified: false, midLines: false, note: "", text: "", values: {}, missing: {}, dynamic: [] },
      textOf(s, t), s, { tree: t, from: [], to: [] });
  }));

  order.forEach(t => trees[t].links.forEach(link => {
    const [a, b] = link.split("-");
    if (!nodes[a] || !nodes[b]) { problems.push(`Link "${link}" in ${t} points to an unknown skill.`); return; }
    if (nodes[a].tree !== t || nodes[b].tree !== t) { problems.push(`Link "${link}" in ${t} crosses into another tree.`); return; }
    edges.push([a, b]);
    nodes[a].to.push(b); nodes[b].from.push(a);
  }));

  skillSets.forEach(a => a.ids.forEach(id => {
    if (!nodes[id]) problems.push(`Skill set "${a.id}" lists unknown skill "${id}".`);
  }));

  /** @type {Record<string, Mutagen>} */
  const mutagens = {};
  mutagenData.items.forEach(m => {
    if (Object.hasOwn(mutagens, m.id)) problems.push(`Duplicate mutagen id "${m.id}".`);
    if (!Object.hasOwn(mutagenData.stats, m.color)) problems.push(`Mutagen "${m.id}" has colour "${m.color}", which has no entry in mutagens.stats.`);
    mutagens[m.id] = Object.assign({ type: "", rarity: "" }, mutagenData.item, m, { stat: mutagenData.stats[m.color] });
  });
  const aliases = mutagenData.aliases;
  /** A stored mutagen as a current id: aliases resolved, "" for none or unknown. */
  const mutagenId = x => Object.hasOwn(mutagens, x) ? x
    : Object.hasOwn(aliases, x) && Object.hasOwn(mutagens, aliases[x]) ? aliases[x] : "";

  const totals = Object.assign({ synergy: null, stats: [] }, data.totals);
  /** A skill number a total reads: the skill exists and has that number. */
  const checkSkillNumber = (src, where) => {
    if (!nodes[src.skill]) problems.push(`${where} reads unknown skill "${src.skill}".`);
    else if (!Object.hasOwn(nodes[src.skill].values, src.value)) problems.push(`${where} reads "${src.value}", which skill "${src.skill}" has no number for.`);
  };
  if (totals.synergy) checkSkillNumber(totals.synergy, "Totals synergy");
  totals.stats.forEach(st => st.sources.forEach(src => {
    const where = `Total "${st.id}"`;
    if (src.skill) {
      checkSkillNumber(src, where);
      // Armor is a condition: it counts only towards the "up to".
      if (src.armor && !src.when) problems.push(`${where} reads "${src.skill}", which needs armor but has no "when".`);
    }
    else if (src.mutagen) { if (!Object.hasOwn(mutagenData.stats, src.mutagen)) problems.push(`${where} reads unknown mutagen colour "${src.mutagen}".`); }
    else if (src.passive) { if (!order.includes(src.passive)) problems.push(`${where} reads the passive of unknown tree "${src.passive}".`); }
    else problems.push(`${where} has a source with no skill, mutagen or passive.`);
  }));

  const slots = { groups: rules.slotGroups, perGroup: rules.slotsPerGroup, total: rules.slotGroups * rules.slotsPerGroup };

  return {
    rules, trees, skillSets, order, nodes, edges, slots, problems,
    maxRank: rules.maxRank,
    mutagens, mutagenId, totals,
    // The points budget (core/budget.js). Test data without rules.points: level 1 and nothing else.
    budget: createBudget(rules.points || { maxLevel: 1, placesOfPower: 0, items: [] }),
    // Planner tabs: the trees, then the mutagen inventory.
    tabs: order.concat(MUTAGEN_TAB),
    /** @param {string} tree */
    skillsIn: tree => Object.values(nodes).filter(n => n.tree === tree)
  };
}
