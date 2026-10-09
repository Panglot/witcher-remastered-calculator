// Skill and mutagen search (ui/search.js): which items a typed query matches. Pure.
// A skill is found by its name, its text at every rank (with the numbers filled in) and the names
// and roles of the skill sets it is in, as its tooltip names them ("Vitality (heals)"); a mutagen
// by its name, the stat it raises and its type. Every word of the query must start a word
// somewhere in an item's text, in any order and case ("red" finds a red mutagen, not every
// "ingredient"; "intens" finds "intensity").
import { rankText } from "./skillText.js";
import { setLabels } from "./skillSets.js";

/**
 * A query as its lowercase words; none for an empty or blank one. Brackets, commas and quotes split
 * words like spaces, so a set label typed with its role ("vitality (heal") finds it.
 */
export const queryWords = query => String(query || "").toLowerCase().split(/[\s()[\]{},;:"']+/).filter(Boolean);

// Matches `word` where a word starts: at the start of the text or after a non-letter, non-digit.
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordStart = word => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(word)}`, "u");

/**
 * @param {{ nodes: Record<string, object>, maxRank: number, mutagens: Record<string, object>,
 *   skillSets: { name: string, ids: string[], role: Record<string, string> }[] }} catalog
 */
export function createSearch(catalog) {
  const { nodes, maxRank, mutagens } = catalog;
  const skillText = n => [
    n.name,
    ...Array.from({ length: maxRank }, (_, r) => rankText(n, r + 1)),
    ...setLabels(catalog, n.id, [], true)
  ];
  const mutagenText = m => [m.name, m.stat.label, m.type];
  // Each item's searchable text, lowercase, by slot kind name (core/slotKinds.js).
  const index = {
    skill: Object.values(nodes).map(n => [n.id, skillText(n).join("\n").toLowerCase()]),
    mutagen: Object.values(mutagens).map(m => [m.id, mutagenText(m).join("\n").toLowerCase()])
  };

  /**
   * The ids each kind has matching `query`; both empty for an empty query. The last answer is
   * kept, as every redraw of the tree and the slots asks again for the same query.
   * @param {string} query
   * @returns {{ skill: Set<string>, mutagen: Set<string> }}
   */
  let last = null;
  function find(query) {
    const words = queryWords(query), key = words.join(" ");
    if (last && last.key === key) return last.found;
    const starts = words.map(wordStart);
    const matching = list => new Set(words.length ? list.filter(([, text]) => starts.every(r => r.test(text))).map(([id]) => id) : []);
    last = { key, found: { skill: matching(index.skill), mutagen: matching(index.mutagen) } };
    return last.found;
  }

  return { find };
}
