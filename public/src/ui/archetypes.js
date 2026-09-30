// Archetype chips: toggling one highlights its skills in the tree.
import { $ } from "./dom.js";

export function mountArchetypes(app) {
  const { catalog, planner, state } = app;
  const el = $("archChips");

  el.addEventListener("click", e => {
    const c = e.target.closest("[data-arch]"); if (!c) return;
    const id = c.dataset.arch;
    state.arch = state.arch.includes(id) ? state.arch.filter(x => x !== id) : state.arch.concat(id);
    app.render();
  });

  function render() {
    el.innerHTML = catalog.archetypes.map(a => {
      const invested = a.ids.filter(i => planner.rank(state, i) > 0).length;
      return `<button type="button" class="chip" data-arch="${a.id}" aria-pressed="${state.arch.includes(a.id)}"><span class="dot" style="background:${catalog.trees[a.tree].color}"></span>${a.name}<span class="cnt num">${invested}/${a.ids.length}</span></button>`;
    }).join("");
  }

  return { render };
}
