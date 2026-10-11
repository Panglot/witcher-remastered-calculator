// POINTS AVAILABLE under the tree: the points left to spend, or when overspent how many are
// needed, locked slots in use included (core/stats.js, points). Display only; the total (the
// budget) is set in the Statistics panel (ui/statistics.js).
import { $ } from "./dom.js";
import { VIEWS } from "./gamePanels.js";

export function mountPoints(app) {
  const { state } = app;
  const el = $("points");
  let drawn = null;

  function render() {
    if (!app.game) return;
    const { left } = app.stats.points(state, app.lockMode());
    const { panels } = app.game;
    const html = panels.svg(VIEWS.points, panels.pointsRow(left));
    if (html === drawn) return;
    el.innerHTML = html;
    drawn = html;
    panels.centerPointsRow(el);
  }

  // The row is centred by its drawn width, which changes once the game font is in.
  document.fonts.ready.then(() => app.game && app.game.panels.centerPointsRow(el));

  return { render };
}
