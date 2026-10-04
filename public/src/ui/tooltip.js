// Game-style tooltip over the planner screen. It follows the pointer, or the keyboard focus, onto
// any part with one of the KINDS attributes, and sits at that part's bottom-right corner like the
// game's (flipped left when it would leave the screen).
// Every render rebuilds it, so it follows rank changes and redraws of the part under it. Hidden
// while an item is dragged (ui/drag.js).
import { $, esc } from "./dom.js";

// Rounds away float noise in passive bonus totals (0.1 + 0.2).
const tidy = n => Math.round(n * 10) / 10;

export function mountTooltip(app) {
  const { catalog, planner, state } = app;
  const { nodes, trees, maxRank, mutagens } = catalog;
  const screen = $("screen"), el = $("tooltip");
  // What the tooltip is for: the panel holding the part (it outlives redraws) and the part's key.
  let target = null;

  // Tooltip kinds by data attribute, first match wins: data-tip is a skill id, data-mutagen a
  // mutagen id (with data-group when it sits in a group), data-hint plain text.
  const KINDS = { tip: part => skillTip(part.dataset.tip), mutagen: mutagenTip, hint: part => hintTip(part.dataset.hint) };
  const SELECTOR = Object.keys(KINDS).map(k => `[data-${k}]`).join(", ");
  const kindOf = part => Object.keys(KINDS).find(k => k in part.dataset);
  function keyOf(part) {
    const k = kindOf(part), group = part.dataset.group;
    return `[data-${k}="${CSS.escape(part.dataset[k])}"]` + (group ? `[data-group="${group}"]` : "");
  }
  function follow(part) {
    const next = part && { panel: part.closest("[data-panel]"), key: keyOf(part) };
    if (next ? target && next.panel === target.panel && next.key === target.key : !target) return;
    target = next; render();
  }

  screen.addEventListener("pointerover", e => follow(e.target.closest(SELECTOR)));
  screen.addEventListener("pointerleave", () => follow(null));
  screen.addEventListener("focusin", e => follow(e.target.closest(SELECTOR)));
  screen.addEventListener("focusout", e => { if (!screen.contains(e.relatedTarget)) follow(null); });

  function skillTip(id) {
    const n = nodes[id], T = trees[n.tree], rank = planner.rank(state, id);
    const passive = r => `${T.passive.label}: +${tidy(T.passive.per * r)}${T.passive.unit}`;
    // Only rank 1 text is known, so higher ranks say so instead of repeating it as theirs.
    const current = rank > 0 ? [rank > 1 ? `${n.text} (rank 1 text)` : n.text, passive(rank)] : null;
    const next = rank === 0 ? [n.text, passive(1)]
      : rank < maxRank ? [`Rank ${rank + 1} text isn't published yet.`, passive(rank + 1)] : null;
    return app.game.panels.tooltip({
      name: n.name, level: `${rank}/${maxRank}`, current, next, note: id === state.sel ? app.msg : ""
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

  // A hint is a plain line in the tooltip body.
  const hintTip = text => `<div class="gtip gtip-hint"><p>${esc(text)}</p></div>`;

  function place(part) {
    const s = screen.getBoundingClientRect(), r = part.getBoundingClientRect();
    const w = el.offsetWidth;
    const left = r.right - s.left + w > s.width ? r.left - s.left - w : r.right - s.left;
    el.style.left = `${Math.max(0, left)}px`;
    el.style.top = `${r.bottom - s.top}px`;
  }

  function render() {
    const part = app.game && !app.drag && target && target.panel && target.panel.querySelector(target.key);
    if (!part) { el.hidden = true; return; }
    el.innerHTML = KINDS[kindOf(part)](part);
    el.hidden = false;
    place(part);
  }

  return { render };
}
