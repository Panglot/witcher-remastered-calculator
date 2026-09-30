// The skill tree board (SVG). Click selects, double-click adds a point, right-click removes one;
// with a skill focused, Enter/Space select and +/- change rank.
import { $ } from "./dom.js";

// Node box size and board padding, in SVG units. Grid spacing comes from each tree's layout.
const W = 96, H = 72, PAD = 14;
const LABEL_CHARS = 12, PIP_STEP = 13;

// Splits a skill name into lines of at most LABEL_CHARS characters (longer single words stay whole).
function wrapLabel(name) {
  const lines = [];
  let cur = "";
  name.split(" ").forEach(w => {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= LABEL_CHARS) cur += " " + w;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
}

export function mountTree(app) {
  const { catalog, planner, state } = app;
  const { nodes, edges, maxRank } = catalog;
  const el = $("treewrap");

  const nodeEl = id => el.querySelector(`[data-id="${id}"]`);
  function focusNode(id) { const g = nodeEl(id); if (g) g.focus({ preventScroll: true }); }
  function shake(id) {
    const g = nodeEl(id);
    if (g) { g.classList.remove("shake"); void g.getBBox(); g.classList.add("shake"); }
  }
  // Runs a planner action on a skill, redraws, keeps focus, and shakes the node if it was refused with a reason.
  function act(id, action) {
    state.sel = id;
    const r = action(state, id);
    app.msg = r.msg; app.render(); focusNode(id);
    if (!r.ok && r.msg) shake(id);
  }

  el.addEventListener("click", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    // Update the selection in place (no tree redraw) so a double-click lands on the same element.
    state.sel = g.dataset.id; app.msg = "";
    el.querySelectorAll(".node.selected").forEach(n => n.classList.remove("selected"));
    g.classList.add("selected");
    app.views.detail.render(); app.views.slots.render(); app.save();
  });
  el.addEventListener("dblclick", e => {
    const g = e.target.closest("[data-id]"); if (g) act(g.dataset.id, planner.addPoint);
  });
  el.addEventListener("contextmenu", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    e.preventDefault(); act(g.dataset.id, planner.removePoint);
  });
  el.addEventListener("keydown", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    const id = g.dataset.id;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state.sel = id; app.msg = ""; app.render(); focusNode(id); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); act(id, planner.addPoint); }
    else if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); act(id, planner.removePoint); }
  });

  function highlighted() {
    const s = new Set();
    state.arch.forEach(a => { const A = catalog.archetypes.find(x => x.id === a); if (A) A.ids.forEach(i => s.add(i)); });
    return s;
  }

  function renderNode(n, x, y, hl) {
    const p = planner.rank(state, n.id), open = planner.isOpen(state, n.id);
    const cls = ["node", p > 0 ? "inv" : (open ? "avail" : "locked"),
      state.sel === n.id ? "selected" : "", hl.has(n.id) ? "hlon" : "", planner.isSlotted(state, n.id) ? "slotted" : ""].join(" ");
    const lines = wrapLabel(n.name);
    const ty = y + 30 - (lines.length - 1) * 7;
    const pip0 = x + W / 2 - (maxRank * PIP_STEP - 5) / 2;
    let out = `<g class="${cls}" data-id="${n.id}" tabindex="0" role="button" aria-label="${n.name}, rank ${p} of ${maxRank}${open ? "" : ", locked"}">`;
    out += `<rect class="hl" x="${x - 5}" y="${y - 5}" width="${W + 10}" height="${H + 10}"/>`;
    out += `<rect class="box" x="${x}" y="${y}" width="${W}" height="${H}"/>`;
    out += `<rect class="sel" x="${x - 1.5}" y="${y - 1.5}" width="${W + 3}" height="${H + 3}"/>`;
    out += `<text x="${x + W / 2}" y="${ty}" text-anchor="middle">` + lines.map((l, i) => `<tspan x="${x + W / 2}" dy="${i ? 14 : 0}">${l}</tspan>`).join("") + `</text>`;
    for (let i = 0; i < maxRank; i++) out += `<rect class="pip${i < p ? " on" : ""}" x="${pip0 + i * PIP_STEP}" y="${y + H - 11}" width="8" height="5"/>`;
    out += `<rect class="slotmark" x="${x + W - 11}" y="${y + 4}" width="7" height="7" transform="rotate(45 ${x + W - 7.5} ${y + 7.5})"/>`;
    return out + `</g>`;
  }

  function render() {
    const T = catalog.trees[state.tab];
    const skills = catalog.skillsIn(state.tab);
    const { colW, rowH } = T.layout;
    const left = n => PAD + n.col * colW, top = n => PAD + n.row * rowH;
    const vw = PAD * 2 + Math.max(...skills.map(n => n.col)) * colW + W;
    const vh = PAD * 2 + Math.max(...skills.map(n => n.row)) * rowH + H;
    const hl = highlighted();
    let out = `<svg viewBox="0 0 ${vw} ${vh}" role="group" aria-label="${T.name} skill tree" style="--tc:${T.color};--tcd:${T.dark}">`;
    edges.forEach(([a, b]) => {
      const A = nodes[a], B = nodes[b];
      if (A.tree !== state.tab) return;
      const pa = planner.rank(state, a) > 0, pb = planner.rank(state, b) > 0;
      const cls = pa && pb ? "lit" : (pa || pb ? "open" : "");
      out += `<line class="edge ${cls}" x1="${left(A) + W / 2}" y1="${top(A) + H / 2}" x2="${left(B) + W / 2}" y2="${top(B) + H / 2}"/>`;
    });
    skills.forEach(n => { out += renderNode(n, left(n), top(n), hl); });
    el.innerHTML = out + `</svg>`;
  }

  return { render };
}
