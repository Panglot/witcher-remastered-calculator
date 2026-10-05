// Game-style tooltip over the planner screen (ui/tipHost.js follows the part and places it).
// Every render rebuilds it, so it follows rank changes and redraws of the part under it. Hidden
// while an item is dragged (ui/drag.js).
import { $, isTouchScreen } from "./dom.js";
import { createTipHost } from "./tipHost.js";
import { rankText, allRanksParts } from "../core/skillText.js";
import { SKILL_TEXT_MODERN } from "../settings.js";

// Rounds away float noise in passive bonus totals (0.1 + 0.2).
const tidy = n => Math.round(n * 10) / 10;

/**
 * Text parts from allRanksParts as a tooltip line: each number as its values per rank ("10/20/30"),
 * the one at `rank` highlighted in the [Hold] colour. Rank 0 highlights nothing, and a number the
 * same at every rank (Counterattack's 2) is shown once, plain.
 */
const allRanksLine = (parts, rank) => parts.flatMap(p => typeof p === "string" ? [p]
  : new Set(p.values).size === 1 ? [String(p.values[0])]
  : p.values.flatMap((v, i) => [...(i ? ["/"] : []), i + 1 === rank ? { text: String(v), cls: "gtip-on" } : String(v)]));

/**
 * A part's data-hint as the game's hint tooltip (ui/gamePanels.js, hintTooltip): data-hint-title
 * over it, and data-hint-note under it, red with data-hint-note-bad.
 */
export const hintTip = (app, part) => app.game.panels.hintTooltip({
  title: part.dataset.hintTitle, text: part.dataset.hint,
  note: part.dataset.hintNote, noteBad: "hintNoteBad" in part.dataset
});

export function mountTooltip(app) {
  const { catalog, planner, state } = app;
  const { nodes, trees, maxRank, mutagens } = catalog;

  function skillTip(id) {
    const n = nodes[id], T = trees[n.tree], rank = planner.rank(state, id);
    const passive = r => `${T.passive.label}: +${tidy(T.passive.per * r)}${T.passive.unit}`;
    const head = { name: n.name, level: `${rank}/${maxRank}`, note: id === state.sel ? app.msg : "" };
    if (app.settings.skillText === SKILL_TEXT_MODERN) {
      const ranks = Array.from({ length: maxRank }, (_, i) => tidy(T.passive.per * (i + 1)));
      const passiveParts = [`${T.passive.label}: +`, { values: ranks }, T.passive.unit];
      return app.game.panels.tooltip({ ...head, all: [allRanksParts(n, maxRank), passiveParts].map(p => allRanksLine(p, rank)) });
    }
    const lines = r => [rankText(n, r), passive(r)];
    return app.game.panels.tooltip({
      ...head, current: rank > 0 ? lines(rank) : null, next: rank < maxRank ? lines(rank + 1) : null
    });
  }

  // A mutagen, as the game's item tooltip: its bonus, how slotted skills raise it and, in a group,
  // what it gives there. The value is written like the lines under it ("+10%"), not spaced out
  // like the game's ("+ 10 %").
  function mutagenTip(part) {
    const m = mutagens[part.dataset.mutagen], { label, unit } = m.stat, g = part.dataset.group;
    const body = [`+${m.value}${unit} more for each ${m.color} skill slotted in its group, up to +${m.value * (1 + catalog.slots.perGroup)}${unit}.`];
    if (g != null) {
      const b = planner.groupBonus(state, +g);
      body.push(`In this group: +${b.value}${unit} (${b.matches} matching skill${b.matches === 1 ? "" : "s"}).`);
    }
    return app.game.panels.itemTooltip({
      name: m.name, type: m.type, stats: [{ value: `+${m.value}${unit}`, label }],
      body, rarity: m.rarity, note: m.id === state.selMut ? app.msg : ""
    });
  }

  // Tooltip kinds by data attribute: data-tip is a skill id, data-mutagen a mutagen id (with
  // data-group when it sits in a group), data-hint plain text under the optional data-hint-title.
  // On a touch screen apply mode shows none: each tap to pick a holder would cover the slots with one.
  return createTipHost({
    area: $("screen"), el: $("tooltip"),
    kinds: { tip: part => skillTip(part.dataset.tip), mutagen: mutagenTip, hint: part => hintTip(app, part) },
    places: ["group", "slot"],
    shown: () => !!app.game && !app.drag && !(app.apply && isTouchScreen())
  });
}
