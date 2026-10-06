// Sharing the build: copy its code or a share link, export it as a file, load it from a code, a link
// or a file. Used by the share tools (ui/buildTools.js) and by the page start (a share link opened
// in the browser). It touches no page markup: every action reports what happened as { ok, text }
// for the caller to show.
import { confirmPopup } from "./popup.js";
import { encodeBuildCode, decodeBuildCode, applyBuildData, exportFile, isEmptyBuild, shareLink, readShareLink, CODE_PREFIX } from "../core/build.js";

/**
 * @typedef {{ ok: boolean, text: string, fallback?: string }} ShareResult
 *   fallback: text the clipboard didn't take, for the caller to offer for copying by hand
 */
export function createBuildShare(app) {
  const { catalog, state } = app;

  /** @returns {Promise<ShareResult>} */
  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, text: `${what} copied. Paste it anywhere to share.` };
    } catch (e) {
      return { ok: false, text: `Couldn't reach the clipboard: press Ctrl+C to copy the ${what.toLowerCase()}.`, fallback: text };
    }
  }

  // Loading over a build with something in it asks first. Without the game art there is no popup
  // to ask with, so it loads.
  async function replaceAllowed(incoming) {
    if (isEmptyBuild(state) || !app.game) return true;
    const from = state.name ? `"${state.name}"` : "the current build";
    const to = incoming.n ? `"${incoming.n}"` : "the loaded one";
    return confirmPopup(app, {
      title: "Load build",
      text: `Replace ${from} with ${to}? Copy or export the current build first to keep it.`
    });
  }

  /**
   * Loads the build found in text; `source` names where it came from, for the messages.
   * @returns {Promise<ShareResult & { cancelled?: boolean }>}
   */
  async function load(text, source) {
    const d = decodeBuildCode(text);
    if (!d) return { ok: false, text: `No build code found in ${source}. A code starts with ${CODE_PREFIX}` };
    if (!await replaceAllowed(d)) return { ok: false, cancelled: true, text: "Nothing loaded: the current build stays." };
    applyBuildData(catalog, state, d);
    app.msg = "";
    app.render();
    return { ok: true, text: state.name ? `Loaded ${state.name}.` : "Build loaded." };
  }

  return {
    copyCode: () => copy(encodeBuildCode(state), "Code"),
    copyLink: () => copy(shareLink(location.href, state), "Link"),

    /** Downloads the build file. @returns {ShareResult} */
    exportFile() {
      const file = exportFile(state);
      const url = URL.createObjectURL(new Blob([file.text], { type: "text/plain;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, text: `Exported ${file.name}.` };
    },

    load,

    /** The clipboard's text, or null where the browser doesn't allow reading it. */
    async readClipboard() {
      try { return await navigator.clipboard.readText(); } catch (e) { return null; }
    },

    /** Asks for a build file and loads it. @returns {Promise<ShareResult | null>} null: no file picked */
    async importFile() {
      const file = await pickFile(".txt,text/plain");
      if (!file) return null;
      try { return await load(await file.text(), file.name); }
      catch (e) { return { ok: false, text: `Couldn't read ${file.name}.` }; }
    },

    /**
     * A share link opened in the browser: loads its build, then takes the code out of the address so
     * a refresh doesn't load it over later changes. Failures go to the page's feedback line.
     */
    async loadFromAddress() {
      const { code, rest } = readShareLink(location.href);
      if (!code) return;
      history.replaceState(history.state, "", rest);
      const result = await load(code, "the link");
      if (!result.ok && !result.cancelled) { app.msg = result.text; app.render(); }
    }
  };
}

// The browser's file dialog; resolves null when it is closed without a file.
function pickFile(accept) {
  return new Promise(resolve => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept, hidden: true });
    const done = file => { input.remove(); resolve(file || null); };
    input.addEventListener("change", () => done(input.files[0]));
    input.addEventListener("cancel", () => done(null));
    document.body.append(input);
    input.click();
  });
}
