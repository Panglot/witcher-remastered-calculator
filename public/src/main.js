// Entry point: builds the catalog from the game data, loads saved state, and mounts each panel.
//
// Every panel (ui/*.js) is `mountX(app) -> { render }`: it wires its own events once and
// redraws from `app.state` on render(). Game rules live in core/ and never touch the DOM.
// The Character-screen panels draw with the game art, so they wait for `app.game`.
import data from "../data/index.js";
import { createCatalog } from "./core/catalog.js";
import { createPlanner } from "./core/planner.js";
import { createSlotKinds } from "./core/slotKinds.js";
import { createSearch } from "./core/search.js";
import { loadState, saveState } from "./state.js";
import { loadSettings, saveSettings } from "./settings.js";
import { $, esc, blockKeyDefaults, createHotkeys, PLANNER_KEYS } from "./ui/dom.js";
import { loadArt } from "./ui/gameArt.js";
import { createPieces, glowFilters, stepDefs } from "./ui/gamePieces.js";
import { createPanels } from "./ui/gamePanels.js";
import { mountTree } from "./ui/tree.js";
import { mountPoints } from "./ui/points.js";
import { mountLegend } from "./ui/legend.js";
import { mountTooltip } from "./ui/tooltip.js";
import { mountSlots } from "./ui/slots.js";
import { mountApplyMode } from "./ui/applyMode.js";
import { createDropTargets } from "./ui/dropTargets.js";
import { createPageLayers } from "./ui/layers.js";
import { mountDrag } from "./ui/drag.js";
import { mountStatistics } from "./ui/statistics.js";
import { mountSkillSets } from "./ui/skillSets.js";
import { mountSearch } from "./ui/search.js";
import { createBuildShare } from "./ui/share.js";
import { mountMenu } from "./ui/menu.js";
import { mountBuildRail } from "./ui/buildRail.js";
import { mountBackdrop } from "./ui/backdrop.js";
import { statIconFilters } from "./ui/sidePanel.js";
import { createToaster } from "./ui/toast.js";
import { mountPageInfo } from "./ui/pageInfo.js";

const catalog = createCatalog(data);
catalog.problems.forEach(p => console.error(p));

const planner = createPlanner(catalog);
const layers = createPageLayers();
const search = createSearch(catalog);
const app = {
  catalog,
  planner,
  // Skills and mutagens as slot kinds: one set of slotting and selection rules for both.
  kinds: createSlotKinds(catalog, planner),
  state: loadState(catalog),
  // The skills and mutagens a search query matches (core/search.js), by default the open search's (ui/search.js).
  found: (query = app.state.search) => search.find(query),
  // Viewer settings, stored apart from the build (settings.js).
  settings: loadSettings(),
  // Feedback for the last action (why a point couldn't be added, etc.), shown in the tooltip.
  msg: "",
  // The item being equipped while apply mode is on (ui/applyMode.js), else null. Not saved.
  apply: null,
  // The item being dragged to a holder (ui/drag.js): { kind, id, from }, else null. Not saved.
  drag: null,
  // Everything open over the planner (popups, apply mode, a drag, the menu, side panels), top
  // first: Esc, keys, focus and inert go through it (ui/layers.js).
  layers,
  // Page-wide planner keys; panels add their handlers. Open layers get keys first.
  hotkeys: createHotkeys(layers),
  // Short messages at the bottom of the page that go away on their own: app.toast.show(text).
  toast: createToaster(),
  // Game art and its builders ({ art, pieces, panels }), set once loaded.
  game: null,
  views: {},
  save() { saveState(app.state); },
  saveSettings() { saveSettings(app.settings); },
  // Changes one setting, saves it and tells the views that react to it (settingChanged(key)).
  setSetting(key, value) {
    app.settings[key] = value;
    app.saveSettings();
    Object.values(app.views).forEach(v => { if (v.settingChanged) v.settingChanged(key); });
  },
  // Redraws every view, or every view but `except` (a panel that changed itself in place).
  render(except = "") {
    Object.entries(app.views).forEach(([name, v]) => { if (name !== except) v.render(); });
    app.save();
  },
  // Closes the side panels covering `el` (equipping needs the slots in view).
  reveal(el) {
    Object.values(app.views).forEach(v => { if (v.cover === el && v.close) v.close(); });
  },
  // Selects a skill and opens its tree.
  select(id) {
    app.kinds.skill.select(app.state, id); app.msg = "";
    app.render();
  }
};

// Render order follows this list: the tooltip goes after the panels it points at.
app.views = {
  backdrop: mountBackdrop(app),
  // The fan notice under the legend and the browser tab title (the build name).
  page: mountPageInfo(app),
  tree: mountTree(app),
  points: mountPoints(app),
  slots: mountSlots(app),
  // The share tools right of the slots, with Ctrl+C, Ctrl+V and Ctrl+S.
  rail: mountBuildRail(app),
  apply: mountApplyMode(app),
  drag: mountDrag(app),
  legend: mountLegend(app),
  // Side panels (C, S) over the tree and the slots.
  stats: mountStatistics(app),
  skillSets: mountSkillSets(app),
  // Ctrl+F and the legend's Search: frames the skills and mutagens a query matches.
  search: mountSearch(app),
  tooltip: mountTooltip(app),
  // The Esc menu; Esc with nothing open opens it.
  menu: mountMenu(app)
};

// The holders the hovered skill or mutagen could go into, drawn by the slots panel.
app.dropTargets = createDropTargets(app);

// The planner's keys never fall through to the browser (Space would scroll the page).
blockKeyDefaults(PLANNER_KEYS);

app.render();

// Filters every game SVG references by id (the hover glow, the stat icons' shield).
$("gameDefs").innerHTML = glowFilters() + statIconFilters() + stepDefs();

loadArt().then(art => {
  const pieces = createPieces(art);
  app.game = { art, pieces, panels: createPanels(art, pieces) };
  app.render();
  // A share link opened in the browser loads its build (asking first over a non-empty one).
  createBuildShare(app).loadFromAddress();
}).catch(err => {
  $("screen").insertAdjacentHTML("afterbegin", `<p class="bad-msg screen-error">Could not load the game art: ${esc(err.message)}</p>`);
});
