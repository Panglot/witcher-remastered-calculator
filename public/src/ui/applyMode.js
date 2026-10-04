// The game's apply mode (MenuCharacterDupe.startApplyMode, CharacterModeBackground): equipping a
// skill or mutagen first picks where it goes. The page darkens except the slot groups, the item
// is lifted over the mask, and the "Select slot" popup shows over the page's middle, like ui/popup.js.
// It starts on the kind's first empty holder (core/slotKinds.js, target). In the slot groups a
// click picks another holder of that kind and a double-click fills it (ui/slots.js); E, Space or
// Accept fill the picked one; Escape, the right mouse button or Cancel back out. It is a modal
// layer (ui/layers.js) that keeps the slot groups usable: the rest of the page is inert, the
// planner's other keys do nothing and Tab is held, so focus stays on the picked holder.
import { $ } from "./dom.js";
import { VIEWS } from "./gamePanels.js";
import { CONFIRM_KEYS, CONFIRM_LABELS } from "./popup.js";

const TITLE = "Select slot";
const TEXT = "Only slotted skills and mutagens are active.";
const BUTTONS = [
  { key: CONFIRM_KEYS.accept, label: CONFIRM_LABELS.accept, action: "accept", tone: "accept" },
  { key: CONFIRM_KEYS.cancel, label: CONFIRM_LABELS.cancel, action: "cancel", tone: "cancel" }
];
// Keys that fill the picked holder, and keys kept from the browser while apply mode is on.
const ACCEPT_KEYS = new Set(["e", " "]);
const HELD_KEYS = new Set(["e", " ", "r", "tab"]);

export function mountApplyMode(app) {
  const { state, kinds } = app;
  const page = $("pagePlanner"), slots = $("slotsPanel"), mask = $("applyMask"), lift = $("applyLift"), popup = $("applyPopup");
  let drawn = "";
  const layer = {
    name: "apply", modal: true,
    // The slot groups stay usable over the mask, with the popup and the lifted item.
    live: () => [slots, mask, lift, popup],
    keys(e) {
      const key = e.key.toLowerCase();
      if (!e.repeat && ACCEPT_KEYS.has(key)) accept();
      return HELD_KEYS.has(key);
    },
    escape: () => cancel()
  };

  /** Starts equipping an item of a kind ("skill" or "mutagen"); false if it can't be equipped. */
  function start(kind, id) {
    if (app.apply || !kinds[kind].canEquip(state, id)) return false;
    app.apply = { kind, id, at: kinds[kind].target(state, id) };
    app.layers.open(layer);
    app.msg = ""; app.render();
    app.views.slots.focus(kind, app.apply.at);
    return true;
  }
  /** Picks the holder to fill. */
  function aim(i) { if (app.apply) app.apply.at = i; }
  /** Fills holder i (default: the picked one) and ends. */
  function accept(i = app.apply.at) {
    const { kind, id } = app.apply;
    app.msg = kinds[kind].equip(state, id, i).msg;
    end(kind, id);
  }
  function cancel() { const { kind, id } = app.apply; app.msg = ""; end(kind, id); }
  // Like the game, focus goes back to the item in the tree panel.
  function end(kind, id) {
    app.apply = null; app.layers.close(layer); app.render();
    app.views.tree.focus(kind, id);
  }

  popup.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (b && app.apply) (b.dataset.action === "accept" ? accept : cancel)();
  });

  function render() {
    const on = !!(app.apply && app.game);
    page.classList.toggle("applying", on);
    [mask, lift, popup].forEach(el => { el.hidden = !on; });
    if (!on) { drawn = ""; return; }
    // Drawn once per item, so the lift and fade run once.
    const key = `${app.apply.kind}:${app.apply.id}`;
    if (drawn === key) return;
    drawn = key;
    lift.innerHTML = app.game.panels.svg(VIEWS.tree, app.game.panels.treePanelLift(app.views.tree.liftView(app.apply.kind, app.apply.id)));
    popup.innerHTML = app.game.panels.popup({ title: TITLE, text: TEXT, buttons: BUTTONS });
  }

  return { render, start, aim, accept, cancel };
}
