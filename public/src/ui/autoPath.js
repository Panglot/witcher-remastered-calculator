// Auto path in the skill tree (planner-only, not the game's): a locked skill can be learned with
// the skills on the shortest path to it (core/planner.js, pathTo and learnPath).
// - a preview: hovering a locked skill brings out its path, the locked skills on it (class "gpath"
//   on the node) and the closed lines between them (class "gpath" on the line, data-link "a>b");
// - the learning: trying to learn a locked skill learns its path at once (ui/tree.js); a
//   cascade removal of the first skill on it takes it back.
// The tree puts node(id) and link(a, b) from view() in its nodes' and lines' views.
import { trackHover } from "./dom.js";

/**
 * @param {{ el: Element, path: (id: string) => string[] }} o
 *   el: the tree panel; path(id): the hovered skill's path (pathTo), [] for none
 */
export function createAutoPath({ el, path }) {
  let hovered = null;

  // The hovered skill's path: its skills, and its links as "a>b", both ways (a tree with
  // twoWayLinks draws a line one way and a path may follow it the other).
  function preview() {
    const ids = hovered ? path(hovered) : [];
    return { skills: new Set(ids), links: new Set(ids.slice(1).flatMap((n, i) => [`${ids[i]}>${n}`, `${n}>${ids[i]}`])) };
  }
  function refresh() {
    const p = preview();
    el.querySelectorAll(".gnode[data-id]").forEach(g => g.classList.toggle("gpath", p.skills.has(g.dataset.id)));
    el.querySelectorAll(".gline[data-link]").forEach(l => l.classList.toggle("gpath", p.links.has(l.dataset.link)));
  }
  trackHover(el, ".gnode[data-id]", g => g.dataset.id, id => { hovered = id; refresh(); });

  // For a redraw: one call gives every node's and line's class, read from the same preview.
  function view() {
    const p = preview();
    return { node: id => p.skills.has(id) ? "gpath" : "", link: (a, b) => p.links.has(`${a}>${b}`) ? "gpath" : "" };
  }

  return { view };
}
