// The Mutagens tab of the tree panel: every mutagen in data/mutagens.js in the game's inventory
// grid, each unlimited. Click selects; Space (on the focused or selected one) or a double-click
// equips it through apply mode (ui/applyMode.js), like a skill; right-click or Delete takes it out
// of every group. Selection and diamonds follow the shared slot rules (core/slotKinds.js).
import { esc, keyTarget, isLongPress } from "./dom.js";
import { mutagenIcon } from "./gameArt.js";

// The game's 5th tab (GAME_TABS) lists mutagens; its art is named after Mutations.
export const MUTAGEN_ART_TAB = "mutations";

/** @returns {import("./tree.js").TabContent} */
export function createMutagenList(app, el) {
  const { catalog, planner, state } = app;
  const { mutagens } = catalog;

  // Selecting in the inventory takes the selection off any diamond (core/slotKinds.js).
  const kind = app.kinds.mutagen;
  const selectItem = id => kind.select(state, id);
  const idOf = e => { const g = e.target.closest("[data-mutagen]"); return g && g.dataset.mutagen; };
  const itemEl = id => el.querySelector(`.gitem[data-mutagen="${id}"]`);
  function focusItem(id) { const g = itemEl(id); if (g) g.focus({ preventScroll: true }); }
  // Runs a planner action on a mutagen, redraws and keeps focus.
  function act(id, action) {
    selectItem(id);
    app.msg = action(state, id).msg; app.render(); focusItem(id);
  }
  const select = () => ({ msg: "" });
  const equip = id => app.views.apply.start("mutagen", id);

  function itemView(m) {
    const used = state.mut.filter(id => id === m.id).length;
    const label = `${m.name}, +${m.value}${m.stat.unit} ${m.stat.label}${used ? `, equipped in ${used} group${used > 1 ? "s" : ""}` : ""}`;
    return {
      col: m.col, row: m.row, icon: mutagenIcon(m.color, m.size), selected: kind.framedInPanel(state, m.id),
      attrs: ` data-mutagen="${m.id}" data-drag="mutagen" data-drag-item="${m.id}" tabindex="0" role="button" aria-label="${esc(label)}"`
    };
  }

  return {
    click(e) {
      const g = e.target.closest("[data-mutagen]"); if (!g) return;
      // Like skills: move the selection in place so a double-click lands on the same element.
      selectItem(g.dataset.mutagen); app.msg = "";
      el.querySelectorAll(".gitem.selected").forEach(n => n.classList.remove("selected"));
      g.classList.add("selected");
      app.views.slots.render(); app.views.tooltip.render(); app.save();
    },
    dblclick(e) { const id = idOf(e); if (id) equip(id); },
    contextmenu(e) {
      const id = idOf(e); if (!id) return;
      e.preventDefault();
      if (!isLongPress(e)) act(id, planner.unequipMutagen);
    },
    keydown(e) {
      const id = idOf(e); if (!id) return;
      const action = { "Enter": select, "Delete": planner.unequipMutagen, "Backspace": planner.unequipMutagen }[e.key];
      if (action) { e.preventDefault(); act(id, action); }
    },
    // Space equips the focused mutagen, else the selection when the inventory frames it.
    hotkey(e) {
      if (e.key !== " ") return false;
      const g = keyTarget(el, ".gitem[data-mutagen]",
        () => kind.selected(state) && kind.framedInPanel(state, kind.selected(state)) ? itemEl(kind.selected(state)) : null);
      if (g) equip(g.dataset.mutagen);
      return !!g;
    },
    liftView: id => ({ item: itemView(mutagens[id]) }),
    icon: id => mutagenIcon(mutagens[id].color, mutagens[id].size),
    focus: focusItem,
    panel() {
      // Search matches (ui/search.js) are framed; the lifted copy in apply mode isn't.
      const found = app.found().mutagen;
      const items = Object.values(mutagens).map(m => ({ ...itemView(m), found: found.has(m.id) }));
      return { bg: MUTAGEN_ART_TAB, title: "Mutagens", items };
    }
  };
}
