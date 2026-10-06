// The Build drawer of the Esc menu: it opens under the Build item like an accordion (ui/menu.js).
// Inside: the build name (the same field as in Statistics), the share tools as icon buttons
// (ui/buildTools.js, the same ones as on the rail right of the slots), and a field to paste a code
// or a link into for Load code (one line like the name field: the code isn't meant to be read).
// Until something is typed there, the field shows the current build's code (empty for an empty
// build), following renames. Unlike the rail, the drawer's Export file and Load code use these
// fields instead of asking in a popup.
//
// A drawer is { markup(), mount(el), pick(el), step(el, dir) } for the menu: pick runs the tool `el`
// and step moves along the tools (the arrows left and right); both return false for anything else.
// The focused tool is the menu's arrow stop for the row (class gmenu-stop, tabindex 0).
import { esc } from "./dom.js";
import { MAX_NAME_LENGTH, encodeBuildCode, isEmptyBuild } from "../core/build.js";
import { createBuildShare } from "./share.js";
import { TOOLS as RAIL_TOOLS, TOOL, reportResult, toolButton } from "./buildTools.js";

// The rail's tools, telling what the drawer's own fields do. No shortcuts: they are off in the menu.
const HINTS = {
  export: "Saves the build as a text file, named after the build name above.",
  load: "Loads the code or link in the field below, or the clipboard's when the field is empty or holds the current build."
};
const TOOLS = RAIL_TOOLS.map(t => ({ ...t, key: undefined, hint: HINTS[t.id] || t.hint }));

/**
 * @param {object} app
 * @param {{ renamed?: () => void }} [o] renamed: after the name field changed the build name
 */
export function createBuildDrawer(app, { renamed = () => {} } = {}) {
  const share = createBuildShare(app);
  // Kept across redraws (the menu redraws after a load): the paste field's text (null: untouched, it
  // shows the current code) and the tool that has the row's stop.
  let draft = null, stop = TOOLS[0].id;
  let root = null;

  const currentCode = () => isEmptyBuild(app.state) ? "" : encodeBuildCode(app.state);
  const fieldText = () => draft ?? currentCode();

  function markup() {
    return `<div class="gbuild">
      <label class="gfield">Name
        <input class="gbuild-name" type="text" maxlength="${MAX_NAME_LENGTH}" placeholder="Enter build name" autocomplete="off" spellcheck="false" value="${esc(app.state.name || "")}">
      </label>
      <label class="gfield">Code
        <input class="gbuild-paste" type="text" placeholder="Paste a code or link" autocomplete="off" spellcheck="false" value="${esc(fieldText())}">
      </label>
      <div class="gbuild-tools" role="toolbar" aria-label="Share and load">${
        TOOLS.map(t => toolButton(t, ` tabindex="${t.id === stop ? 0 : -1}"`, "gmenu-stop")).join("")}</div>
    </div>`;
  }

  const paste = () => root.querySelector(".gbuild-paste");
  const toolEl = id => root.querySelector(`${TOOL}[data-tool="${id}"]`);

  // The clipboard refused: the text goes into the paste field, selected, to copy by hand.
  function offerByHand(text) {
    const field = paste();
    field.value = draft = text;
    field.focus();
    field.select();
  }

  const RUN = {
    copy: () => share.copyCode(),
    link: () => share.copyLink(),
    export: () => share.exportFile(),
    import: () => share.importFile(),
    async load() {
      // The current build's code in the field counts as nothing typed: loading it would change nothing.
      const field = paste().value.trim();
      const typed = field === currentCode() ? "" : field;
      const text = typed || await share.readClipboard();
      if (!text || !text.trim()) {
        paste().focus();
        return { ok: false, text: "Paste a build code or link into the field below first." };
      }
      const result = await share.load(text, typed ? "the pasted text" : "the clipboard");
      if (result.ok && typed) {
        draft = null;
        paste().value = currentCode();
      }
      return result;
    }
  };

  async function run(button) {
    const id = button.dataset.tool;
    const result = await RUN[id]();
    if (!result) return;
    reportResult(app, result);
    if (result.fallback) offerByHand(result.fallback);
  }

  function focusTool(id) {
    stop = id;
    root.querySelectorAll(TOOL).forEach(b => { b.tabIndex = b.dataset.tool === id ? 0 : -1; });
    toolEl(id).focus({ preventScroll: true });
  }

  function mount(el) {
    root = el;
    el.querySelector(".gbuild-name").addEventListener("input", e => {
      app.state.name = e.target.value.slice(0, MAX_NAME_LENGTH);
      renamed();
      if (draft === null) paste().value = currentCode();
    });
    const field = el.querySelector(".gbuild-paste");
    field.addEventListener("input", e => { draft = e.target.value; });
    // Coming into the field selects all of it, to copy or paste over. A click's own mousedown would
    // drop a caret over the selection, so the first click focuses by hand; later clicks place the caret.
    field.addEventListener("focus", () => field.select());
    field.addEventListener("mousedown", e => {
      if (document.activeElement === field) return;
      e.preventDefault();
      field.focus();
    });
    el.addEventListener("click", e => {
      const b = e.target.closest(TOOL);
      if (b) run(b);
    });
    el.addEventListener("focusin", e => {
      const b = e.target.closest(TOOL);
      if (!b) return;
      stop = b.dataset.tool;
      el.querySelectorAll(TOOL).forEach(t => { t.tabIndex = t === b ? 0 : -1; });
    });
  }

  return {
    markup,
    mount,
    pick(el) {
      const b = el && el.closest(TOOL);
      if (!b || !root || !root.contains(b)) return false;
      run(b);
      return true;
    },
    step(el, dir) {
      const b = el && el.closest(TOOL);
      if (!b || !root || !root.contains(b)) return false;
      const i = TOOLS.findIndex(t => t.id === b.dataset.tool);
      focusTool(TOOLS[(i + dir + TOOLS.length) % TOOLS.length].id);
      return true;
    }
  };
}
