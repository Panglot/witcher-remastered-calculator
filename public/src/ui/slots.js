// Slot groups with their mutagen pickers, plus the "invested but not slotted" line.
import { $ } from "./dom.js";

export function mountSlots(app) {
  const { catalog, planner, state } = app;
  const { nodes, trees, maxRank, mutagens, slots } = catalog;
  const groupsEl = $("groups");

  groupsEl.addEventListener("click", e => {
    const go = e.target.closest("[data-go]"), clear = e.target.closest("[data-clear]"), place = e.target.closest("[data-place]");
    if (clear) { planner.clearSlot(state, +clear.dataset.clear); app.render(); }
    else if (go) app.select(go.dataset.go);
    else if (place) { app.msg = planner.placeInSlot(state, +place.dataset.place, state.sel).msg; app.render(); }
  });
  groupsEl.addEventListener("change", e => {
    const s = e.target.closest("[data-mut]"); if (!s) return;
    state.mut[+s.dataset.mut] = s.value; app.render();
  });

  function renderSlot(index, id, placeable) {
    if (!id) {
      return `<button type="button" class="slot empty${placeable ? " target" : ""}" data-place="${index}">${placeable ? "Place " + nodes[state.sel].name : "Empty slot"}</button>`;
    }
    const n = nodes[id];
    return `<div class="slot full" style="--tc:${trees[n.tree].color}"><button type="button" class="nm" data-go="${id}" style="background:none;border:0;padding:0;text-align:left">${n.name} <span class="num" style="color:var(--muted)">${planner.rank(state, id)}/${maxRank}</span></button><button type="button" class="x" data-clear="${index}" aria-label="Clear slot">×</button></div>`;
  }

  function renderGroup(g, placeable) {
    const bonus = planner.groupBonus(state, g);
    const cells = planner.groupSlots(state, g).map((id, i) => renderSlot(g * slots.perGroup + i, id, placeable)).join("");
    const options = Object.keys(mutagens).map(k => `<option value="${k}" ${k === bonus.mutagen ? "selected" : ""}>${mutagens[k]}</option>`).join("");
    return `<div class="group">
        <div class="group-head"><span>Group ${g + 1}</span>
          <select data-mut="${g}" aria-label="Mutagen for group ${g + 1}">${options}</select></div>
        ${cells}
        <div class="mult">${bonus.mutagen ? `Mutagen bonus <b class="num">×${bonus.multiplier}</b>` : "No mutagen"}</div></div>`;
  }

  function render() {
    const placeable = planner.canPlace(state, state.sel);
    let html = "";
    for (let g = 0; g < slots.groups; g++) html += renderGroup(g, placeable);
    groupsEl.innerHTML = html;
    const un = planner.unslotted(state);
    $("unslotted").innerHTML = un.length ? `Invested but not slotted: ${un.map(id => nodes[id].name).join(", ")}.` : "";
  }

  return { render };
}
