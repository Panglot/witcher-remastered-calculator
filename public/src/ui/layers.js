// The layer manager: one stack of everything open over the planner, so Esc, keys, focus and what
// stays usable work the same way for each. The newest layer is on top,
// whatever its kind.
//
// A layer is { name, modal, live?, keys?, escape? }:
// - modal: popups and the Esc menu. While one is the top modal layer, everything but its live()
//   elements is inert, the planner's page-wide keys are off, and the right mouse button backs out
//   of it like Esc (the game's B). Non-modal layers (side panels, a drag) only take part in the
//   key and Esc order; the page around them stays usable.
// - live(): the elements a modal layer keeps usable: its own, plus any part of the page it lifts
//   over its mask (apply mode's slots).
// - keys(e): offered each key press while open, top layer first; true if it took the key. A modal
//   layer that doesn't take a key still keeps it from the layers and planner keys below it.
// - escape(): what Esc does while it is on top (the menu going back from a submenu); by default
//   Esc closes it.
// Layers draw themselves (mask, frame, content). One appended to the page later sits above the
// earlier ones at the same z-index, so open order is also drawing order.
import { isLongPress } from "./dom.js";

/**
 * The stack on its own, with the page effects passed in (tests use fakes).
 * @param {{ setInert?: (live: Element[] | null) => void, focused?: () => (HTMLElement | null) }} [o]
 *   setInert: makes everything but `live` inert, or undoes it for null; focused: the focused element
 */
export function createLayers({ setInert = () => {}, focused = () => null } = {}) {
  const stack = [];
  // Where focus was when each layer opened; it goes back there when that layer closes on top.
  const before = new Map();
  let idleEscape = null;

  const top = () => stack[stack.length - 1] || null;
  const topModal = () => stack.findLast(l => l.modal) || null;
  function update() {
    const m = topModal();
    setInert(m ? (m.live ? m.live() : []) : null);
  }

  /** Puts a layer on top. Opening an open layer does nothing. */
  function open(layer) {
    if (stack.includes(layer)) return;
    before.set(layer, focused());
    stack.push(layer);
    update();
  }

  /** Takes a layer off the stack, wherever it is. Closing a closed layer does nothing. */
  function close(layer) {
    const i = stack.indexOf(layer);
    if (i < 0) return;
    const wasTop = i === stack.length - 1, el = before.get(layer);
    stack.splice(i, 1);
    before.delete(layer);
    update();
    if (wasTop && el && el.isConnected !== false && el.focus) el.focus({ preventScroll: true });
  }

  /** Esc: the top layer's escape(), else it closes; with nothing open, the idle action. True if something took it. */
  function escape() {
    const t = top();
    if (t) { if (t.escape) t.escape(); else close(t); return true; }
    return !!idleEscape && idleEscape() !== false;
  }

  /** The right mouse button: backs out of the top layer like Esc, if that layer is modal. True if it did. */
  function back() {
    const t = top();
    if (!t || !t.modal) return false;
    escape();
    return true;
  }

  /** Offers a key press (not Esc) to the layers, top first, down to the first modal one. True if one took it. */
  function key(e) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].keys && stack[i].keys(e)) return true;
      if (stack[i].modal) return false;
    }
    return false;
  }

  return {
    open, close, escape, back, key, top,
    /** True while a modal layer is open: the planner's own keys are off. */
    blocking: () => !!topModal(),
    isOpen: layer => stack.includes(layer),
    /** What Esc does with nothing open (opening the menu). Return false to leave the key alone. */
    onIdleEscape(fn) { idleEscape = fn; }
  };
}

/** The stack on the page: inert outside the top modal layer, focus given back, the right mouse button backing out. */
export function createPageLayers() {
  const layers = createLayers({ setInert: inertOutside(), focused: () => document.activeElement });
  // Under a modal layer the browser's menu never opens. A touch long-press also fires
  // contextmenu; it is no answer, so a slow tap doesn't back out.
  document.addEventListener("contextmenu", e => {
    if (!layers.blocking()) return;
    e.preventDefault();
    if (!isLongPress(e)) layers.back();
  });
  return layers;
}

// Makes everything inert except the live elements, their insides and their ancestors: at each
// level from a live element up to <body>, the siblings that hold no live element. Elements that
// were inert already are left alone, so undoing it (null) only clears what it set.
function inertOutside() {
  let set = [];
  return live => {
    set.forEach(el => { el.inert = false; });
    set = [];
    if (!live) return;
    const keep = new Set();
    live.forEach(el => { for (let a = el; a && a !== document.body; a = a.parentElement) keep.add(a); });
    keep.forEach(a => {
      for (const s of a.parentElement.children) {
        if (!keep.has(s) && !s.inert) { s.inert = true; set.push(s); }
      }
    });
  };
}
