// The build's share tools (ui/buildTools.js) stacked in a column right of the slots, in the page's
// right margin and centred on the slots' height, plus their shortcuts:
// - Ctrl+C copies the code (unless text is selected: then the browser copies that),
// - Ctrl+V opens Load code with its field focused, so the same key press pastes into it,
// - Ctrl+S exports the file (instead of the browser saving the page).
// The keys work while no popup or menu is open and no field has focus. The rail is part of the
// planner screen, so its tooltips are the screen's (ui/tooltip.js); the screen redraws them.
import { $ } from "./dom.js";
import { TOOLS, TOOL, createBuildTools, reportResult, toolButton } from "./buildTools.js";

// Shortcut key (with Ctrl, or Cmd on a Mac) -> tool id.
const SHORTCUTS = { c: "copy", v: "load", s: "export" };
const typing = el => !!(el && el.closest && el.closest("input, textarea, select, [contenteditable]"));
const hasSelection = () => !!String(window.getSelection() || "");

export function mountBuildRail(app) {
  const el = $("buildRail");
  const tools = createBuildTools(app);
  // One run at a time: a held Ctrl+S would stack popups.
  let busy = false;

  async function run(id) {
    if (busy) return;
    busy = true;
    try { reportResult(app, await tools.run(id)); }
    finally { busy = false; }
  }

  el.innerHTML = `<div class="gbuild-rail" role="toolbar" aria-orientation="vertical" aria-label="Share and load">${
    TOOLS.map(t => toolButton(t)).join("")}</div>`;
  el.addEventListener("click", e => {
    const b = e.target.closest(TOOL);
    if (b) run(b.dataset.tool);
  });

  document.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const id = SHORTCUTS[e.key.toLowerCase()];
    if (!id || !app.game || app.layers.blocking() || typing(e.target)) return;
    if (id === "copy" && hasSelection()) return;
    // Ctrl+V keeps its paste: it lands in the Load code field, focused as the popup opens.
    if (id !== "load") e.preventDefault();
    if (!e.repeat) run(id);
  });

  return { render() {} };
}
