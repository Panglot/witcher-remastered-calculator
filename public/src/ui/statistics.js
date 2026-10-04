// The Statistics panel: a side panel (ui/sidePanel.js) over the tree
// panel and its tabs, toggled with C or the arrow above POINTS AVAILABLE, which stays visible.
// Its Total points field is the one place that sets the points budget. It shows what the build adds up to (core/stats.js):
// first the build name and points with no header, then one section per tree in its colour.
// Skill effects and summed bonuses come with the per-rank skill data (docs/roadmap.md,
// "Statistics panel, second pass"); until then those parts are placeholders.
import { $, syncInput } from "./dom.js";
import { createSidePanel, section, statRows, subhead, note } from "./sidePanel.js";
import { TREE_ART } from "./gameArt.js";
import { createStats } from "../core/stats.js";

// Slot groups as the screen lays them out (gamePanels.mutagenPanel).
const GROUP_NAMES = ["top left", "top right", "bottom left", "bottom right"];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const signed = (v, unit) => `+${v}${unit}`;
// Digits the Total points field takes.
const BUDGET_DIGITS = 3;

export function mountStatistics(app) {
  const { catalog, planner, state } = app;
  const stats = createStats(catalog, planner);
  const { maxRank } = catalog;
  const rankOf = s => `${s.rank}/${maxRank}`;

  // Static fields, so they keep focus while typing: the build name and the total points (the budget,
  // up to BUDGET_DIGITS digits). The points spent and left sit on the budget's row; render() fills them.
  const head = `<label class="gfield">Build name
    <input id="statsName" type="text" maxlength="60" placeholder="Enter build name" autocomplete="off" spellcheck="false">
  </label>
  <div class="gpoints">
    <label class="gfield gfield-num">Total points
      <input id="statsBudget" class="num" type="text" maxlength="${BUDGET_DIGITS}" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
    </label>
    <span class="gpoints-stat"><span class="gstat-value" id="statsSpent"></span> <span class="gstat-label">Points spent</span></span>
    <span class="gpoints-stat"><span class="gstat-value" id="statsLeft"></span> <span class="gstat-label" id="statsLeftLabel"></span></span>
  </div>`;

  function overview(s) {
    if (!s.unslotted.length) return "";
    return `<div class="gside-overview">${subhead("Not slotted")}`
      + statRows(s.unslotted.map(k => ({ value: rankOf(k), label: k.name })))
      + note("These skills have points but sit in no slot, so they do nothing.") + "</div>";
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
    // Placeholder until the per-rank numbers are summed (docs/roadmap.md, "Statistics panel, second pass").
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
        // Everything else that shows the name (the menu, the browser tab title); saves too.
        app.render("stats");
      });
      body.querySelector("#statsBudget").addEventListener("input", e => {
        // Digits only (a text field, so maxlength holds).
        const digits = e.target.value.replace(/\D/g, "");
        if (digits !== e.target.value) e.target.value = digits;
        const v = parseInt(digits, 10);
        state.budget = isNaN(v) ? 0 : Math.max(0, v);
        app.render();
      });
    },
    markup() {
      const s = stats.summary(state);
      return overview(s) + s.trees.map(treeSection).join("");
    }
  });

  function render() {
    syncInput(panel.body.querySelector("#statsName"), state.name || "");
    syncInput(panel.body.querySelector("#statsBudget"), state.budget);
    const { spent, left } = stats.points(state);
    panel.body.querySelector("#statsSpent").textContent = spent;
    panel.body.querySelector("#statsLeft").textContent = Math.abs(left);
    panel.body.querySelector("#statsLeftLabel").textContent = left < 0 ? "Points needed" : "Points available";
    panel.render();
  }

  return { ...panel, render };
}
