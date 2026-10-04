// Drag to equip, like the game's SlotsTransferManager: press a skill or mutagen that can be
// equipped (any [data-drag] part, ui/dropTargets.js) and move the pointer past DRAG_PX to pick it
// up. Its icon follows the pointer and the holders it could go into stay lit (dropTargets.targets
// reads app.drag). Letting go on one of them puts it there (core/slotKinds.js, move): from the
// panel it is equipped, from another holder the two swap. Anywhere else it goes back.
// Picking it up ends any press-and-hold (ui/hold.js), so a hold and a drag never both act.
// While it lasts it is a non-modal layer (ui/layers.js) on top: Escape puts the item back and the
// planner's other keys do nothing. Off in apply mode.
import { $ } from "./dom.js";
import { artUrl } from "./gameArt.js";
import { cancelHolds } from "./hold.js";

// How far the pointer moves (CSS px) before a press becomes a drag; less stays a click or a hold.
const DRAG_PX = 6;

export function mountDrag(app) {
  const { state, kinds } = app;
  const screen = $("screen"), ghost = $("dragGhost");
  // The press that may become a drag, then the drag itself (also app.drag while it lasts).
  let press = null;
  const layer = { name: "drag", modal: false, keys: () => true, escape: () => end() };

  screen.addEventListener("pointerdown", e => {
    const part = e.target.closest("[data-drag]");
    if (!part || e.button !== 0 || app.apply) return;
    const { drag: kind, dragItem: id, dragFrom } = part.dataset;
    // Its size now: a hold that ends before the drag starts redraws the part.
    press = { kind, id, from: dragFrom == null ? null : +dragFrom, x: e.clientX, y: e.clientY, size: iconSize(part), pointer: e.pointerId };
  });
  document.addEventListener("pointermove", e => {
    if (!press || e.pointerId !== press.pointer) return;
    if (!app.drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
      // Re-checked on pick up: a hold may have just added the first point.
      if (!kinds[press.kind].canEquip(state, press.id)) { press = null; return; }
      pickUp();
    }
    moveGhost(e);
  });
  document.addEventListener("pointerup", e => { if (press && e.pointerId === press.pointer) drop(e); });
  document.addEventListener("pointercancel", e => { if (press && e.pointerId === press.pointer) end(); });
  window.addEventListener("blur", () => end());
  function pickUp() {
    cancelHolds();
    const { kind, id, from, size } = press;
    app.drag = { kind, id, from };
    app.reveal($("slotsPanel"));
    app.layers.open(layer);
    ghost.style.setProperty("--size", `${size}px`);
    ghost.innerHTML = `<img src="${artUrl(app.views.tree.icon(kind, id))}" alt="">`;
    ghost.hidden = false;
    document.documentElement.classList.add("dragging");
    app.views.slots.showDrop();
    app.views.tooltip.render();
  }
  function moveGhost(e) { ghost.style.translate = `${e.clientX}px ${e.clientY}px`; }

  function drop(e) {
    const drag = app.drag;
    if (!drag) { press = null; return; }
    const h = app.views.slots.holderAt(document.elementFromPoint(e.clientX, e.clientY));
    const into = h && h.name === drag.kind && kinds[drag.kind].dropTargets(state, drag.id, drag.from).includes(h.i);
    // The release fires a click on the common parent of where it started and ended; it is not one.
    swallowClick();
    end();
    if (!into) return;
    const kind = kinds[drag.kind];
    app.msg = kind.move(state, drag.id, drag.from, h.i).msg;
    kind.select(state, drag.id, h.i);
    app.render();
    app.views.slots.focus(drag.kind, h.i);
  }
  // Stops the click that follows this release (it comes right after pointerup, if at all).
  function swallowClick() {
    const stop = ev => ev.stopPropagation();
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }));
  }

  function end() {
    press = null;
    if (!app.drag) return;
    app.drag = null;
    app.layers.close(layer);
    ghost.hidden = true; ghost.innerHTML = "";
    document.documentElement.classList.remove("dragging");
    app.views.slots.showDrop();
    app.views.tooltip.render();
  }

  return { render() {} };
}

// The part's icon width on screen (CSS px). The icon is the image after its glow copy
// (gamePieces.js, glowable), drawn inside the part's hit area (a skill's sits 4px in from the
// socket). Measured through its screen matrix, not its box, so a turned icon keeps its own size.
function iconSize(part) {
  const icon = part.querySelector(".gglow + image");
  if (!icon) return (part.querySelector(".ghit") || part).getBoundingClientRect().width;
  const { a, b } = icon.getScreenCTM();
  return icon.width.baseVal.value * Math.hypot(a, b);
}
