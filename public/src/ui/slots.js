// The slot groups of the Character screen, drawn with the game art once it has loaded (app.game).
// Sockets (skills) and diamonds (mutagens) are holders and behave alike, by the rules in
// core/slotKinds.js. Like the game: pressing a full one selects it (it is framed, not the panel
// item), and clicking it again deselects it unless a second click follows (ui/reselect.js); Space
// (on the focused or framed one), a double-click or right-click (or Delete) takes its item out; holding the left button or E on a skill adds a point, as in the tree (ui/hold.js).
// Clicking an empty diamond opens the mutagen tab (SlotKind.emptyOpensTab). Items go in through
// apply mode (ui/applyMode.js): there a click picks a holder of the kind being equipped and a
// double-click fills it, or they are dragged in (ui/drag.js), which finds the holder under the
// pointer with holderAt. A hovered skill or mutagen lights the holders it could go into
// (ui/dropTargets.js).
// Locked holders (core/slotLocks.js, by the slotLocking setting) show the lock: an empty one with
// the game's locked tooltip, a full one with the lock warning over its item (gamePieces.js,
// lockWarn) and a red line in its tooltip (ui/tooltip.js). lockNotice says in a toast when one opens.
//
// Mutations (core/mutations.js): the orb in the panel's centre. Without mutations it shows only on
// hover; holding the left button on it adds mutations to the build and the panel moves into the
// game's mutation layout (gamePanels.mutagenPanel). With mutations a click opens the Mutations panel
// (ui/mutationsPanel.js) and a hold asks whether to remove them, moving the panel back. It has no
// selection. The mutation sockets take part like the others, with their own gate (core/slotKinds.js):
// closed ones show the lock, open ones the active mutation's colours (the game's colour border).
import { $, esc, keyTarget, isLongPress, patchHtml } from "./dom.js";
import { createHold } from "./hold.js";
import { createReselect } from "./reselect.js";
import { confirmPopup } from "./popup.js";
import { skillIcon, mutationArtColor, MUTAGEN_ART, TREE_ART } from "./gameArt.js";
import { VIEWS } from "./gamePanels.js";
import { highlightedSkills } from "../core/skillSets.js";
import { mutationText } from "../core/mutations.js";
import { MUTATION_LOOK_MODERN } from "../settings.js";

// Holder attribute -> slot kind name. Sockets carry data-slot, diamonds data-group.
const HOLDERS = { slot: "skill", group: "mutagen" };
const HOLDER_SELECTOR = Object.keys(HOLDERS).map(a => `[data-${a}]`).join(", ");
// Tooltip of an empty holder by kind name, the game's own text (ui/tooltip.js, data-hint).
const EMPTY_TIP = { title: "Empty slot", text: { skill: "Place an Ability here to activate it.", mutagen: "Place a mutagen here to activate it." } };
const emptyTipAttrs = name => ` data-hint="${esc(EMPTY_TIP.text[name])}" data-hint-title="${esc(EMPTY_TIP.title)}"`;
// Tooltip of an empty locked holder: the game's titles, and when it opens in points (the game's
// skill_slot_unlock_description says "Ability Points acquired").
const LOCKED_TIP = { skill: "Locked slot", mutagen: "Locked mutagen slot" };
const lockedTipAttrs = (name, points) => ` data-hint="Unlocks at ${points} points." data-hint-title="${esc(LOCKED_TIP[name])}"`;
// The orb's tooltip without mutations, and its key (the game's C, ui/mutationsPanel.js).
const ORB_TIP = { title: "Mutations", add: "Hold to add mutations to the build" };
export const MUTATIONS_KEY = "C";
// Mutation colours in the order the game names its colour borders (characterMenuDupe.ws: Red, Green, Blue).
const BORDER_ORDER = ["red", "green", "blue"];

export function mountSlots(app) {
  const { catalog, planner, state, kinds, mutations } = app;
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

  // A mutation socket is locked while it is closed (core/mutations.js), the others by points.
  const lockedAt = (name, i) => name === "skill" && mutations.isMutationSlot(i) ? !mutations.slotOpen(state, i) : kinds[name].lockedAt(state, i);
  function tipAttrs(name, i) {
    if (name === "skill" && mutations.isMutationSlot(i) && lockedAt(name, i)) {
      const need = catalog.mutations.stages[i - slots.base];
      const text = mutations.equipped(state) ? catalog.mutations.labels.masterLocked.replace("$I$", need) : "Activate a mutation to use this slot.";
      return ` data-hint="${esc(text)}" data-hint-title="${esc(LOCKED_TIP.skill)}"`;
    }
    return lockedAt(name, i) ? lockedTipAttrs(name, kinds[name].unlockAt(i)) : emptyTipAttrs(name);
  }

  /**
   * After an item went into holder i, or failed to: a toast when the holder is locked. Hard mode
   * refused it (a failure toast with when it opens); soft mode took it (what opening it needs).
   */
  function lockNotice(name, i) {
    if (name === "skill" && mutations.isMutationSlot(i)) return;
    if (!lockedAt(name, i)) return;
    const points = kinds[name].unlockAt(i);
    if (kinds[name].blockedAt(state, i)) app.toast.show(`Unlocks at ${points} points`, { tone: "bad" });
    else app.toast.show(`To unlock this slot you will need ${points} points`);
  }

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
  function deselectInPlace(h) {
    h.kind.deselect(state); app.msg = "";
    h.g.classList.remove("selected");
    app.render("slots");
  }
  const reselect = createReselect();
  // Runs an action on a holder, redraws and keeps focus on it.
  function act(h, action) {
    app.msg = action().msg; app.render(); focus(h.name, h.i);
  }
  const unequip = h => act(h, () => h.kind.clear(state, h.i));
  const raise = h => act(h, () => h.kind.raise(state, itemOf(h)));

  // The orb: a hold adds mutations, or with them asks to remove them; a click opens them.
  const orbHold = createHold(() => app.settings.holdMs);
  let orbHeld = false, asking = false;
  const orbOf = e => e.target.closest && e.target.closest("[data-orb]");
  async function orbHoldDone() {
    orbHeld = true;
    if (!mutations.isOn(state)) { mutations.setOn(state, true); app.msg = ""; app.render(); return; }
    if (asking || !app.game) return;
    asking = true;
    const researched = mutations.researchedCount(state);
    const yes = await confirmPopup(app, {
      title: "Remove mutations",
      text: researched ? `Remove mutations from the build? ${researched === 1 ? "The researched mutation" : `All ${researched} researched mutations`} will be unresearched and their skill points refunded.`
        : "Remove mutations from the build?"
    });
    asking = false;
    if (yes) { mutations.setOn(state, false); app.msg = ""; app.render(); }
  }
  el.addEventListener("pointerdown", e => {
    const g = orbOf(e);
    if (!g || e.button !== 0 || app.apply) return;
    orbHeld = false;
    orbHold.press(e, g, orbHoldDone);
  });

  el.addEventListener("pointerdown", e => {
    const h = holderOf(e); if (!h || e.button !== 0 || app.apply || !itemOf(h)) return;
    reselect.press(h.kind.framedAt(state, h.i));
    selectInPlace(h);
    if (h.kind.canRaise(state, itemOf(h))) hold.press(e, h.g, () => { reselect.held(); raise(h); });
  });
  el.addEventListener("click", e => {
    if (orbOf(e)) {
      // The click that ends a hold isn't a click.
      if (orbHeld) { orbHeld = false; return; }
      if (mutations.isOn(state) && !app.apply) app.views.mutations.open();
      return;
    }
    const h = holderOf(e); if (!h) return;
    if (app.apply) { if (aimable(h) && app.views.apply.aim(h.i)) frame(h.g); return; }
    if (itemOf(h)) {
      const id = itemOf(h), was = h.kind.framedAt(state, h.i);
      reselect.click(e, was, () => { if (h.kind.framedAt(state, h.i) && itemOf(h) === id) deselectInPlace(h); });
      if (!was) selectInPlace(h);
    } else if (h.kind.emptyOpensTab && !h.kind.shown(state)) { h.kind.open(state); app.msg = ""; app.render(); }
  });
  el.addEventListener("dblclick", e => {
    const h = holderOf(e); if (!h) return;
    if (app.apply) { if (aimable(h)) app.views.apply.accept(h.i); return; }
    if (itemOf(h)) unequip(h);
  });
  el.addEventListener("contextmenu", e => {
    if (orbOf(e)) { e.preventDefault(); return; }
    const h = holderOf(e); if (!h) return;
    e.preventDefault();
    // A long press is the hold, not a right-click; nor does the right button take the skill out mid-hold.
    if (!app.apply && !isLongPress(e) && !hold.active() && itemOf(h)) unequip(h);
  });
  el.addEventListener("keydown", e => {
    if (orbOf(e) && e.key === "Enter") { e.preventDefault(); orbHeld = false; orbOf(e).dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
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
    reselect.cancel();
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

  function socketView(index, lit, { marked, found }) {
    const id = state.slots[index], locked = lockedAt("skill", index);
    if (!id) {
      const label = locked ? (mutations.isMutationSlot(index) ? "Locked mutation slot." : `Locked slot, unlocks at ${kinds.skill.unlockAt(index)} points.`) : emptyLabel("slot", "skill");
      return { ...holderView("skill", index, lit), locked, attrs: ` data-slot="${index}"${tipAttrs("skill", index)} tabindex="0" role="button" aria-label="${esc(label)}"` };
    }
    const n = nodes[id], rank = planner.rank(state, id);
    return {
      ...holderView("skill", index, lit), icon: skillIcon(n.tree, n.game), color: TREE_ART[n.tree].color, rank, locked,
      marked: marked.get(id) || 0, found: found.skill.has(id),
      attrs: ` data-slot="${index}" data-tip="${id}"${dragAttrs("skill", id, index)} tabindex="0" role="button" aria-label="${esc(n.name)}, rank ${rank} of ${maxRank}, equipped"`
    };
  }

  // A diamond with a mutagen shows its tooltip (ui/tooltip.js, data-mutagen); an empty one the
  // game's empty slot tooltip.
  function groupView(g, lit, frames) {
    const bonus = planner.groupBonus(state, g), m = mutagens[bonus.mutagen], locked = lockedAt("mutagen", g);
    const label = m ? `${m.name}, +${bonus.value}${m.stat.unit} ${m.stat.label}, equipped`
      : locked ? `Locked mutagen slot, unlocks at ${kinds.mutagen.unlockAt(g)} points.` : emptyLabel("mutagen slot", "mutagen");
    const tip = m ? ` data-mutagen="${m.id}"${dragAttrs("mutagen", m.id, g)}` : tipAttrs("mutagen", g);
    return {
      ...holderView("mutagen", g, lit), mutagen: bonus.color, size: m && m.size, locked,
      bonus: m ? `+${bonus.value}${m.stat.unit}` : null, found: !!m && frames.found.mutagen.has(m.id),
      attrs: ` data-group="${g}"${tip} tabindex="0" role="button" aria-label="Group ${g + 1} mutagen: ${esc(label)}"`,
      sockets: Array.from({ length: slots.perGroup }, (_, i) => socketView(g * slots.perGroup + i, lit, frames))
    };
  }

  // The mutation sockets: closed ones locked; all of them show the active mutation's colours, the
  // first two along their bottom edge and the last two along their top, facing the orb
  // (characterMenuDupe.ws: _Bottom for slots 13 and 14, _Top for 15 and 16).
  function mutationSocketViews(lit, frames) {
    const colors = mutations.colors(state), allowed = BORDER_ORDER.filter(c => colors.includes(c)).join("-");
    return Array.from({ length: slots.mutation }, (_, k) => ({ ...socketView(slots.base + k, lit, frames), allowed, flip: k >= slots.mutation / 2 }));
  }

  // The orb: a ghost without mutations; with them the active mutation's colour, and in the Classic
  // look its name, description and key cap (C) beside it (the Modern look puts the texts in its
  // tooltip and leaves the key to the legend).
  function orbView() {
    if (!mutations.isOn(state)) {
      return { color: "default", cls: "ghost", attrs: ` data-orb tabindex="0" role="button" aria-label="${esc(`${ORB_TIP.title}: ${ORB_TIP.add}`)}" data-hint="${esc(ORB_TIP.add)}" data-hint-title="${esc(ORB_TIP.title)}"` };
    }
    const id = mutations.equipped(state), m = id && catalog.mutations.items[id];
    const classic = app.settings.mutationLook !== MUTATION_LOOK_MODERN;
    const tip = m && !classic ? ` data-mutation="${id}"` : ` data-orbtip`;
    return {
      color: m ? mutationArtColor(m.colors) : "default", key: classic ? MUTATIONS_KEY : "",
      name: m && classic ? m.name : "", description: m && classic ? mutationText(m) : "",
      attrs: ` data-orb${tip} tabindex="0" role="button" aria-label="${esc(m ? `Mutations, ${m.name} active` : "Mutations")}"`
    };
  }

  function render() {
    if (!app.game) return;
    const lit = app.dropTargets.targets();
    // Equipped skills of the highlighted skill sets and equipped search matches (ui/search.js) are
    // framed as in the tree (ui/tree.js) and the inventory.
    const frames = { marked: highlightedSkills(catalog, state.skillSets, app.settings.skillSetsMatchAll), found: app.found() };
    const groups = Array.from({ length: slots.groups }, (_, g) => groupView(g, lit, frames));
    const mutation = slots.mutation ? { on: mutations.isOn(state), sockets: mutationSocketViews(lit, frames), orb: orbView() } : null;
    // In place, like the tree (ui/tree.js, render), so a focused holder stays and a switch of layout animates.
    patchHtml(el, app.game.panels.svg(VIEWS.slots, app.game.panels.mutagenPanel({ groups, mutation }),
      ` role="group" aria-label="Skill slots and mutagens"`));
    app.game.panels.orbTextGap(el);
  }

  // The rows make room for the orb's description by its drawn height, which changes once the game font is in.
  document.fonts.ready.then(() => app.game && app.game.panels.orbTextGap(el));

  // Mutagen colours must have game art; a new one in data/mutagens.js needs MUTAGEN_ART first.
  Object.values(mutagens).filter(m => !MUTAGEN_ART[m.color]).forEach(m => console.error(`No game art for mutagen colour "${m.color}" (${m.id}).`));

  // Locks show by the slotLocking setting, the orb's texts by the mutation look.
  function settingChanged(key) { if (key === "slotLocking" || key === "mutationLook") app.render(); }

  return { render, focus, showDrop, holderAt, lockNotice, settingChanged };
}
