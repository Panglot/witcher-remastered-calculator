export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Sets an input's value unless the user is typing in it.
export function syncInput(el, value) {
  if (document.activeElement !== el) el.value = value;
}

// Native controls keep their own key behaviour (Space and Enter press a button or follow a link).
const NATIVE_CONTROLS = "a[href], button, summary";
const onNativeControl = e => !!(e.target.closest && e.target.closest(NATIVE_CONTROLS));

// A page-wide key press for the planner (R, E, Space, Escape): no modifier, not typing in a field,
// no popup open (ui/popup.js), and the page holding `el` is shown.
export function isHotkey(e, el) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable], dialog")) return false;
  if (document.querySelector("dialog[open]")) return false;
  return !el.closest("[data-page]").hidden;
}

/**
 * Page-wide keys for `page`: one listener offers each press to the handlers in turn until one
 * takes it (returns true), so a key never acts twice. `first` handlers are asked before the rest.
 * @returns {{ add(handler: (e: KeyboardEvent) => boolean, first?: boolean): void }}
 */
export function createHotkeys(page) {
  const handlers = [];
  document.addEventListener("keydown", e => {
    if (!isHotkey(e, page) || (e.key === " " && onNativeControl(e))) return;
    if (handlers.some(h => h(e))) e.preventDefault();
  });
  return { add(h, first = false) { if (first) handlers.unshift(h); else handlers.push(h); } };
}

/**
 * What a page-wide key acts on in `panel`: its focused part matching `selector`, else `fallback()`
 * (the panel's selection). Null while a part of another panel has focus: that one takes the key.
 */
export function keyTarget(panel, selector, fallback) {
  const f = document.activeElement, owner = f && f.closest && f.closest("[data-panel]");
  if (owner && owner !== panel) return null;
  return (owner && f.closest(selector)) || fallback();
}

// Every key the planner reacts to: E, Space and R anywhere (ui/tree.js, slots.js, legend.js), the
// rest on a focused skill, mutagen or socket (ui/tree.js, ui/mutagenList.js, ui/slots.js).
export const PLANNER_KEYS = ["e", "r", " ", "Enter", "+", "=", "-", "Backspace", "Delete"];

// Blocks the browser's default for `keys` (e.g. Space scrolling the page) wherever they count as
// hotkeys for `el`'s page, even when nothing is focused to handle them.
export function blockKeyDefaults(el, keys) {
  const set = new Set(keys.map(k => k.toLowerCase()));
  document.addEventListener("keydown", e => {
    if (!set.has(e.key.toLowerCase()) || !isHotkey(e, el)) return;
    if (onNativeControl(e)) return;
    e.preventDefault();
  });
}
