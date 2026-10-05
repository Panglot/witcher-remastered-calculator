// The Skill sets panel: a side panel (ui/sidePanel.js) over the slots,
// toggled with S or the arrow under the slots, so the tree stays visible while picking. One section
// per tree lists its skill sets; pressing one toggles its highlight, which frames its skills in
// the tree (ui/tree.js). The rows are placeholders until the buttons get their own design.
import { $ } from "./dom.js";
import { createSidePanel, section, statRows, note } from "./sidePanel.js";
import { TREE_ART } from "./gameArt.js";

export function mountSkillSets(app) {
  const { catalog, planner, state } = app;

  function treeSection(t) {
    const list = catalog.skillSets.filter(s => s.tree === t);
    if (!list.length) return "";
    const rows = list.map(s => ({
      value: `${s.ids.filter(i => planner.rank(state, i) > 0).length}/${s.ids.length}`,
      label: s.name, attrs: ` data-skill-set="${s.id}"`, pressed: state.skillSets.includes(s.id)
    }));
    const T = catalog.trees[t];
    const { color, stat } = TREE_ART[t];
    return section({ id: t, title: T.name, color, icon: stat, open: panel.sectionOpen(t), body: statRows(rows) });
  }

  const panel = createSidePanel(app, {
    name: "skillSets", title: "Skill sets", area: "slots", cover: $("slotsPanel"), key: "s",
    hint: "Highlight the skills of a skill set in the tree.",
    mount(body) {
      body.addEventListener("click", e => {
        const b = e.target.closest("[data-skill-set]");
        if (!b) return;
        const id = b.dataset.skillSet;
        state.skillSets = state.skillSets.includes(id) ? state.skillSets.filter(x => x !== id) : state.skillSets.concat(id);
        // The redraw updates the row in place (sidePanel.js), so it keeps focus.
        app.render();
      });
    },
    markup() {
      const picked = state.skillSets.length;
      const intro = picked
        ? `<div class="gside-overview">${note(`${picked} highlighted. Their skills are framed in the tree.`)}
           <button type="button" class="gside-link" data-skill-set-clear>Clear highlight</button></div>`
        : `<div class="gside-overview">${note("Pick a skill set to frame its skills in the tree. The count shows its skills with points.")}</div>`;
      return intro + catalog.order.map(treeSection).join("");
    }
  });

  panel.body.addEventListener("click", e => {
    if (!e.target.closest("[data-skill-set-clear]")) return;
    state.skillSets = [];
    app.render();
  });

  return panel;
}
