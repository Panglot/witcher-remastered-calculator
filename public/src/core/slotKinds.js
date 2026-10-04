// What the slot groups hold: skills in sockets and mutagens in diamonds. Both go through one set
// of rules here, so a change to how slotting or selection works applies to both. A kind only
// names its parts: the build list it fills, its selection fields in the page state (state.js),
// the tab that lists it, and its planner actions. Works on the page state; never touches the DOM.
//
// Selection, like the game: one thing is framed at a time. Each kind keeps a selected item and the
// holder it was picked from (null when picked in its panel), and the open tab decides which kind
// is shown. A holder that no longer has the selected item hands the frame back to the panel.
//
// Equipping, like the game's apply mode (ui/applyMode.js): the item goes into the holder picked,
// over what was there. A skill leaves the socket it was in (one copy); a mutagen is not moved, so
// any number of groups can hold it. Only skills take points from a holder (raise).
//
// Dragging (ui/drag.js) moves an item: from the panel it is equipped as above; from a holder it
// swaps with what the target held, or leaves its holder empty, for both kinds.
//
// Drop targets, like the game's (SlotsTransferManager.highlightDropTargets): while an item that
// can be equipped is hovered, every holder of its kind it could go into lights up, full or empty,
// except the holder it is in.
import { MUTAGEN_TAB } from "./catalog.js";

/**
 * @typedef {{ ok: boolean, msg: string }} Result
 * @typedef {object} SlotKind
 * @property {(s: object) => (string|null)} selected  selected item id
 * @property {(s: object) => (number|null)} heldAt  holder the selection was picked from, if it still holds it
 * @property {(s: object, id: string, at?: number|null) => void} select  selects and opens the item's tab
 * @property {(s: object) => boolean} shown  its tab is open, so its selection is the one framed
 * @property {(s: object) => void} open  opens the tab that lists the kind
 * @property {boolean} emptyOpensTab  a click on an empty holder, with the kind's tab closed, opens it
 * @property {(s: object, i: number) => boolean} framedAt  holder i shows the selection frame
 * @property {(s: object, id: string) => boolean} framedInPanel  the panel item shows the selection frame
 * @property {(s: object, i: number) => (string|null)} itemAt  item in holder i
 * @property {(s: object, i: number) => Result} clear  empties holder i
 * @property {(s: object, id: string) => boolean} canEquip  the item can go into a holder
 * @property {(s: object, id: string) => number} target  holder an equip starts on: the first empty one,
 *   else the one holding the item, else the first
 * @property {(s: object, id: string, i: number) => Result} equip  puts the item in holder i
 * @property {(s: object, id: string, from: (number|null), to: number) => Result} move  puts the item
 *   in holder `to`; when it came from holder `from`, what `to` held goes there (else `from` empties)
 * @property {(s: object, id: string, from?: number|null) => number[]} dropTargets  holders the item
 *   could go into, but `from` (the holder it is hovered in); none when it can't be equipped
 * @property {(s: object, id: string) => boolean} canRaise  a point can go into the item
 * @property {(s: object, id: string) => Result} raise  adds a point to the item
 */

const cannot = () => false;

/** @returns {{ skill: SlotKind, mutagen: SlotKind }} */
export function createSlotKinds(catalog, planner) {
  const { nodes, order } = catalog;
  const defs = {
    skill: {
      list: "slots", idKey: "sel", atKey: "selSlot",
      tabOf: id => nodes[id].tree, onTab: tab => tab !== MUTAGEN_TAB,
      homeTab: s => s.sel ? nodes[s.sel].tree : order[0], emptyOpensTab: false,
      canEquip: planner.canEquipSkill, equip: planner.equipSkill, clear: planner.clearSlot,
      canRaise: planner.canAddPoint, raise: planner.addPoint
    },
    mutagen: {
      list: "mut", idKey: "selMut", atKey: "selGroup",
      tabOf: () => MUTAGEN_TAB, onTab: tab => tab === MUTAGEN_TAB,
      homeTab: () => MUTAGEN_TAB, emptyOpensTab: true,
      canEquip: planner.canEquipMutagen, equip: planner.equipMutagen, clear: planner.clearMutagen,
      canRaise: cannot, raise: () => ({ ok: false, msg: "" })
    }
  };
  return Object.fromEntries(Object.entries(defs).map(([name, d]) => [name, slotKind(d)]));
}

/** The shared rules over one kind's parts. */
function slotKind(d) {
  const selected = s => s[d.idKey] || null;
  const itemAt = (s, i) => s[d.list][i] || null;
  function heldAt(s) {
    const i = s[d.atKey];
    return i != null && selected(s) && itemAt(s, i) === selected(s) ? i : null;
  }
  const shown = s => d.onTab(s.tab);
  return {
    selected, heldAt, shown, itemAt, emptyOpensTab: d.emptyOpensTab,
    select(s, id, at = null) { s[d.idKey] = id; s[d.atKey] = at; s.tab = d.tabOf(id); },
    open(s) { s.tab = d.homeTab(s); },
    framedAt: (s, i) => shown(s) && heldAt(s) === i,
    framedInPanel: (s, id) => selected(s) === id && heldAt(s) == null,
    clear: (s, i) => d.clear(s, i),
    canEquip: (s, id) => d.canEquip(s, id),
    target(s, id) {
      const list = s[d.list], empty = list.findIndex(x => !x);
      return empty >= 0 ? empty : Math.max(0, list.indexOf(id));
    },
    equip: (s, id, i) => d.equip(s, i, id),
    move(s, id, from, to) {
      const was = itemAt(s, to), r = d.equip(s, to, id);
      if (!r.ok || from == null || from === to) return r;
      if (was && was !== id) return d.equip(s, from, was);
      return itemAt(s, from) === id ? d.clear(s, from) : r;
    },
    dropTargets: (s, id, from = null) => d.canEquip(s, id) ? s[d.list].map((_, i) => i).filter(i => i !== from) : [],
    canRaise: (s, id) => !!id && d.canRaise(s, id),
    raise: (s, id) => d.raise(s, id)
  };
}
