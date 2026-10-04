// The build's share tools (copy code, export file, load code, import file, copy share link) as icon
// buttons with the game's hint tooltip (data-hint says what the tool does); a run's result shows as
// a toast (ui/toast.js), in red when it failed. Two places
// draw them: the Build drawer of the Esc menu (ui/buildMenu.js, which runs them against its own
// name and code fields) and the rail right of the slots (ui/buildRail.js), which runs them here:
// the rail has no text fields, so the tools that need text ask for it in a popup (ui/popup.js), the
// export the build name and Load code the code or link. The work itself is ui/share.js.
//
// The icons are game art cut to one-colour glyphs (tools/asset-recipe.json, icons/) that the page
// tints like the menu text: photo mode's copy squares, the save indicator's card for Load code, and
// photo mode's floppy with a 45 degree arrowhead for the file and link tools.
import { esc } from "./dom.js";
import { fieldsPopup } from "./popup.js";
import { MAX_NAME_LENGTH, decodeBuildCode, CODE_PREFIX } from "../core/build.js";
import { createBuildShare } from "./share.js";

/** The tools in drawing order. key: its shortcut (ui/buildRail.js), shown in the tooltip's title. */
export const TOOLS = [
  { id: "copy", label: "Copy code", key: "Ctrl+C", icon: "assets/ui/icons/copy.png", hint: "Copies the build code to the clipboard." },
  { id: "export", label: "Export file", key: "Ctrl+S", icon: "assets/ui/icons/export.png", hint: "Saves the build as a text file, under the name you give it." },
  { id: "load", label: "Load code", key: "Ctrl+V", icon: "assets/ui/icons/load.png", hint: "Loads a build from a code or a share link you paste in." },
  { id: "import", label: "Import file", icon: "assets/ui/icons/import.png", hint: "Loads a build from an exported file." },
  { id: "link", label: "Copy share link", icon: "assets/ui/icons/share.png", hint: "Copies a link that opens the planner with this build." }
];
export const TOOL = ".gbuild-tool";

/**
 * Runs the tools. run(id) resolves the share result ({ ok, text }) for the caller to show, or null
 * when nothing happened (a popup or the file dialog cancelled).
 */
export function createBuildTools(app) {
  const share = createBuildShare(app);
  const { state } = app;

  // The clipboard refused: the text in a popup, selected, to copy by hand.
  async function offerByHand(result, what) {
    if (result.fallback && app.game) {
      await fieldsPopup(app, { title: what, text: result.text, accept: "Done", cancel: null,
        fields: [{ name: "text", label: "Code", value: result.fallback, readOnly: true }] });
    }
    return result;
  }

  const RUN = {
    copy: async () => offerByHand(await share.copyCode(), "Copy code"),
    link: async () => offerByHand(await share.copyLink(), "Copy share link"),
    async export() {
      if (!app.game) return share.exportFile();
      const v = await fieldsPopup(app, { title: "Export file", text: "Name the build. The file is named after it.",
        fields: [{ name: "name", label: "Name", value: state.name || "", placeholder: "Enter build name", maxLength: MAX_NAME_LENGTH }] });
      if (!v) return null;
      const name = v.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name !== (state.name || "")) { state.name = name; app.render(); }
      return share.exportFile();
    },
    async load() {
      if (!app.game) return null;
      const v = await fieldsPopup(app, { title: "Load code", text: "Paste a build code or a share link.",
        fields: [{ name: "code", label: "Code", placeholder: "Paste a code or link" }],
        check: ({ code }) => !code.trim() ? "Paste a code or link first."
          : decodeBuildCode(code) ? "" : `No build code found. A code starts with ${CODE_PREFIX}` });
      return v && share.load(v.code, "the pasted text");
    },
    import: () => share.importFile()
  };

  return {
    /** @param {string} id @returns {Promise<import("./share.js").ShareResult | null>} */
    async run(id) {
      const result = await RUN[id]();
      return result && !result.cancelled ? result : null;
    }
  };
}

/** A run's result as a toast (ui/toast.js), red when it failed. Nothing for null or a cancelled one. */
export function reportResult(app, r) {
  if (r && !r.cancelled) app.toast.show(r.text, r.ok ? {} : { tone: "bad" });
}

/** A tool's button. extra: more attributes (tabindex), cls: more classes. */
export const toolButton = (t, extra = "", cls = "") => `<button type="button" class="${TOOL.slice(1)}${cls ? ` ${cls}` : ""}" data-tool="${t.id}"${extra}
  aria-label="${esc(t.label)}" data-hint-title="${esc(t.key ? `${t.label} (${t.key})` : t.label)}" data-hint="${esc(t.hint)}">
  <span class="gbuild-icon" style="--icon: url('${t.icon}')" aria-hidden="true"></span></button>`;
