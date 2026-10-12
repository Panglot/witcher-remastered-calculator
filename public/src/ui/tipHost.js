// A game-style tooltip host: one tooltip element over an area that follows the pointer, or the
// keyboard focus, onto any part of the area with one of the given data attributes, and sits at that
// part's bottom-right corner like the game's (flipped left or above when it would leave the area).
// The corner is its hit box's (.ghit) when it has one, not its art's, whose glow reaches far past it.
// With no room on either side (a phone) it sits centred under the part, or over it, as wide as the
// area at most (.fill).
// The planner screen has one (ui/tooltip.js), the Esc menu another (ui/menu.js).
//
// kinds: { [name]: part => html } by data attribute (data-<name>), first match wins.
// places: data attributes, by dataset name, that tell apart parts with the same tooltip (two empty
// sockets, two hints with the same text).
// shown: false hides the tooltip (no game art yet, an item being dragged).
// A part with data-tap-opens opens something on a tap (the orb with mutations): a touch on it, or the
// focus it keeps or gets back when what it opened closes, shows no tooltip, so none is left over it.
// The target is kept as its panel (the closest [data-panel], else the area) and a selector, so it
// outlives redraws of the part; render() rebuilds the tooltip for whatever is there now.

/**
 * @param {{ area: HTMLElement, el: HTMLElement, kinds: Record<string, (part: HTMLElement) => string>,
 *   places?: string[], shown?: () => boolean }} o
 */
export function createTipHost({ area, el, kinds, places = [], shown = () => true }) {
  const SELECTOR = Object.keys(kinds).map(k => `[data-${k}]`).join(", ");
  const kindOf = part => Object.keys(kinds).find(k => k in part.dataset);
  let target = null;
  // A dataset name as its attribute: hintTitle -> data-hint-title.
  const attr = name => `data-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;

  function keyOf(part) {
    const k = kindOf(part);
    return `[${attr(k)}="${CSS.escape(part.dataset[k])}"]`
      + places.filter(a => part.dataset[a] != null).map(a => `[${attr(a)}="${CSS.escape(part.dataset[a])}"]`).join("");
  }

  function follow(part) {
    const next = part && { panel: part.closest("[data-panel]") || area, key: keyOf(part) };
    if (next ? target && next.panel === target.panel && next.key === target.key : !target) return;
    target = next; render();
  }

  // Whether the last pointer was a touch, till a key is pressed.
  let touch = false;
  const quiet = part => part && touch && "tapOpens" in part.dataset ? null : part;
  area.addEventListener("pointerover", e => { touch = e.pointerType === "touch"; follow(quiet(e.target.closest(SELECTOR))); });
  area.addEventListener("pointerleave", () => follow(null));
  document.addEventListener("keydown", () => { touch = false; }, true);
  area.addEventListener("focusin", e => follow(quiet(e.target.closest(SELECTOR))));
  area.addEventListener("focusout", e => { if (!area.contains(e.relatedTarget)) follow(null); });

  function place(part) {
    const s = area.getBoundingClientRect(), r = (part.querySelector(".ghit") || part).getBoundingClientRect();
    el.style.width = "";
    el.classList.toggle("fill", el.offsetWidth > s.width);
    if (el.offsetWidth > s.width) el.style.width = `${s.width}px`;
    const w = el.offsetWidth, h = el.offsetHeight;
    // The part in the area's coordinates, and the bottom it may not pass: the area's or the window's.
    const x0 = r.left - s.left, x1 = r.right - s.left, y0 = r.top - s.top, y1 = r.bottom - s.top;
    const bottom = Math.min(s.bottom, window.innerHeight) - s.top;
    let left, top;
    if (x1 + w <= s.width || x0 - w >= 0) {
      left = x1 + w <= s.width ? x1 : x0 - w;
      top = y1 + h > bottom ? y0 - h : y1;
    } else {
      left = Math.min(Math.max(0, (x0 + x1 - w) / 2), s.width - w);
      // Under, else over, else on the side with more room.
      top = y1 + h <= bottom ? y1 : y0 - h >= 0 ? y0 - h : bottom - y1 >= y0 ? y1 : y0 - h;
    }
    el.style.left = `${Math.max(0, left)}px`;
    el.style.top = `${Math.max(0, top)}px`;
  }

  function render() {
    const part = shown() && target && target.panel && target.panel.querySelector(target.key);
    if (!part) { el.hidden = true; return; }
    el.innerHTML = kinds[kindOf(part)](part);
    el.hidden = false;
    place(part);
  }

  return { render };
}
