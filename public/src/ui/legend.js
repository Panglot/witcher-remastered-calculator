// Key legend under the planner screen, in the game's style. Like the game, it lists the controls
// for what is selected: the open tab, then the selected skill's state or the socket / diamond that
// frames the selection, then the general controls in a group of their own. "Reset abilities" is a button and the R key, both asking first in the
// game's message popup (ui/popup.js). "Menu" opens the Esc menu (ui/menu.js), like Esc; "Statistics"
// toggles the Statistics panel (ui/statistics.js), like C; "Archetypes" the Archetypes panel
// (ui/archetypes.js), like A. Apply mode
// hides the legend while its popup is up.
import { $ } from "./dom.js";
import { confirmPopup } from "./popup.js";
import { MUTAGEN_TAB } from "../core/catalog.js";

const RESET = { key: "R", label: "Reset abilities", action: "reset" };
const MENU = { key: "Esc", label: "Menu", action: "menu" };
// The Statistics side panel (ui/statistics.js).
const STATS = { key: "C", label: "Statistics", action: "stats" };
// The Archetypes side panel (ui/archetypes.js).
const ARCH = { key: "A", label: "Archetypes", action: "archetypes" };
// Left button or E, held (ui/tree.js, ui/slots.js).
const ACQUIRE = { mouse: "left", key: "E", prefix: "[Hold]", label: "Acquire ability" };
// One mouse and one key per item at most: other ways in (drag, double-click to unequip) work unlisted.
const UNEQUIP = { mouse: "right", key: "Space", label: "Unequip" };
const EQUIP = { mouse: "left", clicks: 2, key: "Space", label: "Equip" };
// Two groups: the selection's skill controls (Reset abilities always last), then the general ones (Menu last).
const GENERAL = [STATS, ARCH, MENU];
const skillGroup = (...items) => [[...items, RESET], GENERAL];
const ITEMS = {
  unlearned: skillGroup(ACQUIRE),
  learned: skillGroup(ACQUIRE, { mouse: "right", label: "Remove point" }, EQUIP),
  socket: skillGroup(ACQUIRE, UNEQUIP),
  mutagens: skillGroup(EQUIP, { mouse: "right", label: "Unequip" }),
  diamond: skillGroup(UNEQUIP)
};

export function mountLegend(app) {
  const { planner, state, kinds } = app;
  const el = $("legend");
  let drawn = null, asking = false;

  function itemsFor() {
    if (state.tab === MUTAGEN_TAB) return kinds.mutagen.heldAt(state) != null ? ITEMS.diamond : ITEMS.mutagens;
    if (kinds.skill.heldAt(state) != null) return ITEMS.socket;
    return state.sel && planner.rank(state, state.sel) > 0 ? ITEMS.learned : ITEMS.unlearned;
  }

  async function reset() {
    if (asking || !app.game || (!Object.keys(state.pts).length && !state.mut.some(Boolean))) return;
    asking = true;
    const yes = await confirmPopup(app, {
      title: "Reset abilities",
      text: "Reset all abilities and refund spent skill points? All skills and mutagens will be unequipped."
    });
    asking = false;
    if (!yes) return;
    planner.clearAll(state);
    app.msg = ""; app.render();
  }

  el.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "reset") reset();
    else if (b.dataset.action === "menu") app.views.menu.open();
    else if (b.dataset.action === "stats") app.views.stats.toggle();
    else if (b.dataset.action === "archetypes") app.views.archetypes.toggle();
  });
  app.hotkeys.add(e => {
    if (e.repeat || e.key.toLowerCase() !== "r") return false;
    reset();
    return true;
  });

  // Redrawn only when the selection needs other items.
  function render() {
    const items = itemsFor();
    if (!app.game || drawn === items) return;
    el.innerHTML = app.game.panels.legend(items);
    drawn = items;
  }

  return { render };
}
