// The Statistics panel (docs/roadmap.md, item 3): a side panel (ui/sidePanel.js) over the tree
// panel and its tabs, toggled with C or the arrow above POINTS AVAILABLE, which stays visible and
// stays the one field that sets the points. It shows what the build adds up to (core/stats.js):
// first the build name and points with no header, then one section per tree in its colour.
// Skill effects and summed bonuses come with the per-rank skill data (item 1); until then those
// parts are placeholders.
import { $, syncInput } from "./dom.js";
import { createSidePanel, section, statRows, subhead, note } from "./sidePanel.js";
import { TREE_ART } from "./gameArt.js";
import { createStats } from "../core/stats.js";

// Slot groups as the screen lays them out (gamePanels.mutagenPanel).
const GROUP_NAMES = ["top left", "top right", "bottom left", "bottom right"];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const signed = (v, unit) => `+${v}${unit}`;

export function mountStatistics(app) {
  const { catalog, planner, state } = app;
  const stats = createStats(catalog, planner);
  const { maxRank } = catalog;
  const rankOf = s => `${s.rank}/${maxRank}`;

  const head = `<label class="gside-field">Build name
    <input id="statsName" type="text" maxlength="60" placeholder="Unnamed build" autocomplete="off" spellcheck="false">
  </label>`;

  function overview(s) {
    const { total, spent, left } = s.points;
    let html = statRows([
      { value: String(total), label: "Total points" },
      { value: String(spent), label: "Points spent" },
      { value: String(Math.abs(left)), label: left < 0 ? "Points needed" : "Points available" }
    ]);
    if (s.unslotted.length) {
      html += subhead("Not slotted") + statRows(s.unslotted.map(k => ({ value: rankOf(k), label: k.name })))
        + note("These skills have points but sit in no slot, so they do nothing.");
    }
    return `<div class="gside-overview">${html}</div>`;
  }

  function treeSection(t) {
    let body = "";
    if (t.mutagen) {
      body += subhead("Mutagens") + (t.mutagens.length
        ? statRows(t.mutagens.map(m => ({
          value: signed(m.value, m.unit),
          label: `${m.label}: ${m.name}, ${GROUP_NAMES[m.group] || `group ${m.group + 1}`}, ${plural(m.matches, "matching skill")}`
        })))
        : note(`No ${t.mutagen} mutagen equipped.`));
    }
    body += subhead("Active skills") + (t.slotted.length
      ? statRows(t.slotted.map(k => ({ value: rankOf(k), label: k.name })))
      : note(`No ${t.name.toLowerCase()} skills slotted.`));
    // Placeholder until the skill data has numbers per rank (docs/roadmap.md, item 1).
    body += subhead("Bonuses") + note("Skill effects will be added up here once the skill data is in.");
    const { color, stat } = TREE_ART[t.id];
    // The tree's passive bonus sits on the bar after the name, its spent points (if any) at the right end.
    const passive = `${signed(t.passive.value, t.passive.unit)} ${t.passive.label}`;
    const end = t.spent ? { text: String(t.spent), label: `${plural(t.spent, "point")} spent` } : undefined;
    return section({ id: t.id, title: t.name, color, icon: stat, aside: passive, end, open: panel.sectionOpen(t.id), body });
  }

  const panel = createSidePanel(app, {
    name: "stats", title: "Statistics", area: "tree", cover: $("treePanel"), key: "c",
    hint: "Points, mutagen bonuses and active skills of this build.",
    head,
    mount(body) {
      body.querySelector("#statsName").addEventListener("input", e => {
        state.name = e.target.value;
        app.save();
        app.views.menu.render();
      });
    },
    markup() {
      const s = stats.summary(state);
      return overview(s) + s.trees.map(treeSection).join("");
    }
  });

  function render() {
    syncInput(panel.body.querySelector("#statsName"), state.name || "");
    panel.render();
  }

  return { ...panel, render };
}
