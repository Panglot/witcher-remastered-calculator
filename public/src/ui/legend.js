// Key legend under the planner screen, in the game's style. Like the game, it lists the controls
// for what is selected: the open tab, then the selected skill's state or the socket / diamond that
// frames the selection. "Reset abilities" is a button and the R key, both asking first in the
// game's message popup (ui/popup.js). Apply mode hides the legend while its popup is up.
import { $ } from "./dom.js";
import { confirmPopup } from "./popup.js";
import { MUTAGEN_TAB } from "../core/catalog.js";

const RESET = { key: "R", label: "Reset abilities", action: "reset" };
// Left button or E, held (ui/tree.js, ui/slots.js).
const ACQUIRE = { mouse: "left", key: "E", prefix: "[Hold]", label: "Acquire ability" };
// One mouse and one key per item at most: other ways in (drag, double-click to unequip) work unlisted.
const UNEQUIP = { mouse: "right", key: "Space", label: "Unequip" };
const EQUIP = { mouse: "left", clicks: 2, key: "Space", label: "Equip" };
const ITEMS = {
  unlearned: [RESET, ACQUIRE],
  learned: [RESET, ACQUIRE,
    { mouse: "right", label: "Remove point" },
    EQUIP],
  socket: [RESET, ACQUIRE, UNEQUIP],
  mutagens: [RESET, EQUIP,
    { mouse: "right", label: "Unequip" }],
  diamond: [RESET, UNEQUIP]
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

  el.addEventListener("click", e => { if (e.target.closest("[data-action='reset']")) reset(); });
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
