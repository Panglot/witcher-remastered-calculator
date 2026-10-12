// Game-style tooltip over the planner screen (ui/tipHost.js follows the part and places it).
// Every render rebuilds it, so it follows rank changes and redraws of the part under it. Hidden
// while an item is dragged (ui/drag.js).
import { $, isTouchScreen } from "./dom.js";
import { createTipHost } from "./tipHost.js";
import { rankText, allRanksParts } from "../core/skillText.js";
import { SKILL_TEXT_MODERN } from "../settings.js";
import { setLabels } from "../core/skillSets.js";
import { mutationText } from "../core/mutations.js";
import { MUTAGEN_COLOR_ORDER } from "./gameArt.js";

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
 * over it, and data-hint-note under it, red with data-hint-note-bad. data-hint-terms: names, split
 * by "|", that are marked where a line starts with them (an option row's choices, ui/options.js).
 */
export const hintTip = (app, part) => app.game.panels.hintTooltip({
  title: part.dataset.hintTitle, text: part.dataset.hint, terms: part.dataset.hintTerms?.split("|"),
  note: part.dataset.hintNote, noteBad: "hintNoteBad" in part.dataset
});

// Greater mutagens by colour, as research costs list them.
const MUTAGEN_NAMES = { red: "Greater red mutagen", green: "Greater green mutagen", blue: "Greater blue mutagen" };
const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

/**
 * A mutation's tooltip, as the game's Mutations panel shows it (gamePanels.mutationTooltip): the
 * trees its slots take; the cost while it can be researched, the mutations it needs while it can't.
 * `note`: a line under it (why an action was refused).
 */
export function mutationTip(app, id, note = "") {
  const { catalog, mutations, state } = app, { items, labels } = catalog.mutations, m = items[id];
  const enabled = mutations.requirementsMet(state, id), researched = mutations.isResearched(state, id);
  const allows = catalog.order.filter(t => m.colors.includes(catalog.trees[t].mutagen))
    .map(t => ({ label: catalog.trees[t].name, color: catalog.trees[t].mutagen }));
  const cost = enabled && !researched ? [{ value: String(m.cost.points), label: plural(m.cost.points, "Skill point") }]
    .concat(MUTAGEN_COLOR_ORDER.filter(c => m.cost[c]).map(c => ({ value: String(m.cost[c]), label: plural(m.cost[c], MUTAGEN_NAMES[c]) }))) : [];
  return app.game.panels.mutationTooltip({
    name: m.name, text: mutationText(m), allowsLabel: labels.allows, allows, cost,
    requirementsLabel: labels.requirements, requirements: enabled ? [] : m.requires.map(r => items[r].name), note
  });
}

/** Strengthened Synapses' tooltip: its stage, the slots it opens and what the next stage needs (characterMenuDupe.ws). */
export function masterTip(app) {
  const { catalog, mutations, state } = app, { master, labels, stages } = catalog.mutations;
  const stage = mutations.stage(state), next = mutations.nextStage(state);
  const lines = stage === 0 ? [labels.masterLocked.replace("$I$", stages[0])]
    : [labels.masterSlots.replace("$I$", stage), ...(next != null ? [labels.masterNext.replace("$I$", next)] : [])];
  return app.game.panels.mutationTooltip({ name: master.name, text: next != null ? labels.masterImprove : master.text, lines });
}

export function mountTooltip(app) {
  const { catalog, planner, state } = app;
  const { nodes, trees, maxRank, mutagens } = catalog;

  // A part in a locked slot (data-slot, data-group): when the slot opens.
  function lockLine(part) {
    const [name, i] = part.dataset.slot != null ? ["skill", part.dataset.slot] : ["mutagen", part.dataset.group];
    if (i == null || !app.kinds[name].lockedAt(state, +i)) return "";
    return `This slot unlocks at ${app.kinds[name].unlockAt(+i)} points.`;
  }

  function skillTip(part) {
    const id = part.dataset.tip, n = nodes[id], T = trees[n.tree], rank = planner.rank(state, id);
    const passive = r => `${T.passive.label}: +${tidy(T.passive.per * r)}${T.passive.unit}`;
    // The skill's sets (ui/skillSets.js): the selected ones, or every one with the panel's switch.
    const sets = setLabels(catalog, id, state.skillSets, app.settings.skillSetsInTooltip);
    const head = { name: n.name, level: `${rank}/${maxRank}`, sets, lock: lockLine(part), note: id === state.sel ? app.msg : "" };
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
      const synergy = b.synergy ? `, +${b.synergy}${unit} from ${catalog.nodes[catalog.totals.synergy.skill].name}` : "";
      body.push(`In this group: +${b.value}${unit} (${b.matches} matching skill${b.matches === 1 ? "" : "s"}${synergy}).`);
    }
    return app.game.panels.itemTooltip({
      name: m.name, type: m.type, stats: [{ value: `+${m.value}${unit}`, label }],
      body, rarity: m.rarity, lock: lockLine(part), note: m.id === state.selMut ? app.msg : ""
    });
  }

  // The orb with mutations (ui/slots.js), without the active one's tooltip (the Classic look, or none active).
  const orbTip = () => app.game.panels.hintTooltip({ title: "Mutations", text: "Click to open the mutations. Hold to remove them from the build." });

  // Tooltip kinds by data attribute: data-tip is a skill id, data-mutagen a mutagen id (with
  // data-group when it sits in a group), data-mutation a mutation id, data-orbtip the orb's hint,
  // data-hint plain text under the optional data-hint-title.
  // On a touch screen apply mode shows none: each tap to pick a holder would cover the slots with one.
  return createTipHost({
    area: $("screen"), el: $("tooltip"),
    kinds: { tip: skillTip, mutagen: mutagenTip, mutation: part => mutationTip(app, part.dataset.mutation), orbtip: orbTip, hint: part => hintTip(app, part) },
    places: ["group", "slot", "hintTitle"],
    shown: () => !!app.game && !app.drag && !(app.apply && isTouchScreen())
  });
}
