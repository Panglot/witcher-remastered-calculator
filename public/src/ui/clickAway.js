// Clicking away deselects: a left click that lands on no skill, mutagen or holder and on no
// control (a button, a tab, a field, anything focusable, a dialog) selects nothing, for every
// kind (core/slotKinds.js, deselect); the open tab stays. Not in apply mode or under a modal
// layer, which have their own ways out. The press has to start away too, so a press on a skill
// that slips off it before release (the click lands on their common parent) keeps the selection;
// a drag's release fires no click at all (ui/drag.js).

// What a click keeps the selection on: the items and holders, and the page's controls.
const KEEPS = "[data-id], [data-mutagen], [data-slot], [data-group], [data-step], [data-tab], "
  + "button, a, input, select, textarea, label, [tabindex], [role=dialog], [role=toolbar]";

const away = e => e.button === 0 && e.target instanceof Element && !e.target.closest(KEEPS);

export function mountClickAway(app) {
  let pressedAway = false;
  document.addEventListener("pointerdown", e => { pressedAway = away(e); });
  document.addEventListener("click", e => {
    const was = pressedAway; pressedAway = false;
    if (!was || !away(e) || app.apply || app.layers.blocking()) return;
    const { kinds, state } = app;
    if (!Object.values(kinds).some(k => k.selected(state))) return;
    Object.values(kinds).forEach(k => k.deselect(state));
    app.msg = ""; app.render();
  });
}
