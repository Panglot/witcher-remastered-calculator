// Toasts: short messages that show at the bottom of the page and go away on their own, for results
// that need no answer ("Build code copied"). Each is a box in the message popup's frame
// (popup/frame.svg) on the tooltip's translucent fill. They stack upwards, newest at the bottom, over
// everything (popups and the menu included), and never take focus or pointer input from the page
// under them; a click on one dismisses it. Screen readers hear them through the stack's live region.

/** How long a toast stays, in ms, unless show() says otherwise. */
export const TOAST_MS = 3000;
/** Toasts kept at once: a new one past this drops the oldest. */
const MAX_TOASTS = 3;
// Matches the fade-out in styles.css (.gtoast).
const FADE_MS = 200;

/**
 * @typedef {"bad"} ToastTone  bad: a failure, in the game's red
 * @typedef {{ ms?: number, tone?: ToastTone }} ToastOptions  ms: 0 keeps it until clicked
 */

/**
 * Creates the toast stack in `parent` (document.body by default).
 * @param {HTMLElement} [parent]
 * @returns {{ show: (text: string, o?: ToastOptions) => () => void, clear: () => void }}
 *   show returns a function that dismisses that toast
 */
export function createToaster(parent = document.body) {
  const stack = document.createElement("div");
  stack.className = "gtoasts";
  stack.setAttribute("role", "status");
  stack.setAttribute("aria-live", "polite");
  parent.append(stack);

  function dismiss(el) {
    if (!el.isConnected || el.classList.contains("leaving")) return;
    clearTimeout(el._timer);
    el.classList.add("leaving");
    setTimeout(() => el.remove(), FADE_MS);
  }

  function show(text, { ms = TOAST_MS, tone } = {}) {
    const el = document.createElement("div");
    el.className = tone ? `gtoast ${tone}` : "gtoast";
    el.textContent = text;
    el.addEventListener("click", () => dismiss(el));
    stack.append(el);
    const live = [...stack.children].filter(t => !t.classList.contains("leaving"));
    live.slice(0, Math.max(0, live.length - MAX_TOASTS)).forEach(dismiss);
    if (ms > 0) el._timer = setTimeout(() => dismiss(el), ms);
    return () => dismiss(el);
  }

  const clear = () => [...stack.children].forEach(dismiss);

  return { show, clear };
}
