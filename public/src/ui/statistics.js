// The Statistics panel: a side panel (ui/sidePanel.js) over the tree panel and its tabs, toggled
// with C or the arrow above POINTS AVAILABLE, which stays visible.
// Its Points section is the one place that sets the points budget (core/budget.js): a total that
// Level, Places of power and Other add up to, or a custom total typed in, for New Game or NG+.
// Then it shows what the build adds up to (core/stats.js): the build-wide totals, then a flat bar
// per tree in its colour with its passive and points. Slotted skills and mutagens aren't listed:
// the slots show them, with the skill text in their tooltips.
import { $, syncInput } from "./dom.js";
import { createSidePanel, barList, statRows, subhead, note, switchRows } from "./sidePanel.js";
import { bindOptionRows, bindOptionKeys } from "./options.js";
import { TREE_ART } from "./gameArt.js";
import { createStats } from "../core/stats.js";
import { SOURCE_FIELDS } from "../core/budget.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const signed = (v, unit) => `+${v}${unit}`;
// The number fields: label and the most digits each takes (its widest value). They all show at the
// widest's width, so the Points grid's lines match (styles.css, .gpoints).
const FIELDS = { total: ["Total", 3], level: ["Level", 3], places: ["Places of power", 2], other: ["Other", 1] };
// What a source field shows while the total is custom: the field doesn't count.
const UNUSED = "-";
// The playthrough switch: a switch row like the Skill sets' (sidePanel.js, switchRows). It sets the
// fields' limits (core/budget.js), not the points: switching keeps them, Set max fills them up.
const NG_PLUS = { key: "ngPlus", label: "Playthrough", choices: [{ value: false, label: "New Game" }, { value: true, label: "New Game+" }] };

export function mountStatistics(app) {
  const { catalog, planner, state } = app;
  const { budget } = catalog;
  const stats = createStats(catalog, planner);
  let ngPlusRow = null;

  // A pair in the Points grid: the field, then its name.
  const numField = key => {
    const [label, digits] = FIELDS[key];
    return `<label class="gpoint"><span class="gstat-value"><input data-points="${key}" class="gnum" type="text" maxlength="${digits}" inputmode="numeric" pattern="[0-9]*" autocomplete="off"${key === "total" ? "" : ` placeholder="${UNUSED}"`}></span>`
      + `<span class="gstat-label">${label}</span></label>`;
  };

  // Static fields, so they keep focus while typing: the build name and the Points section. Name and
  // the Points heading share a column, so the name field starts clear of both, and Set max sits at
  // the heading's right end. Then the playthrough switch, then two rows of value and label pairs on a
  // grid: what the total adds up from, then the total (their sum, or typed in) with the points spent
  // and left (render() fills them).
  const head = `<div class="glead">
    <label class="gside-sub" for="statsName">Name</label>
    <input id="statsName" type="text" maxlength="60" placeholder="Enter build name" autocomplete="off" spellcheck="false">
    ${subhead("Points")}
    <button type="button" class="gpopup-btn gside-action glead-action" data-points-max
      data-hint-title="Set max" data-hint="Sets the maximum points based on the playthrough.">Set max</button>
  </div>
  ${switchRows([NG_PLUS])}
  <div class="gpoints">
    ${SOURCE_FIELDS.map(numField).join("")}
    ${numField("total")}
    <div class="gpoint"><span class="gstat-value" id="statsSpent"></span><span class="gstat-label">Spent</span></div>
    <div class="gpoint"><span class="gstat-value" id="statsLeft"></span><span class="gstat-label gpoint-swap" id="statsLeftLabel"><span>Available</span><span>Needed</span></span></div>
  </div>`;

  // One row per total: what always applies, "up to" the most with every condition met, and a value
  // and label line per part under it ("+150%  Flood of Anger (Signs cast with 3 Adrenaline)").
  function totalsBlock(totals) {
    const part = (p, unit) => ({
      value: signed(p.value, unit),
      label: p.name + (p.when ? ` (${p.when})` : "") + (p.counted ? "" : ", not counted: another armor type gives more")
    });
    return `<div class="gside-overview">${subhead("Totals")}` + (totals.length
      ? statRows(totals.map(t => ({
        value: signed(t.value, t.unit), label: t.label, color: t.color,
        aside: t.max !== t.value ? `· up to ${signed(t.max, t.unit)}` : "",
        details: t.parts.map(p => part(p, t.unit))
      })))
      : note("Slot skills or equip mutagens to see what they add up to.")) + "</div>";
  }

  // A tree's bar (barList): its passive bonus after the name, its spent points at the right end.
  function treeBar(t) {
    const { color, stat } = TREE_ART[t.id];
    const passive = { value: signed(t.passive.value, t.passive.unit), label: t.passive.label };
    return { title: t.name, color, icon: stat, aside: passive, end: { text: String(t.spent), label: `${plural(t.spent, "point")} spent` } };
  }

  const panel = createSidePanel(app, {
    name: "stats", title: "Statistics", area: "tree", cover: $("treePanel"), key: "c",
    hint: "Points, stat totals and tree bonuses of this build.",
    head,
    mount(body) {
      body.querySelector("#statsName").addEventListener("input", e => {
        state.name = e.target.value;
        // Everything else that shows the name (the menu, the browser tab title); saves too.
        app.render("stats");
      });
      body.querySelectorAll("[data-points]").forEach(input => {
        const key = input.dataset.points;
        input.addEventListener("input", () => {
          // Digits only (a text field, so maxlength holds). Empty counts as the minimum but stays
          // empty while typing; leaving the field shows the value.
          const digits = input.value.replace(/\D/g, "");
          if (key === "total") budget.setTotal(state, digits);
          else budget.setField(state, key, digits);
          const value = key === "total" ? state.budget : state.progress[key];
          input.value = digits === "" ? "" : value;
          app.render();
        });
        input.addEventListener("blur", render);
      });
      const modes = body.querySelector(".gside-modes");
      ngPlusRow = bindOptionRows(modes, [NG_PLUS], {
        get: () => state.progress.ngPlus,
        set: (key, ngPlus) => { budget.setNgPlus(state, ngPlus); app.render(); }
      });
      bindOptionKeys(modes, ngPlusRow);
      body.querySelector("[data-points-max]").addEventListener("click", () => { budget.setMax(state); app.render(); });
    },
    markup() {
      const s = stats.summary(state);
      return totalsBlock(s.totals) + `<div class="gside-overview">${subhead("Trees")}${barList(s.trees.map(treeBar))}</div>`;
    }
  });

  function render() {
    const { body } = panel;
    const p = state.progress;
    syncInput(body.querySelector("#statsName"), state.name || "");
    syncInput(body.querySelector('[data-points="total"]'), state.budget);
    SOURCE_FIELDS.forEach(k => syncInput(body.querySelector(`[data-points="${k}"]`), p.custom ? "" : p[k]));
    ngPlusRow.redraw();
    const { spent, left } = stats.points(state);
    body.querySelector("#statsSpent").textContent = spent;
    body.querySelector("#statsLeft").textContent = Math.abs(left);
    // Both labels stay in the cell, so its width doesn't change when one replaces the other (styles.css, .gpoint-swap).
    body.querySelector("#statsLeftLabel").classList.toggle("over", left < 0);
    panel.render();
  }

  return { ...panel, render };
}
