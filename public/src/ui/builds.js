// The Builds panel: a side panel (ui/sidePanel.js) over the slots, like Skill sets, toggled with B
// or the legend's Builds. It lists the creator's builds (data/builds.js, decoded by core/catalog.js):
// each row is the build's name, then its points spent, over a bonus label bar per tree in its colour,
// each as wide as that tree's share of the slotted skills. Pressing one loads it the way a pasted code loads
// (ui/share.js): over a non-empty build it asks first, and the result shows as a toast. A loaded
// build closes the panel, so its slots come into view.
import { $ } from "./dom.js";
import { createSidePanel, buttonRows, note } from "./sidePanel.js";
import { createBuildShare } from "./share.js";
import { reportResult } from "./buildTools.js";
import { TREE_ART } from "./gameArt.js";

export function mountBuilds(app) {
  const { builds } = app.catalog;
  const share = createBuildShare(app);
  // Set while a build loads (its popup may be up), so a second press doesn't start another.
  let loading = false;

  async function load(i) {
    if (loading || !builds[i]) return;
    loading = true;
    const result = await share.load(builds[i].code, "the build");
    loading = false;
    reportResult(app, result);
    if (result.ok) panel.close();
  }

  const rows = () => buttonRows(builds.map((b, i) => ({
    label: b.name || "Unnamed build", end: { label: "Points", value: String(b.points) }, attrs: ` data-build="${i}"`,
    mix: Object.entries(b.slotted).map(([tree, n]) => ({ color: TREE_ART[tree].color, share: n }))
  })));

  const panel = createSidePanel(app, {
    name: "builds", title: "Builds", area: "slots", cover: $("slotsPanel"), key: "b",
    titleHint: "These are builds made by the creator. In no way they are supposed to be meta or most optimal.",
    mount(body) {
      body.addEventListener("click", e => {
        const b = e.target.closest("[data-build]");
        if (b) load(+b.dataset.build);
      });
    },
    markup: () => builds.length ? rows() : note("No builds yet.")
  });

  return panel;
}
