// Points summary bar: budget, spent/left, per-tree passives, clear buttons.
import { $, syncInput } from "./dom.js";
import { MUTAGEN_TAB } from "../core/catalog.js";

export function mountSummary(app) {
  const { catalog, planner, state } = app;

  $("budget").addEventListener("input", e => {
    const v = parseInt(e.target.value, 10);
    state.budget = isNaN(v) ? 0 : Math.max(0, v);
    // The budget feeds other views (points left, which skills can take a point), so redraw all.
    app.render();
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
    // Overspent reads as a shortfall: "Needed 2" rather than "Left -2".
    $("leftLabel").textContent = left < 0 ? "Needed" : "Left";
    $("left").textContent = Math.abs(left);
    $("left").classList.toggle("over", left < 0);
    // The Mutagens tab has no skills to clear.
    $("resetTree").disabled = state.tab === MUTAGEN_TAB;
    $("passives").innerHTML = catalog.order.map(t => {
      const T = catalog.trees[t];
      return `<span style="--tc:${T.color}">${T.passive.label} <b class="num">+${planner.passiveValue(state, t)}${T.passive.unit}</b></span>`;
    }).join("");
  }

  return { render };
}
