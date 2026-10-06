// The Skill sets panel: a side panel (ui/sidePanel.js) over the slots, toggled with S or the arrow
// under the slots, so the tree stays visible while picking. One section per tree lists the sets
// shown under it (data/skillSets.js); pressing one toggles its highlight, which frames its skills
// in the tree (ui/tree.js) and names the set in their tooltips (ui/tooltip.js).
// Over the sections: two switch rows like the settings' (name, value, slider): highlight the skills
// of every selected set or only those in all of them, and name in tooltips only the selected sets
// or every set a skill is in. Both are viewer settings (settings.js), not part of the build. Then
// how many sets are selected, with a Clear button.
import { $ } from "./dom.js";
import { createSidePanel, section, statRows, switchRows } from "./sidePanel.js";
import { bindOptionRows, bindOptionKeys } from "./options.js";
import { TREE_ART } from "./gameArt.js";

const SWITCHES = [
  {
    key: "skillSetsMatchAll", label: "Matching sets",
    hint: "All highlights the skills of every selected set.\nCombination highlights only skills that match the combination of all selected sets.",
    choices: [{ value: false, label: "All" }, { value: true, label: "Combination" }]
  },
  {
    key: "skillSetsInTooltip", label: "Tooltip display",
    hint: "Selected shows set tooltips only on skills in an active set.\nAlways shows set tooltips on every skill.",
    choices: [{ value: false, label: "Selected" }, { value: true, label: "Always" }]
  }
];

export function mountSkillSets(app) {
  const { catalog, planner, state } = app;
  let switches = null;

  function treeSection(t) {
    const list = catalog.skillSets.filter(s => s.tree === t);
    if (!list.length) return "";
    const rows = list.map(s => ({
      value: `${s.ids.filter(i => planner.rank(state, i) > 0).length}/${s.ids.length}`,
      label: s.name, attrs: ` data-skill-set="${s.id}"`, pressed: state.skillSets.includes(s.id)
    }));
    const { color, stat } = TREE_ART[t];
    return section({ id: t, title: catalog.trees[t].name, color, icon: stat, open: panel.sectionOpen(t), body: statRows(rows) });
  }

  // Static, so the switches keep focus and their thumbs: the switches, then how many sets are
  // selected and a button that clears them (render() fills both), right over the sets.
  const head = `<div class="gside-overview">
    ${switchRows(SWITCHES)}
    <div class="gside-status">${statRows([{ value: "0", label: "Sets selected" }])}
      <button type="button" class="gpopup-btn gside-action" data-skill-set-clear disabled>Clear</button></div>
  </div>`;

  const panel = createSidePanel(app, {
    name: "skillSets", title: "Skill sets", area: "slots", cover: $("slotsPanel"), key: "s",
    hint: "Highlight the skills of a skill set in the tree.",
    head,
    mount(body) {
      body.addEventListener("click", e => {
        if (e.target.closest("[data-skill-set-clear]")) { state.skillSets = []; app.render(); return; }
        const b = e.target.closest("[data-skill-set]");
        if (!b) return;
        const id = b.dataset.skillSet;
        state.skillSets = state.skillSets.includes(id) ? state.skillSets.filter(x => x !== id) : state.skillSets.concat(id);
        // The redraw updates the row in place (sidePanel.js), so it keeps focus.
        app.render();
      });
      const modes = body.querySelector(".gside-modes");
      switches = bindOptionRows(modes, SWITCHES, {
        get: key => app.settings[key],
        set: (key, value) => { app.setSetting(key, value); app.render(); }
      });
      bindOptionKeys(modes, switches);
    },
    markup: () => catalog.order.map(treeSection).join("")
  });

  function render() {
    const { body } = panel, picked = state.skillSets.length;
    body.querySelector(".gside-status .gstat-value").textContent = String(picked);
    body.querySelector("[data-skill-set-clear]").disabled = !picked;
    switches.redraw();
    panel.render();
  }

  return { ...panel, render };
}
