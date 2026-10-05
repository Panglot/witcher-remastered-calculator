// The slot groups of the Character screen, drawn with the game art once it has loaded (app.game).
// Skills with points but no slot are listed in the Statistics panel (ui/statistics.js).
// Sockets (skills) and diamonds (mutagens) are holders and behave alike, by the rules in
// core/slotKinds.js. Like the game: pressing a full one selects it (it is framed, not the panel
// item); Space (on the focused or framed one), a double-click or right-click (or Delete) takes its
// item out; holding the left button or E on a skill adds a point, as in the tree (ui/hold.js).
// Clicking an empty diamond opens the mutagen tab (SlotKind.emptyOpensTab). Items go in through apply mode
// (ui/applyMode.js): there a click picks a holder of the kind being equipped and a double-click
// fills it, or they are dragged in (ui/drag.js), which finds the holder under the pointer with
// holderAt. A hovered skill or mutagen lights the holders it could go into (ui/dropTargets.js).
import { $, esc, keyTarget, isLongPress, patchHtml } from "./dom.js";
import { createHold } from "./hold.js";
import { skillIcon, MUTAGEN_ART, TREE_ART } from "./gameArt.js";
import { VIEWS } from "./gamePanels.js";

// Holder attribute -> slot kind name. Sockets carry data-slot, diamonds data-group.
const HOLDERS = { slot: "skill", group: "mutagen" };
const HOLDER_SELECTOR = Object.keys(HOLDERS).map(a => `[data-${a}]`).join(", ");
// Tooltip of an empty holder by kind name, the game's own text (ui/tooltip.js, data-hint).
const EMPTY_TIP = { title: "Empty slot", text: { skill: "Place an Ability here to activate it.", mutagen: "Place a mutagen here to activate it." } };
const emptyTipAttrs = name => ` data-hint="${esc(EMPTY_TIP.text[name])}" data-hint-title="${esc(EMPTY_TIP.title)}"`;

export function mountSlots(app) {
  const { catalog, planner, state, kinds } = app;
  const { nodes, maxRank, mutagens, slots } = catalog;
  const el = $("slotsPanel");
  const hold = createHold(() => app.settings.holdMs);

  /** The holder under `node`: its element, kind name, kind and index. */
  function holderAt(node) {
    const g = node && node.closest && node.closest(HOLDER_SELECTOR);
    if (!g || !el.contains(g)) return null;
    const attr = Object.keys(HOLDERS).find(a => g.hasAttribute(`data-${a}`)), name = HOLDERS[attr];
    return { g, attr, name, kind: kinds[name], i: +g.getAttribute(`data-${attr}`) };
  }
  const holderOf = e => holderAt(e.target);
  const attrOf = name => Object.keys(HOLDERS).find(a => HOLDERS[a] === name);
  const holderEl = (name, i) => el.querySelector(`[data-${attrOf(name)}="${i}"]`);
  const itemOf = h => h.kind.itemAt(state, h.i);
  // In apply mode only holders of the kind being equipped take part.
  const aimable = h => app.apply && h.name === app.apply.kind;

  /** Focuses a holder (apply mode starts on one). */
  function focus(name, i) { const g = holderEl(name, i); if (g) g.focus({ preventScroll: true }); }
  // Moves the selection frame without a redraw, so the pressed element stays (holds and
  // double-clicks need it).
  function frame(g) {
    el.querySelectorAll(".gsock.selected, .gdiamond.selected").forEach(n => n.classList.remove("selected"));
    g.classList.add("selected");
  }
  function selectInPlace(h) {
    if (h.kind.framedAt(state, h.i)) return;
    h.kind.select(state, itemOf(h), h.i); app.msg = "";
    frame(h.g);
    app.render("slots");
  }
  // Runs an action on a holder, redraws and keeps focus on it.
  function act(h, action) {
    app.msg = action().msg; app.render(); focus(h.name, h.i);
  }
  const unequip = h => act(h, () => h.kind.clear(state, h.i));
  const raise = h => act(h, () => h.kind.raise(state, itemOf(h)));

  el.addEventListener("pointerdown", e => {
    const h = holderOf(e); if (!h || e.button !== 0 || app.apply || !itemOf(h)) return;
    selectInPlace(h);
    if (h.kind.canRaise(state, itemOf(h))) hold.press(e, h.g, () => raise(h));
  });
  el.addEventListener("click", e => {
    const h = holderOf(e); if (!h) return;
    if (app.apply) { if (aimable(h)) { app.views.apply.aim(h.i); frame(h.g); } return; }
    if (itemOf(h)) selectInPlace(h);
    else if (h.kind.emptyOpensTab && !h.kind.shown(state)) { h.kind.open(state); app.msg = ""; app.render(); }
  });
  el.addEventListener("dblclick", e => {
    const h = holderOf(e); if (!h) return;
    if (app.apply) { if (aimable(h)) app.views.apply.accept(h.i); return; }
    if (itemOf(h)) unequip(h);
  });
  el.addEventListener("contextmenu", e => {
    const h = holderOf(e); if (!h) return;
    e.preventDefault();
    // A long press is the hold, not a right-click; nor does the right button take the skill out mid-hold.
    if (!app.apply && !isLongPress(e) && !hold.active() && itemOf(h)) unequip(h);
  });
  el.addEventListener("keydown", e => {
    const h = holderOf(e); if (!h) return;
    if (e.key === "Enter") { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    else if ((e.key === "Delete" || e.key === "Backspace") && !app.apply && itemOf(h)) { e.preventDefault(); unequip(h); }
  });

  // E and Space act on the focused holder, else on the one framing the selection.
  function target() {
    const g = keyTarget(el, HOLDER_SELECTOR, () => {
      const name = Object.keys(kinds).find(n => kinds[n].shown(state)), i = kinds[name].heldAt(state);
      return i == null ? null : holderEl(name, i);
    });
    return holderAt(g);
  }
  app.hotkeys.add(e => {
    const key = e.key.toLowerCase();
    if (e.repeat || (key !== "e" && key !== " ")) return false;
    const h = target(); if (!h || !itemOf(h)) return false;
    if (key === " ") { unequip(h); return true; }
    selectInPlace(h); h.g.focus({ preventScroll: true });
    if (h.kind.canRaise(state, itemOf(h))) hold.key(e, h.g, () => raise(h));
    return true;
  });

  // Whether holder i of a kind is a drop target in `lit` (app.dropTargets.targets()).
  const isLit = (lit, name, i) => !!lit && lit.kind === name && lit.at.includes(i);
  /** Lights the drop targets in place, so their fade runs (styles.css, .drop). */
  function showDrop() {
    const lit = app.dropTargets.targets();
    el.querySelectorAll(HOLDER_SELECTOR).forEach(g => { const h = holderAt(g); g.classList.toggle("drop", isLit(lit, h.name, h.i)); });
  }

  // What every holder shows the same way: the selection frame (in apply mode, on the holder to
  // fill), whether it is a drop target, and in apply mode whether it takes part.
  function holderView(name, i, lit) {
    const kind = kinds[name];
    if (!app.apply) return { selected: kind.framedAt(state, i), cls: isLit(lit, name, i) ? "drop" : "" };
    const on = name === app.apply.kind;
    return { selected: on && app.apply.at === i, cls: on ? "target" : "off" };
  }
  // Text for an empty holder: what it is and what a click there does.
  function emptyLabel(what, name) {
    const action = app.apply ? (name === app.apply.kind ? "Click to pick it, double-click to equip here." : "")
      : kinds[name].shown(state) ? "Equip from the panel with Space, a double-click or by dragging it here." : "";
    return [`Empty ${what}.`, action].filter(Boolean).join(" ");
  }

  // A full holder is a drop target source too (ui/dropTargets.js).
  const dragAttrs = (name, id, i) => ` data-drag="${name}" data-drag-item="${esc(id)}" data-drag-from="${i}"`;

  function socketView(index, lit) {
    const id = state.slots[index];
    if (!id) {
      const label = emptyLabel("slot", "skill");
      return { ...holderView("skill", index, lit), attrs: ` data-slot="${index}"${emptyTipAttrs("skill")} tabindex="0" role="button" aria-label="${esc(label)}"` };
    }
    const n = nodes[id], rank = planner.rank(state, id);
    return {
      ...holderView("skill", index, lit), icon: skillIcon(n.tree, n.game), color: TREE_ART[n.tree].color, rank,
      attrs: ` data-slot="${index}" data-tip="${id}"${dragAttrs("skill", id, index)} tabindex="0" role="button" aria-label="${esc(n.name)}, rank ${rank} of ${maxRank}, equipped"`
    };
  }

  // A diamond with a mutagen shows its tooltip (ui/tooltip.js, data-mutagen); an empty one the
  // game's empty slot tooltip.
  function groupView(g, lit) {
    const bonus = planner.groupBonus(state, g), m = mutagens[bonus.mutagen];
    const label = m ? `${m.name}, +${bonus.value}${m.stat.unit} ${m.stat.label}, equipped`
      : emptyLabel("mutagen slot", "mutagen");
    const tip = m ? ` data-mutagen="${m.id}"${dragAttrs("mutagen", m.id, g)}` : emptyTipAttrs("mutagen");
    return {
      ...holderView("mutagen", g, lit), mutagen: bonus.color, size: m && m.size,
      bonus: m ? `+${bonus.value}${m.stat.unit}` : null,
      attrs: ` data-group="${g}"${tip} tabindex="0" role="button" aria-label="Group ${g + 1} mutagen: ${esc(label)}"`,
      sockets: Array.from({ length: slots.perGroup }, (_, i) => socketView(g * slots.perGroup + i, lit))
    };
  }

  function render() {
    if (!app.game) return;
    const lit = app.dropTargets.targets();
    const groups = Array.from({ length: slots.groups }, (_, g) => groupView(g, lit));
    // In place, like the tree (ui/tree.js, render), so a focused holder stays.
    patchHtml(el, app.game.panels.svg(VIEWS.slots, app.game.panels.mutagenPanel({ groups }),
      ` role="group" aria-label="Skill slots and mutagens"`));
  }

  // Mutagen colours must have game art; a new one in data/mutagens.js needs MUTAGEN_ART first.
  Object.values(mutagens).filter(m => !MUTAGEN_ART[m.color]).forEach(m => console.error(`No game art for mutagen colour "${m.color}" (${m.id}).`));

  return { render, focus, showDrop, holderAt };
}
