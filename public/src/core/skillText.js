// A skill's text and numbers at a rank, from the templates in data/skillText.js. Pure.

/**
 * Numbers at a rank (1-based): { placeholder: number }. Placeholders the rank doesn't use are left out.
 * @param {{ values?: Record<string, (number|null)[]> }} skill
 * @param {number} rank
 */
export function rankValues(skill, rank) {
  const out = {};
  for (const [k, list] of Object.entries(skill.values || {})) {
    const v = list[rank - 1];
    if (v != null) out[k] = v;
  }
  return out;
}

/**
 * The tooltip text at a rank (1-based): the rank's template with its numbers filled in.
 * @param {{ text?: string | string[], values?: Record<string, (number|null)[]> }} skill
 * @param {number} rank
 */
export function rankText(skill, rank) {
  const template = Array.isArray(skill.text) ? skill.text[rank - 1] : skill.text;
  if (template == null) return "";
  const values = rankValues(skill, rank);
  return template.replace(/\{(\w+)\}/g, (m, k) => Object.hasOwn(values, k) ? String(values[k]) : m);
}

const placeholders = template => (template.match(/\{\w+\}/g) || []).length;

/**
 * The text for all ranks at once (the "Modern" skill descriptions): one template with each number
 * as its list of values, one per rank. Returns parts in order: plain strings, and { values } for a
 * number (values[0] is rank 1). A skill worded per rank uses the template with the most numbers,
 * the highest rank on a tie. A rank without the number takes the skill's `missing` value, else 0
 * (the effect is off at that rank, e.g. Aard Sweep's knock-down reduction at rank 3).
 * @param {{ text?: string | string[], values?: Record<string, (number|null)[]>,
 *   missing?: Record<string, number> }} skill
 * @param {number} maxRank
 * @returns {(string | { values: number[] })[]}
 */
export function allRanksParts(skill, maxRank) {
  const templates = Array.isArray(skill.text) ? skill.text : [skill.text ?? ""];
  const template = templates.reduce((best, t) => placeholders(t) >= placeholders(best) ? t : best);
  const values = skill.values || {}, missing = skill.missing || {};
  const parts = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    const list = values[m[1]];
    if (!list) continue;
    if (m.index > last) parts.push(template.slice(last, m.index));
    parts.push({ values: Array.from({ length: maxRank }, (_, i) => list[i] ?? missing[m[1]] ?? 0) });
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}
