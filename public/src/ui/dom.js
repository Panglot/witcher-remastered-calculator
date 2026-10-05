export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Sets an input's value unless the user is typing in it.
export function syncInput(el, value) {
  if (document.activeElement !== el) el.value = value;
}

// A contextmenu event from a touch or pen long-press, not the right mouse button. It is never a
// right-click: the long press is the hold (ui/hold.js), and depending on the system it fires
// mid-hold (Android) or on release, after the hold has acted (Windows). Touch has the legend's
// buttons instead (ui/legend.js).
export const isLongPress = e => e.pointerType === "touch" || e.pointerType === "pen";

// A touch screen as the main input: the same query as the touch rules in styles.css.
export const isTouchScreen = () => window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// Brings el's children in line with `html` in place: a node of the same kind as the new one is kept
// and given its attributes and text, any other is replaced. Unlike innerHTML, what didn't change
// stays the same element, so a redraw keeps focus, scroll and the element just tapped (a removed
// one can move the page on phones).
export function patchHtml(el, html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  patchChildren(el, t.content);
}
function patchChildren(el, next) {
  const want = [...next.childNodes];
  want.forEach((n, i) => {
    const have = el.childNodes[i];
    if (!have) el.append(n);
    else if (have.nodeType === n.nodeType && have.nodeName === n.nodeName) patchNode(have, n);
    else el.replaceChild(n, have);
  });
  while (el.childNodes.length > want.length) el.lastChild.remove();
}
function patchNode(have, n) {
  if (n.nodeType !== Node.ELEMENT_NODE) { if (have.nodeValue !== n.nodeValue) have.nodeValue = n.nodeValue; return; }
  for (const a of [...have.attributes]) if (!n.hasAttributeNS(a.namespaceURI, a.localName)) have.removeAttributeNS(a.namespaceURI, a.localName);
  for (const a of n.attributes) if (have.getAttributeNS(a.namespaceURI, a.localName) !== a.value) have.setAttributeNS(a.namespaceURI, a.name, a.value);
  patchChildren(have, n);
}

// Native controls keep their own key behaviour (Space and Enter press a button or follow a link).
const NATIVE_CONTROLS = "a[href], button, summary";
const onNativeControl = e => !!(e.target.closest && e.target.closest(NATIVE_CONTROLS));

const hasModifier = e => e.ctrlKey || e.metaKey || e.altKey;
const isTyping = e => !!(e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"));

// A page-wide key press for the planner (R, E, Space): no modifier, not typing in a field.
const isHotkey = e => !hasModifier(e) && !isTyping(e);

/**
 * Page-wide keys. One listener routes each press:
 * 1. Escape goes to the layers (ui/layers.js), even from a field: the top layer backs out.
 * 2. Other keys go to the open layers, top first.
 * 3. With no modal layer open, the planner's handlers get it in turn until one takes it
 *    (returns true), so a key never acts twice. `first` handlers are asked before the rest.
 * Space on a button or link keeps its own meaning (it presses it) and goes to neither.
 * @param {ReturnType<import("./layers.js").createLayers>} layers
 * @returns {{ add(handler: (e: KeyboardEvent) => boolean, first?: boolean): void }}
 */
export function createHotkeys(layers) {
  const handlers = [];
  document.addEventListener("keydown", e => {
    if (hasModifier(e)) return;
    if (e.key === "Escape") {
      // Held down, it would back out of every layer in a row.
      if (e.repeat ? layers.top() : layers.escape()) e.preventDefault();
      return;
    }
    if (isTyping(e) || (e.key === " " && onNativeControl(e))) return;
    if (layers.key(e)) { e.preventDefault(); return; }
    if (layers.blocking() || !isHotkey(e)) return;
    if (handlers.some(h => h(e))) e.preventDefault();
  });
  return { add(h, first = false) { if (first) handlers.unshift(h); else handlers.push(h); } };
}

/**
 * What a page-wide key acts on in `panel`: its focused part matching `selector`, else `fallback()`
 * (the panel's selection). Null while a part of another panel has focus (that one takes the key)
 * or while the panel is inert (a side panel covers it, ui/sidePanel.js).
 */
export function keyTarget(panel, selector, fallback) {
  if (panel.inert) return null;
  const f = document.activeElement, owner = f && f.closest && f.closest("[data-panel]");
  if (owner && owner !== panel) return null;
  return (owner && f.closest(selector)) || fallback();
}

// Every key the planner reacts to: E, Space and R anywhere (ui/tree.js, slots.js, legend.js), the
// rest on a focused skill, mutagen or socket (ui/tree.js, ui/mutagenList.js, ui/slots.js).
export const PLANNER_KEYS = ["e", "r", " ", "Enter", "+", "=", "-", "Backspace", "Delete"];

// Blocks the browser's default for `keys` (e.g. Space scrolling the page) wherever they count as
// hotkeys, even when nothing is focused to handle them.
export function blockKeyDefaults(keys) {
  const set = new Set(keys.map(k => k.toLowerCase()));
  document.addEventListener("keydown", e => {
    if (!set.has(e.key.toLowerCase()) || !isHotkey(e)) return;
    if (onNativeControl(e)) return;
    e.preventDefault();
  });
}
