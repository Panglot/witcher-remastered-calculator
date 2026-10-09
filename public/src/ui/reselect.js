// Clicking the selected skill or mutagen again deselects it (core/slotKinds.js, deselect), in the
// tree, the inventory and the slots alike. Selecting is immediate; deselecting waits RESELECT_MS,
// and a press within that time (the second click of a double-click, or a press anywhere in the
// panel) calls it off, so a double-click on the selected item keeps it selected and only runs the
// double-click's own action (equip, unequip). A click keeps the selection too when its own press
// just selected the item (panels select on press, for holds) or held until its action ran.

// How long a deselecting click waits for a second click.
export const RESELECT_MS = 300;

export function createReselect(ms = RESELECT_MS) {
  // The click that follows keeps the selection.
  let keep = false, timer = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  return {
    // On press: `selected` is whether the item was selected before the press.
    press(selected) { cancel(); keep = !selected; },
    // The press held until its action ran (ui/hold.js).
    held() { keep = true; },
    // On click, given whether the item was selected: runs `deselect` once no second click came.
    // Enter (its key event, or the click it sends) has no press and detail 0: it deselects at once.
    click(e, selected, deselect) {
      const off = selected && (e.detail === 0 || (!keep && e.detail === 1));
      keep = false; cancel();
      if (!off) return;
      if (e.detail === 0) deselect();
      else timer = setTimeout(() => { timer = 0; deselect(); }, ms);
    },
    // Calls off a deselect that is waiting.
    cancel
  };
}
