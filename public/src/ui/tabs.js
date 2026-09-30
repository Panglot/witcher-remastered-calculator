// Tree tabs above the board.
import { $ } from "./dom.js";

export function mountTabs(app) {
  const { catalog, planner, state } = app;

  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    state.tab = b.dataset.tab;
    if (!state.sel || catalog.nodes[state.sel].tree !== state.tab) state.sel = catalog.skillsIn(state.tab)[0].id;
    app.msg = ""; app.render();
  });

  function render() {
    $("tabs").innerHTML = catalog.order.map(t => {
      const T = catalog.trees[t];
      return `<button class="tab" role="tab" type="button" data-tab="${t}" aria-selected="${state.tab === t}" style="--tc:${T.color}">${T.name}<span class="n num">${planner.spentIn(state, t)}</span></button>`;
    }).join("");
  }

  return { render };
}
