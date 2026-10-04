// The game's message popup (gamePanels.popup) as a modal question over the whole page: E, Space or
// Accept says yes, Escape, the right mouse button or Cancel says no. While it is open the planner's page-wide keys are off
// (dom.js, isHotkey).

/** Buttons of a yes / no popup: the game's A (accept) and B (back) keys on a keyboard. */
export const CONFIRM_KEYS = { accept: "E", cancel: "Escape" };
/** Button labels of every yes / no popup. */
export const CONFIRM_LABELS = { accept: "Accept", cancel: "Cancel" };
// Keys that also say yes; Space never reaches the page, so it doesn't scroll it.
const ACCEPT_KEYS = new Set([CONFIRM_KEYS.accept.toLowerCase(), " "]);

/**
 * The right mouse button says no, like the game's B, anywhere on the page. The menu never opens.
 * A touch long-press also fires contextmenu; it is no answer, so a slow tap doesn't back out.
 * @param {MouseEvent} e
 * @returns {boolean} true if e cancels
 */
export function isCancelClick(e) {
  e.preventDefault();
  return e.pointerType !== "touch";
}

/**
 * Asks a yes / no question; resolves true for yes.
 * @param {{ game: { panels: { popup: Function } } }} app  needs the game art loaded
 * @param {{ title: string, text?: string }} o
 * @returns {Promise<boolean>}
 */
export function confirmPopup(app, { title, text = "" }) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "gdialog";
    dialog.setAttribute("aria-label", title);
    dialog.innerHTML = app.game.panels.popup({ title, text, buttons: [
      { key: CONFIRM_KEYS.accept, label: CONFIRM_LABELS.accept, action: "accept", tone: "accept" },
      { key: CONFIRM_KEYS.cancel, label: CONFIRM_LABELS.cancel, action: "cancel", tone: "cancel" }
    ] });
    // Every way out ends in "close", Escape included (the browser closes the dialog), so no answer is lost.
    let yes = false;
    const answer = value => { yes = value; dialog.close(); };
    dialog.addEventListener("close", () => { dialog.remove(); resolve(yes); });

    dialog.addEventListener("click", e => {
      const b = e.target.closest("[data-action]");
      if (b) answer(b.dataset.action === "accept");
    });
    dialog.addEventListener("contextmenu", e => { if (isCancelClick(e)) answer(false); });
    dialog.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey || !ACCEPT_KEYS.has(e.key.toLowerCase())) return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      // Space on a focused button presses that button, like a click.
      const b = e.key === " " && e.target.closest("[data-action]");
      answer(b ? b.dataset.action === "accept" : true);
    });
    document.body.append(dialog);
    dialog.showModal();
    // Like the game, no button starts picked: the dialog holds focus instead of its first button.
    dialog.tabIndex = -1;
    dialog.focus();
  });
}
