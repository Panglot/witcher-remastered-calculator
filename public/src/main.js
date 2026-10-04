// Entry point: builds the catalog from the game data, loads saved state, and mounts each panel.
//
// Every panel (ui/*.js) is `mountX(app) -> { render }`: it wires its own events once and
// redraws from `app.state` on render(). Game rules live in core/ and never touch the DOM.
// The Character-screen panels draw with the game art, so they wait for `app.game`.
import data from "../data/index.js";
import { createCatalog } from "./core/catalog.js";
import { createPlanner } from "./core/planner.js";
import { createSlotKinds } from "./core/slotKinds.js";
import { loadState, saveState } from "./state.js";
import { $, esc, blockKeyDefaults, createHotkeys, PLANNER_KEYS } from "./ui/dom.js";
import { loadArt } from "./ui/gameArt.js";
import { createPieces, glowFilters } from "./ui/gamePieces.js";
import { createPanels } from "./ui/gamePanels.js";
import { mountSummary } from "./ui/summary.js";
import { mountTree } from "./ui/tree.js";
import { mountPoints } from "./ui/points.js";
import { mountLegend } from "./ui/legend.js";
import { mountTooltip } from "./ui/tooltip.js";
import { mountSlots } from "./ui/slots.js";
import { mountApplyMode } from "./ui/applyMode.js";
import { createDropTargets } from "./ui/dropTargets.js";
import { mountDrag } from "./ui/drag.js";
import { mountArchetypes } from "./ui/archetypes.js";
import { mountShare } from "./ui/share.js";
import { mountPages } from "./ui/pages.js";
import { mountBackdrop } from "./ui/backdrop.js";
import { mountAssetDemo } from "./ui/assetDemo.js";

const catalog = createCatalog(data);
catalog.problems.forEach(p => console.error(p));

const planner = createPlanner(catalog);
const app = {
  catalog,
  planner,
  // Skills and mutagens as slot kinds: one set of slotting and selection rules for both.
  kinds: createSlotKinds(catalog, planner),
  state: loadState(catalog),
  // Feedback for the last action (why a point couldn't be added, etc.), shown in the tooltip.
  msg: "",
  // The item being equipped while apply mode is on (ui/applyMode.js), else null. Not saved.
  apply: null,
  // The item being dragged to a holder (ui/drag.js): { kind, id, from }, else null. Not saved.
  drag: null,
  // Page-wide planner keys; panels add their handlers.
  hotkeys: createHotkeys($("pagePlanner")),
  // Game art and its builders ({ art, pieces, panels }), set once loaded.
  game: null,
  views: {},
  save() { saveState(app.state); },
  // Redraws every view, or every view but `except` (a panel that changed itself in place).
  render(except = "") {
    Object.entries(app.views).forEach(([name, v]) => { if (name !== except) v.render(); });
    app.save();
  },
  // Selects a skill and opens its tree.
  select(id) {
    app.kinds.skill.select(app.state, id); app.msg = "";
    app.render();
  }
};

// Render order follows this list. Pages goes first so the others see which page is shown;
// the tooltip goes after the panels it points at.
app.views = {
  pages: mountPages(app),
  backdrop: mountBackdrop(app),
  summary: mountSummary(app),
  tree: mountTree(app),
  points: mountPoints(app),
  slots: mountSlots(app),
  apply: mountApplyMode(app),
  drag: mountDrag(app),
  legend: mountLegend(app),
  tooltip: mountTooltip(app),
  archetypes: mountArchetypes(app),
  share: mountShare(app),
  assetDemo: mountAssetDemo(app)
};

// The holders the hovered skill or mutagen could go into, drawn by the slots panel.
app.dropTargets = createDropTargets(app);

// The planner's keys never fall through to the browser (Space would scroll the page).
blockKeyDefaults($("pagePlanner"), PLANNER_KEYS);

app.render();

// Filters every game SVG references by id (the hover glow).
$("gameDefs").innerHTML = glowFilters();

loadArt().then(art => {
  const pieces = createPieces(art);
  app.game = { art, pieces, panels: createPanels(art, pieces) };
  app.render();
}).catch(err => {
  $("screen").insertAdjacentHTML("afterbegin", `<p class="bad-msg screen-error">Could not load the game art: ${esc(err.message)}</p>`);
});
