// POINTS AVAILABLE under the tree: the points left to spend. The number is a field: typing a
// number sets your total points (the budget) so that this many are left.
import { $, syncInput } from "./dom.js";
import { VIEWS } from "./gamePanels.js";

// Height of the field in screen units; the layout's text box is much taller than the text.
const FIELD_H = 40;

export function mountPoints(app) {
  const { planner, state } = app;
  const el = $("points");
  let input = null, label = null;

  // The field shows how many are left, or when overspent how many are needed (without the minus).
  // Typing always sets how many are left.
  el.addEventListener("input", e => {
    if (e.target !== input) return;
    const v = parseInt(input.value, 10);
    state.budget = Math.max(0, (isNaN(v) ? 0 : v) + planner.spentAll(state));
    app.render();
  });

  // Draws the row once, then only updates the number, so typing keeps focus.
  function build() {
    const S = app.game.art.layout("screen").txfPointsValue;
    const { box: [x0, y0, x1] } = S.text, [, , , , tx, ty] = S.matrix;
    const field = `<foreignObject x="${tx + x0}" y="${ty + y0}" width="${x1 - x0}" height="${FIELD_H}">
      <input class="gpoints num" id="pointsLeft" type="number" inputmode="numeric" aria-label="Points available"></foreignObject>`;
    el.innerHTML = app.game.panels.svg(VIEWS.points, app.game.panels.pointsRow(field, { labelAttrs: ` id="pointsLabel"` }));
    input = $("pointsLeft");
    label = $("pointsLabel");
  }

  function render() {
    if (!app.game) return;
    if (!input) build();
    const left = state.budget - planner.spentAll(state);
    syncInput(input, Math.abs(left));
    input.classList.toggle("over", left < 0);
    label.textContent = app.game.panels.pointsLabel(left);
  }

  return { render };
}
