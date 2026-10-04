// Share panel: copy the build's code or export it as a file; load from a pasted code or a file.
// The build is named in the Statistics panel (ui/statistics.js).
import { $ } from "./dom.js";
import { encodeBuildCode, decodeBuildCode, applyBuildData, exportFile, CODE_PREFIX } from "../core/build.js";

export function mountShare(app) {
  const { catalog, state } = app;
  const pasteEl = $("pasteCode"), fileEl = $("importInput"), msgEl = $("shareMsg");

  function setMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = "meta" + (kind === "bad" ? " bad-msg" : " ok-msg");
  }

  // Loads build data found in text; `source` names where it came from, for the messages.
  function loadFrom(text, source) {
    const d = decodeBuildCode(text);
    if (!d || !applyBuildData(catalog, state, d)) { setMsg(`No build code found in ${source}. A code starts with ${CODE_PREFIX}`, "bad"); return false; }
    app.msg = ""; app.render();
    setMsg(state.name ? `Loaded ${state.name}.` : "Build loaded.", "ok");
    return true;
  }

  $("copyCode").addEventListener("click", () => {
    const code = encodeBuildCode(state);
    // Without clipboard access, put the code where the user can copy it by hand.
    const fallback = () => { pasteEl.value = code; pasteEl.focus(); pasteEl.select(); setMsg("Code selected below. Press Ctrl+C to copy.", "ok"); };
    try { navigator.clipboard.writeText(code).then(() => setMsg("Code copied. Paste it anywhere to share.", "ok"), fallback); } catch (e) { fallback(); }
  });

  $("exportFile").addEventListener("click", () => {
    const file = exportFile(state);
    const url = URL.createObjectURL(new Blob([file.text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg(`Exported ${file.name}.`, "ok");
  });

  $("loadCode").addEventListener("click", () => {
    if (loadFrom(pasteEl.value, "the pasted text")) pasteEl.value = "";
  });

  $("importFile").addEventListener("click", () => fileEl.click());
  fileEl.addEventListener("change", async () => {
    const file = fileEl.files[0];
    fileEl.value = ""; // so picking the same file again still fires change
    if (!file) return;
    try { loadFrom(await file.text(), file.name); }
    catch (e) { setMsg(`Couldn't read ${file.name}.`, "bad"); }
  });

  return { render() {} };
}
