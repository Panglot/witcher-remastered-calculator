// A game-style tooltip host: one tooltip element over an area that follows the pointer, or the
// keyboard focus, onto any part of the area with one of the given data attributes, and sits at that
// part's bottom-right corner like the game's (flipped left or above when it would leave the area).
// The planner screen has one (ui/tooltip.js), the Esc menu another (ui/menu.js).
//
// kinds: { [name]: part => html } by data attribute (data-<name>), first match wins.
// places: data attributes, by dataset name, that tell apart parts with the same tooltip (two empty
// sockets, two hints with the same text).
// shown: false hides the tooltip (no game art yet, an item being dragged).
// dock: an element to dock the tooltip in instead (the Mutations panel's tall layout), else null: it runs
// across that element's width at its top or bottom edge, whichever is farther from the part, so it
// covers neither the part nor anything beside it.
// The target is kept as its panel (the closest [data-panel], else the area) and a selector, so it
// outlives redraws of the part; render() rebuilds the tooltip for whatever is there now.

/**
 * @param {{ area: HTMLElement, el: HTMLElement, kinds: Record<string, (part: HTMLElement) => string>,
 *   places?: string[], shown?: () => boolean, dock?: () => HTMLElement | null }} o
 */
export function createTipHost({ area, el, kinds, places = [], shown = () => true, dock = () => null }) {
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

  area.addEventListener("pointerover", e => follow(e.target.closest(SELECTOR)));
  area.addEventListener("pointerleave", () => follow(null));
  area.addEventListener("focusin", e => follow(e.target.closest(SELECTOR)));
  area.addEventListener("focusout", e => { if (!area.contains(e.relatedTarget)) follow(null); });

  function place(part) {
    const s = area.getBoundingClientRect(), r = part.getBoundingClientRect(), d = dock();
    el.classList.toggle("docked", !!d);
    if (d) {
      const v = d.getBoundingClientRect(), low = r.top + r.height / 2 > v.top + v.height / 2;
      el.style.left = `${v.left - s.left}px`;
      el.style.width = `${v.width}px`;
      el.style.top = `${(low ? v.top : v.bottom - el.offsetHeight) - s.top}px`;
      return;
    }
    el.style.width = "";
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = r.right - s.left + w > s.width ? r.left - s.left - w : r.right - s.left;
    // Flipped above the part when it would run past the bottom of the area or the window.
    const bottom = Math.min(s.bottom, window.innerHeight);
    const top = r.bottom + h > bottom ? r.top - h : r.bottom;
    el.style.left = `${Math.max(0, left)}px`;
    el.style.top = `${Math.max(0, top - s.top)}px`;
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
