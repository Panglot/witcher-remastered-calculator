// The points budget: how many skill points a build has. Calculated from Geralt's level, the places
// of power and the point items (rules.points), or a custom total typed in. NG+ is a second
// playthrough: places of power and items give their points again; the level cap stays.
//
// Progress (state.progress): { ngPlus, level, places, other, custom }. While custom, the budget is
// the typed total and level, places and other are kept, unused, so leaving custom brings them back.

/** The source fields, in the order the Statistics panel shows them. */
export const SOURCE_FIELDS = ["level", "places", "other"];

/** @param {{ maxLevel: number, placesOfPower: number, items: { points: number }[] }} rules  rules.points */
export function createBudget(rules) {
  const itemPoints = rules.items.reduce((sum, i) => sum + i.points, 0);
  const playthroughs = ngPlus => ngPlus ? 2 : 1;

  /** [min, max] of each field. */
  function limits(ngPlus) {
    const n = playthroughs(ngPlus);
    const max = { level: rules.maxLevel, places: rules.placesOfPower * n, other: itemPoints * n };
    return {
      level: [1, max.level], places: [0, max.places], other: [0, max.other],
      total: [0, totalOf(max)]
    };
  }

  /** Points from a level (level 1 gives none), places of power and other points. */
  const totalOf = p => p.level - 1 + p.places + p.other;

  const clamp = (v, [min, max]) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)));

  /** Every source field at its max. */
  function maxed(ngPlus) {
    const l = limits(ngPlus);
    return Object.fromEntries(SOURCE_FIELDS.map(k => [k, l[k][1]]));
  }

  /** A new build's progress: New Game, everything at its max. */
  const defaults = () => ({ ngPlus: false, ...maxed(false), custom: false });

  /** The budget the progress gives (custom: the typed total, clamped). */
  const budgetOf = (p, typed) => p.custom ? clamp(typed, limits(p.ngPlus).total) : totalOf(p);

  /**
   * Progress from saved or shared data, every field clamped. Without any (builds made before
   * progress was kept), a custom total of `budget`, in NG+ if New Game can't reach it.
   */
  function normalize(p, budget) {
    if (!p || typeof p !== "object") {
      const ngPlus = budget > limits(false).total[1];
      return { ngPlus, ...maxed(ngPlus), custom: true };
    }
    const ngPlus = !!p.ngPlus, l = limits(ngPlus);
    const out = { ngPlus, custom: !!p.custom };
    SOURCE_FIELDS.forEach(k => { out[k] = clamp(p[k] != null ? p[k] : l[k][1], l[k]); });
    return out;
  }

  // State changes. Each sets state.progress and state.budget together.

  /** Typing into a source field: back to calculated, the other fields as they were. */
  function setField(state, key, value) {
    const p = state.progress;
    p[key] = clamp(value, limits(p.ngPlus)[key]);
    p.custom = false;
    state.budget = totalOf(p);
  }

  /** Typing a total: custom, clamped to what the playthrough can reach. */
  function setTotal(state, value) {
    state.progress.custom = true;
    state.budget = clamp(value, limits(state.progress.ngPlus).total);
  }

  /** New Game or NG+: back to calculated (a custom total is dropped), every field at that playthrough's max. */
  function setNgPlus(state, ngPlus) {
    const p = state.progress;
    Object.assign(p, { ngPlus, custom: false }, maxed(ngPlus));
    state.budget = totalOf(p);
  }

  return { limits, totalOf, defaults, normalize, budgetOf, setField, setTotal, setNgPlus };
}
