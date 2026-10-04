// The game's message popup (gamePanels.popup) as a modal question over the whole page: E, Space or
// Accept says yes, Escape, the right mouse button or Cancel says no. It is a modal layer
// (ui/layers.js): while it is open the rest of the page is inert and the planner's keys are off.
// A popup can also ask for text (fieldsPopup): its fields sit under the text, the first one gets
// focus, and Enter in a field accepts.
import { esc } from "./dom.js";

/** Buttons of a yes / no popup: the game's A (accept) and B (back) keys on a keyboard. */
export const CONFIRM_KEYS = { accept: "E", cancel: "Escape" };
/** Button labels of every yes / no popup. */
export const CONFIRM_LABELS = { accept: "Accept", cancel: "Cancel" };
// Keys that also say yes. Space on a focused button presses that button instead (ui/dom.js).
// In a field they type: the page's keys skip fields (ui/dom.js), so the layer never sees them.
const ACCEPT_KEYS = new Set([CONFIRM_KEYS.accept.toLowerCase(), " "]);
// The accept key of a popup with fields: E types in them.
const FIELD_ACCEPT_KEY = "Enter";

const acceptButton = (label = CONFIRM_LABELS.accept, key = CONFIRM_KEYS.accept) => ({ key, label, action: "accept", tone: "accept" });
const cancelButton = (label = CONFIRM_LABELS.cancel) => ({ key: CONFIRM_KEYS.cancel, label, action: "cancel", tone: "cancel" });

/**
 * Asks a yes / no question; resolves true for yes.
 * @param {{ game: { panels: { popup: Function } }, layers: ReturnType<import("./layers.js").createLayers> }} app
 *   needs the game art loaded
 * @param {{ title: string, text?: string }} o
 * @returns {Promise<boolean>}
 */
export function confirmPopup(app, { title, text = "" }) {
  return openPopup(app, { title, text, buttons: [acceptButton(), cancelButton()] });
}

/**
 * @typedef {{ name: string, label: string, value?: string, placeholder?: string, maxLength?: number,
 *   readOnly?: boolean }} PopupField
 */

/**
 * Asks for text; resolves the fields' values by name, or null when cancelled.
 * check(values) returns why they can't be taken (shown in the popup, which stays open) or "".
 * Without a cancel label there is only the accept button (Esc still closes it, resolving null).
 * @param {{ title: string, text?: string, fields: PopupField[], check?: (values: Record<string, string>) => string,
 *   accept?: string, cancel?: string | null }} o
 * @returns {Promise<Record<string, string> | null>}
 */
export function fieldsPopup(app, { title, text = "", fields, check = () => "", accept = CONFIRM_LABELS.accept, cancel = CONFIRM_LABELS.cancel }) {
  let values = null;
  const body = `<div class="gpopup-fields">${fields.map(fieldHtml).join("")}
    <p class="gpopup-error" role="alert" hidden></p></div>`;
  const buttons = [acceptButton(accept, FIELD_ACCEPT_KEY), ...(cancel ? [cancelButton(cancel)] : [])];
  const inputs = dialog => [...dialog.querySelectorAll("[data-field]")];

  return openPopup(app, {
    title, text, body, buttons,
    init({ dialog, answer }) {
      dialog.addEventListener("keydown", e => {
        if (e.key !== FIELD_ACCEPT_KEY || !e.target.matches("[data-field]")) return;
        e.preventDefault();
        if (!e.repeat) answer(true);
      });
      // Focused at once: a Ctrl+V that opened the popup pastes into it (ui/buildRail.js).
      const first = inputs(dialog)[0];
      first.focus();
      first.select();
    },
    accepting(dialog) {
      const read = Object.fromEntries(inputs(dialog).map(i => [i.dataset.field, i.value]));
      const problem = check(read);
      const error = dialog.querySelector(".gpopup-error");
      error.textContent = problem;
      error.hidden = !problem;
      if (problem) { inputs(dialog)[0].focus(); return false; }
      values = read;
      return true;
    }
  }).then(yes => yes ? values : null);
}

const fieldHtml = f => `<label class="gfield">${esc(f.label)}
  <input type="text" data-field="${esc(f.name)}" value="${esc(f.value || "")}" autocomplete="off" spellcheck="false"${
    f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.maxLength ? ` maxlength="${f.maxLength}"` : ""}${f.readOnly ? " readonly" : ""}></label>`;

/**
 * The popup as a modal layer; resolves true when accepted, false when cancelled.
 * init({ root, dialog, answer }): wires the popup's own parts and may move focus off the dialog.
 * accepting(dialog): false keeps the popup open on accept.
 */
function openPopup(app, { title, text = "", body = "", buttons, init = null, accepting = () => true }) {
  return new Promise(resolve => {
    // The popup over its own mask, appended last so it sits above any layer open before it.
    const root = document.createElement("div");
    root.className = "glayer";
    root.innerHTML = `<div class="glayer-mask"></div><div class="gdialog" role="dialog" aria-modal="true" tabindex="-1"></div>`;
    const dialog = root.querySelector(".gdialog");
    dialog.setAttribute("aria-label", title);
    dialog.innerHTML = app.game.panels.popup({ title, text, body, buttons });

    const layer = {
      name: "confirm", modal: true,
      live: () => [root],
      keys(e) {
        if (!ACCEPT_KEYS.has(e.key.toLowerCase())) return false;
        if (!e.repeat) answer(true);
        return true;
      },
      escape: () => answer(false)
    };
    // Every way out (a button, a key, Esc, the right mouse button) answers once.
    let open = true;
    function answer(yes) {
      if (!open || (yes && !accepting(dialog))) return;
      open = false;
      app.layers.close(layer);
      root.remove();
      resolve(yes);
    }

    root.addEventListener("click", e => {
      const b = e.target.closest("[data-action]");
      if (b) answer(b.dataset.action === "accept");
    });
    document.body.append(root);
    app.layers.open(layer);
    // Like the game, no button starts picked: the popup holds focus instead of its first button.
    dialog.focus();
    if (init) init({ root, dialog, answer });
  });
}
