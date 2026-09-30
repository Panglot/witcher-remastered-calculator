// Selected-skill card: rank stepper, slot button, tooltip text, sources, connections.
import { $ } from "./dom.js";

export function mountDetail(app) {
  const { catalog, planner, state } = app;
  const { nodes, trees, maxRank } = catalog;
  const el = $("detail");
  const actions = { plus: planner.addPoint, minus: planner.removePoint, slot: planner.toggleSlot };

  el.addEventListener("click", e => {
    const a = e.target.closest("[data-act]"), go = e.target.closest("[data-go]");
    if (a) { app.msg = actions[a.dataset.act](state, state.sel).msg; app.render(); }
    else if (go) app.select(go.dataset.go);
  });

  function render() {
    const n = nodes[state.sel];
    if (!n) { el.innerHTML = `<p class="meta">Select a skill in the tree.</p>`; return; }
    const T = trees[n.tree], p = planner.rank(state, n.id), slotted = planner.isSlotted(state, n.id);
    const open = planner.isOpen(state, n.id);
    el.style.setProperty("--tc", T.color);
    el.innerHTML = `
      <div class="detail-head">
        <div><div class="treetag">${T.name}${n.root ? " · starting skill" : ""}</div><h3>${n.name}</h3></div>
        <div class="rank num">${p}<small>/${maxRank}</small></div>
      </div>
      <div class="stepper">
        <button class="btn" type="button" data-act="minus" ${p === 0 ? "disabled" : ""} aria-label="Remove a point">−</button>
        <button class="btn primary" type="button" data-act="plus" ${p >= maxRank || !open ? "disabled" : ""} aria-label="Add a point">+</button>
        <button class="btn" type="button" data-act="slot" ${p === 0 && !slotted ? "disabled" : ""}>${slotted ? "Unslot" : "Slot it"}</button>
      </div>
      <div class="msg">${app.msg}</div>
      <p class="effect">${n.text}</p>
      <div class="meta">
        <span>Rank 1 text. Ranks 2 and 3 show in-game once you invest.</span>
        <span>${n.verified ? `<span class="badge ok">Checked in-game</span>` : `<span class="badge src">From Hack the Minotaur</span>`}</span>
        <span>Each point here: ${T.passive.label.toLowerCase()} +${T.passive.per}${T.passive.unit}${T.mutagen ? ` · matches ${T.mutagen} mutagens` : " · matches no mutagen"}</span>
      </div>
      ${n.note ? `<div class="note">${n.note}</div>` : ""}
      <div class="meta">${open ? (n.root ? "Always open." : "Open.") : "Locked. Opens from any of:"}</div>
      <div class="links">${n.nb.map(k => {
        const r = planner.rank(state, k);
        return `<button type="button" data-go="${k}" class="${r > 0 ? "inv" : ""}">${nodes[k].name}${r ? " (" + r + ")" : ""}</button>`;
      }).join("<span aria-hidden='true'>·</span>")}</div>`;
  }

  return { render };
}
