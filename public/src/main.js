// Entry point: builds the catalog from the game data, loads saved state, and mounts each panel.
//
// Every panel (ui/*.js) is `mountX(app) -> { render }`: it wires its own events once and
// redraws from `app.state` on render(). Game rules live in core/ and never touch the DOM.
import data from "../data/index.js";
import { createCatalog } from "./core/catalog.js";
import { createPlanner } from "./core/planner.js";
import { loadState, saveState } from "./state.js";
import { mountSummary } from "./ui/summary.js";
import { mountTabs } from "./ui/tabs.js";
import { mountTree } from "./ui/tree.js";
import { mountDetail } from "./ui/detail.js";
import { mountSlots } from "./ui/slots.js";
import { mountArchetypes } from "./ui/archetypes.js";
import { mountShare } from "./ui/share.js";

const catalog = createCatalog(data);
catalog.problems.forEach(p => console.error(p));

const app = {
  catalog,
  planner: createPlanner(catalog),
  state: loadState(catalog),
  // Feedback for the last action (why a point couldn't be added, etc.), shown in the detail card.
  msg: "",
  views: {},
  save() { saveState(app.state); },
  render() {
    Object.values(app.views).forEach(v => v.render());
    app.save();
  },
  select(id) {
    app.state.sel = id; app.state.tab = catalog.nodes[id].tree; app.msg = "";
    app.render();
  }
};

// Render order follows this list.
app.views = {
  summary: mountSummary(app),
  tabs: mountTabs(app),
  tree: mountTree(app),
  detail: mountDetail(app),
  slots: mountSlots(app),
  archetypes: mountArchetypes(app),
  share: mountShare(app)
};

app.render();
