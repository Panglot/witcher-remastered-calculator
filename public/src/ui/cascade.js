// Cascade removal (the removal setting, settings.js) shown in a panel of removable items (the skill
// tree, the Mutations panel):
// - a preview: with the setting on, what removing the hovered item (else the selected one) would
//   take with it gets a faint black mask (class "doomed" on the item, styles.css .gcascade-mask);
// - the removal: the items a cascade took have their lit background fade out, as if the light went
//   off (the panel draws its `fading` items with a ghost of that background, styles.css .gfade).
// The panel puts cls(id) and fading(id) in its items' views, and calls refresh() after changing the
// selection in place and took(r) with a removal's result before redrawing.
import { trackHover } from "./dom.js";

/**
 * @param {{ el: Element, selector: string, idOf: (item: Element) => string, on: () => boolean,
 *   takes: (id: string) => string[], selected: () => (string|null) }} o
 *   el: the panel; selector: its items; takes(id): what removing id would take with it
 */
export function createCascade({ el, selector, idOf, on, takes, selected }) {
  let hovered = null;
  // Items whose background is fading out, until the fade ends (so a redraw doesn't play it again).
  let fading = new Set();

  const doomed = () => {
    const id = hovered || selected();
    return new Set(on() && id ? takes(id) : []);
  };
  function refresh() {
    const set = doomed();
    el.querySelectorAll(selector).forEach(item => item.classList.toggle("doomed", set.has(idOf(item))));
  }

  trackHover(el, selector, idOf, id => { hovered = id; refresh(); });
  el.addEventListener("animationend", e => { if (e.animationName === "gfade-out") fading = new Set(); });

  // For a redraw: one call gives every item's state, read from the same preview.
  function view() {
    const set = doomed();
    return { cls: id => set.has(id) ? "doomed" : "", fading: id => fading.has(id) };
  }

  return {
    view,
    refresh,
    // A removal's result: a cascade (more than the item itself went) fades what it took.
    took(r) { fading = new Set(r && r.removed && r.removed.length > 1 ? r.removed : []); }
  };
}
