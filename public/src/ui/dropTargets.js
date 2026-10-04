// The game's drop targets (SlotsTransferManager.highlightDropTargets): while a skill or mutagen
// that can be equipped is under the pointer or the keyboard focus, the holders of its kind it could
// go into show a yellow frame (pieces "gdrop", class "drop" in styles.css). Which holders is a slot
// rule (core/slotKinds.js, dropTargets). Off in apply mode. The slots panel draws them (ui/slots.js).
// Any part can be a source: it carries data-drag (its slot kind) and data-drag-item (the item id),
// and a holder also data-drag-from (its index), so it doesn't light itself. While an item is
// dragged (ui/drag.js, app.drag) its targets stay lit wherever the pointer goes.
import { $ } from "./dom.js";

const SELECTOR = "[data-drag]";

export function createDropTargets(app) {
  const screen = $("screen");
  // The hovered source: the panel holding it (it outlives redraws) and the part's key, so a
  // redraw (a point added, a tab opened) finds it again.
  let source = null;

  function keyOf(part) {
    const { dragItem, dragFrom } = part.dataset;
    return `[data-drag-item="${CSS.escape(dragItem)}"]` + (dragFrom == null ? ":not([data-drag-from])" : `[data-drag-from="${dragFrom}"]`);
  }
  function follow(part) {
    const next = part && { panel: part.closest("[data-panel]"), key: keyOf(part) };
    if (next ? source && next.panel === source.panel && next.key === source.key : !source) return;
    source = next;
    app.views.slots.showDrop();
  }

  screen.addEventListener("pointerover", e => follow(e.target.closest(SELECTOR)));
  screen.addEventListener("pointerleave", () => follow(null));
  screen.addEventListener("focusin", e => follow(e.target.closest(SELECTOR)));
  screen.addEventListener("focusout", e => { if (!screen.contains(e.relatedTarget)) follow(null); });

  /** The holders lit now: { kind, at: holder indexes }, or null. */
  function targets() {
    if (app.drag) {
      const { kind, id, from } = app.drag;
      return { kind, at: app.kinds[kind].dropTargets(app.state, id, from) };
    }
    const part = !app.apply && source && source.panel && source.panel.querySelector(source.key);
    if (!part) return null;
    const { drag: kind, dragItem: id, dragFrom } = part.dataset;
    return { kind, at: app.kinds[kind].dropTargets(app.state, id, dragFrom == null ? null : +dragFrom) };
  }

  return { targets };
}
