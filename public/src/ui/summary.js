// Points summary bar: budget, spent/left, per-tree passives, clear buttons.
import { $, syncInput } from "./dom.js";

export function mountSummary(app) {
  const { catalog, planner, state } = app;

  $("budget").addEventListener("input", e => {
    const v = parseInt(e.target.value, 10);
    state.budget = isNaN(v) ? 0 : Math.max(0, v);
    app.views.summary.render(); app.save();
  });
  $("resetTree").addEventListener("click", () => {
    planner.clearTree(state, state.tab);
    app.msg = ""; app.render();
  });
  $("resetAll").addEventListener("click", () => {
    planner.clearAll(state);
    state.arch = [];
    app.msg = ""; app.render();
  });

  function render() {
    syncInput($("budget"), state.budget);
    const spent = planner.spentAll(state), left = state.budget - spent;
    $("spent").textContent = spent;
    $("left").textContent = left;
    $("left").classList.toggle("over", left < 0);
    $("passives").innerHTML = catalog.order.map(t => {
      const T = catalog.trees[t];
      return `<span style="--tc:${T.color}">${T.passive.label} <b class="num">+${planner.passiveValue(state, t)}${T.passive.unit}</b></span>`;
    }).join("");
  }

  return { render };
}
