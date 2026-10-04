// Press-and-hold, like the game's "[Hold]" actions (SlotSkillGrid.startPurchaseAnimation): while
// held, the element has class "holding" and --hold (the duration) for its CSS fill, and the action
// runs once the hold lasts its duration (HOLD_MS unless the viewer set another, settings.holdMs).
// Letting go earlier cancels it; a duration of 0 runs the action at once. One hold at a time, and
// cancelHolds() ends every one (a drag starting, ui/drag.js).

// SlotSkillGrid.HOLD_TIME.
export const HOLD_MS = 1000;

// Every hold made, so cancelHolds can reach them.
const holds = new Set();
export function cancelHolds() { holds.forEach(h => h.cancel()); }

// duration: the hold time in ms, read at each press so a changed setting applies at once.
export function createHold(duration = () => HOLD_MS) {
  let timer = 0, held = null, off = null;

  function cancel() {
    clearTimeout(timer);
    if (held) held.classList.remove("holding");
    if (off) off.abort();
    held = off = null;
  }

  // ends: [target, event type, test?] that let go of the hold.
  function start(el, done, ends) {
    cancel();
    const ms = duration();
    if (ms <= 0) { done(); return; }
    held = el; off = new AbortController();
    el.style.setProperty("--hold", `${ms}ms`);
    el.classList.add("holding");
    const ending = [...ends, [window, "blur"]];
    for (const [target, type, test] of ending) {
      target.addEventListener(type, e => { if (!test || test(e)) cancel(); }, { signal: off.signal });
    }
    timer = setTimeout(() => { cancel(); done(); }, ms);
  }

  const hold = {
    // Primary button: ends on release anywhere, or when the pointer leaves the element (the game's MOUSE_OUT).
    press(e, el, done) {
      if (e.button !== 0) return;
      start(el, done, [[document, "pointerup"], [document, "pointercancel"], [el, "pointerleave"]]);
    },
    // A key: ends when that key is released.
    key(e, el, done) {
      const key = e.key.toLowerCase();
      start(el, done, [[document, "keyup", k => k.key.toLowerCase() === key]]);
    },
    cancel,
    active: () => held !== null
  };
  holds.add(hold);
  return hold;
}
