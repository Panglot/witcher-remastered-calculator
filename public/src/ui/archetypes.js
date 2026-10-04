// The Archetypes panel (docs/roadmap.md, item 4): a side panel (ui/sidePanel.js) over the slots,
// toggled with A or the arrow under the slots, so the tree stays visible while picking. One section
// per tree lists its archetypes; pressing one toggles its highlight, which frames its skills in
// the tree (ui/tree.js). The rows are placeholders until the buttons get their own design.
import { $ } from "./dom.js";
import { createSidePanel, section, statRows, note } from "./sidePanel.js";
import { TREE_ART } from "./gameArt.js";

export function mountArchetypes(app) {
  const { catalog, planner, state } = app;

  function treeSection(t) {
    const list = catalog.archetypes.filter(a => a.tree === t);
    if (!list.length) return "";
    const rows = list.map(a => ({
      value: `${a.ids.filter(i => planner.rank(state, i) > 0).length}/${a.ids.length}`,
      label: a.name, attrs: ` data-arch="${a.id}"`, pressed: state.arch.includes(a.id)
    }));
    const T = catalog.trees[t];
    const { color, stat } = TREE_ART[t];
    return section({ id: t, title: T.name, color, icon: stat, open: panel.sectionOpen(t), body: statRows(rows) });
  }

  const panel = createSidePanel(app, {
    name: "archetypes", title: "Archetypes", area: "slots", cover: $("slotsPanel"), key: "a",
    hint: "Highlight the skills of a play style in the tree.",
    mount(body) {
      body.addEventListener("click", e => {
        const b = e.target.closest("[data-arch]");
        if (!b) return;
        const id = b.dataset.arch;
        state.arch = state.arch.includes(id) ? state.arch.filter(x => x !== id) : state.arch.concat(id);
        app.render();
        // The redraw replaced the row; keep focus on it for the keyboard.
        const again = body.querySelector(`[data-arch="${id}"]`);
        if (again) again.focus({ preventScroll: true });
      });
    },
    markup() {
      const picked = state.arch.length;
      const intro = picked
        ? `<div class="gside-overview">${note(`${picked} highlighted. Their skills are framed in the tree.`)}
           <button type="button" class="gside-link" data-arch-clear>Clear highlight</button></div>`
        : `<div class="gside-overview">${note("Pick an archetype to frame its skills in the tree. The count shows its skills with points.")}</div>`;
      return intro + catalog.order.map(treeSection).join("");
    }
  });

  panel.body.addEventListener("click", e => {
    if (!e.target.closest("[data-arch-clear]")) return;
    state.arch = [];
    app.render();
  });

  return panel;
}
