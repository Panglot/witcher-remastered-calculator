// The game's message popup (gamePanels.popup) as a modal question over the whole page: E, Space or
// Accept says yes, Escape, the right mouse button or Cancel says no. It is a modal layer
// (ui/layers.js): while it is open the rest of the page is inert and the planner's keys are off.

/** Buttons of a yes / no popup: the game's A (accept) and B (back) keys on a keyboard. */
export const CONFIRM_KEYS = { accept: "E", cancel: "Escape" };
/** Button labels of every yes / no popup. */
export const CONFIRM_LABELS = { accept: "Accept", cancel: "Cancel" };
// Keys that also say yes. Space on a focused button presses that button instead (ui/dom.js).
const ACCEPT_KEYS = new Set([CONFIRM_KEYS.accept.toLowerCase(), " "]);

/**
 * Asks a yes / no question; resolves true for yes.
 * @param {{ game: { panels: { popup: Function } }, layers: ReturnType<import("./layers.js").createLayers> }} app
 *   needs the game art loaded
 * @param {{ title: string, text?: string }} o
 * @returns {Promise<boolean>}
 */
export function confirmPopup(app, { title, text = "" }) {
  return new Promise(resolve => {
    // The popup over its own mask, appended last so it sits above any layer open before it.
    const root = document.createElement("div");
    root.className = "glayer";
    root.innerHTML = `<div class="glayer-mask"></div><div class="gdialog" role="dialog" aria-modal="true" tabindex="-1"></div>`;
    const dialog = root.querySelector(".gdialog");
    dialog.setAttribute("aria-label", title);
    dialog.innerHTML = app.game.panels.popup({ title, text, buttons: [
      { key: CONFIRM_KEYS.accept, label: CONFIRM_LABELS.accept, action: "accept", tone: "accept" },
      { key: CONFIRM_KEYS.cancel, label: CONFIRM_LABELS.cancel, action: "cancel", tone: "cancel" }
    ] });

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
      if (!open) return;
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
  });
}
