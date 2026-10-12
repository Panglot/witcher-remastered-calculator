// The Mutations panel (MutationPanelRef): a full-screen modal layer (ui/layers.js) over the planner,
// opened from the orb in the slot panel or with C (both in ui/slots.js) while the build has mutations (core/mutations.js),
// closed with C or Esc. It draws with the game art (gamePanels.mutationPanel) and has its own tooltip
// (ui/tipHost.js) and key legend.
// Like the skill tree: pressing a mutation selects it; holding the left button or E researches it
// (the hold starts only where research can start, as the game's purchase hold does); a double-click
// or Space activates it, or deactivates the active one. The right button or Delete steps back:
// it deactivates the active mutation, else unresearches it, taking what needs it too with the
// cascade removal setting (their backgrounds fade out; ui/cascade.js previews what would go).
// Strengthened Synapses shows its stage. Phones and portrait screens get the planner's tall layout
// (ui/mutationLayouts.js), switched as the window changes. The background covers the whole screen
// in both (.gbackdrop); it is drawn on first open and its layers move as in the game (ui/motion.js).
import { esc, isLongPress, keyTarget, patchHtml, afterAnimation, STACKED_QUERY } from "./dom.js";
import { createCascade } from "./cascade.js";
import { createHold } from "./hold.js";
import { createTipHost } from "./tipHost.js";
import { mutationTip, masterTip } from "./tooltip.js";
import { mutationArtColor, MUTATION_NODES, SCREEN } from "./gameArt.js";
import { playMotions } from "./motion.js";
import { MUTATIONS_KEY } from "./slots.js";

const ROMAN = ["", "I", "II", "III", "IV"];
// The panel's selection that is Strengthened Synapses, not a mutation.
const MASTER = "master";

export function mountMutations(app) {
  const { catalog, mutations, state } = app;
  const { items, labels } = catalog.mutations;
  const idOf = node => `mutation${MUTATION_NODES[node]}`;

  const root = document.createElement("div");
  root.className = "gmut";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", labels.title || "Mutations");
  root.tabIndex = -1;
  root.innerHTML = `<div class="gbackdrop"></div><div class="gmut-view" data-panel></div><div class="gmut-legend"></div><div class="gmut-tip" hidden></div>`;
  document.body.append(root);
  const view = root.querySelector(".gmut-view"), legendEl = root.querySelector(".gmut-legend");
  const backdrop = root.querySelector(".gbackdrop");

  // What is selected in the panel: a mutation id, MASTER or null. Not part of the build.
  let sel = null;
  const hold = createHold(() => app.settings.holdMs);
  const nodeEl = id => view.querySelector(`[data-mnode="${id}"]`);
  const nodeOf = e => { const g = e.target.closest && e.target.closest("[data-mnode]"); return g && view.contains(g) ? g : null; };
  const isMutation = id => !!id && id !== MASTER;
  // What stepping back on the hovered or selected mutation would take (ui/cascade.js).
  const cascade = createCascade({
    el: view, selector: "[data-mutation]", idOf: g => g.dataset.mutation, on: app.cascade,
    takes: id => mutations.cascadeOf(state, id), selected: () => isMutation(sel) ? sel : null
  });

  const layer = {
    name: "mutations", modal: true, rightBack: false,
    live: () => [root],
    keys,
    escape: close
  };
  const isOpen = () => app.layers.isOpen(layer);
  const stacked = window.matchMedia(STACKED_QUERY);
  stacked.addEventListener("change", () => render());

  function open() {
    if (isOpen() || !app.game || !mutations.isOn(state)) return;
    sel = null; app.msg = "";
    root.classList.remove(LEAVE);
    root.hidden = false;
    app.layers.open(layer);
    drawBackdrop();
    render();
    root.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    hold.cancel();
    app.layers.close(layer);
    // It slides away (styles.css, .gmut-leave), then hides, unless it was opened again meanwhile.
    root.classList.add(LEAVE);
    afterAnimation(root, () => { if (!isOpen()) { root.classList.remove(LEAVE); root.hidden = true; } });
    app.msg = "";
    app.render();
  }
  const LEAVE = "gmut-leave";

  // The background, once: its art loads only when the panel is first opened.
  function drawBackdrop() {
    if (backdrop.firstChild) return;
    backdrop.innerHTML = `<svg viewBox="0 0 ${SCREEN.w} ${SCREEN.h}" preserveAspectRatio="xMidYMid slice">${app.game.pieces.mutationBackground()}</svg>`;
    playMotions(backdrop, app.game.art);
  }

  // Selects in place, so the pressed element stays (holds and double-clicks need it).
  function select(id) {
    if (sel === id) return;
    sel = id; app.msg = "";
    view.querySelectorAll(".gmnode.selected").forEach(n => n.classList.remove("selected"));
    if (id && nodeEl(id)) nodeEl(id).classList.add("selected");
    drawLegend(); tips.render(); cascade.refresh();
  }

  function shake(id) {
    const g = nodeEl(id);
    if (g) { g.classList.remove("shake"); void g.getBBox(); g.classList.add("shake"); }
  }
  // Runs an action on a mutation and redraws everything (research spends the build's points),
  // fading out what a cascade took.
  function act(id, run) {
    select(id);
    const r = run();
    cascade.took(r);
    app.msg = r.msg;
    app.render();
    if (!r.ok && r.msg) shake(id);
    const g = nodeEl(id);
    if (g) g.focus({ preventScroll: true });
  }
  const research = id => act(id, () => mutations.research(state, id));
  // Space and the double-click: activate, or deactivate the active one.
  function toggle(id) {
    if (!isMutation(id)) return;
    act(id, () => mutations.equipped(state) === id ? mutations.unequip(state) : mutations.equip(state, id));
  }
  // The right button and Delete: deactivate, else unresearch.
  function stepBack(id) {
    if (!isMutation(id)) return;
    if (mutations.equipped(state) === id) act(id, () => mutations.unequip(state));
    else if (mutations.isResearched(state, id)) act(id, () => mutations.unresearch(state, id, { cascade: app.cascade() }));
  }

  view.addEventListener("pointerdown", e => {
    const g = nodeOf(e); if (!g || e.button !== 0) return;
    const id = g.dataset.mnode;
    select(id);
    if (isMutation(id) && mutations.canResearch(state, id)) hold.press(e, g, () => research(id));
  });
  // A click on empty space drops the selection.
  view.addEventListener("click", e => { if (!nodeOf(e)) select(null); });
  view.addEventListener("dblclick", e => { const g = nodeOf(e); if (g) toggle(g.dataset.mnode); });
  view.addEventListener("contextmenu", e => {
    e.preventDefault();
    const g = nodeOf(e);
    // A long press is the hold, not a right-click.
    if (g && !isLongPress(e) && !hold.active()) stepBack(g.dataset.mnode);
  });
  legendEl.addEventListener("click", e => {
    const b = e.target.closest("[data-action]"); if (!b) return;
    ({ close, activate: () => toggle(sel), deactivate: () => toggle(sel), remove: () => stepBack(sel) })[b.dataset.action]?.();
  });

  // Keys while open (the layer gets them first): C closes; E, Space and Delete act on the focused
  // mutation, else the selected one.
  const target = () => {
    const g = keyTarget(view, "[data-mnode]", () => (sel ? nodeEl(sel) : null));
    return g ? g.dataset.mnode : null;
  };
  function keys(e) {
    const key = e.key.toLowerCase();
    if (key === MUTATIONS_KEY.toLowerCase()) { if (!e.repeat) close(); return true; }
    if (e.repeat) return ["e", " ", "delete", "backspace"].includes(key);
    const id = target();
    if (key === "e") {
      if (isMutation(id) && mutations.canResearch(state, id)) { select(id); hold.key(e, nodeEl(id), () => research(id)); }
      return true;
    }
    if (key === " ") { toggle(id); return true; }
    if (key === "delete" || key === "backspace") { stepBack(id); return true; }
    if (key === "enter" && id) { select(id); return true; }
    return false;
  }


  const tips = createTipHost({
    area: root, el: root.querySelector(".gmut-tip"),
    kinds: {
      mutation: part => mutationTip(app, part.dataset.mutation, part.dataset.mutation === sel ? app.msg : ""),
      master: () => masterTip(app)
    },
    shown: () => !!app.game && isOpen()
  });

  // Legend items: the selection's actions, then Close.
  const ITEM = {
    research: { mouse: "left", key: "E", prefix: "[Hold]", label: labels.research },
    activate: { mouse: "left", clicks: 2, key: "Space", label: labels.activate, action: "activate" },
    deactivate: { mouse: "left", clicks: 2, key: "Space", label: labels.deactivate, action: "deactivate" },
    remove: { mouse: "right", label: "Remove mutation", action: "remove" },
    close: { key: MUTATIONS_KEY, label: "Close", action: "close" }
  };
  function legendItems() {
    const own = !isMutation(sel) ? []
      : mutations.equipped(state) === sel ? [ITEM.deactivate]
      : mutations.isResearched(state, sel) ? [ITEM.activate, ITEM.remove]
      : mutations.canResearch(state, sel) ? [ITEM.research] : [];
    return [own, [ITEM.close]];
  }
  let drawnLegend = "";
  function drawLegend() {
    const html = app.game.panels.legend(legendItems());
    if (html !== drawnLegend) { legendEl.innerHTML = html; drawnLegend = html; }
  }

  function nodeView(node, c) {
    const id = idOf(node), m = items[id];
    const enabled = mutations.requirementsMet(state, id), researched = mutations.isResearched(state, id), equipped = mutations.equipped(state) === id;
    const status = equipped ? "active" : researched ? "researched" : enabled ? "can be researched" : "locked";
    return {
      node, icon: `mutations/${m.icon}.png`, color: mutationArtColor(m.colors), enabled, researched, equipped, selected: sel === id,
      cls: c.cls(id), fading: c.fading(id),
      attrs: ` data-mnode="${id}" data-mutation="${id}" tabindex="0" role="button" aria-label="${esc(`${m.name}, ${status}`)}"`
    };
  }

  // A connector takes the colour of the mutation it leads from once that is researched; the three
  // from the centre take the active mutation's (MutationItemRenderer / MasterMutationItemRenderer.updateConnectors).
  function connectorColor(name) {
    const from = name.match(/^mcMutConnector(\d+)_/);
    if (!from) return mutations.equipped(state) ? mutationArtColor(items[mutations.equipped(state)].colors) : "gray";
    const id = idOf(+from[1]);
    return mutations.isResearched(state, id) && mutations.requirementsMet(state, id) ? mutationArtColor(items[id].colors) : "gray";
  }

  function render() {
    if (!isOpen() || !app.game) return;
    // The build can lose its mutations while open only by loading another build: the panel goes.
    if (!mutations.isOn(state)) { close(); return; }
    if (isMutation(sel) && !items[sel]) sel = null;
    const equipped = mutations.equipped(state);
    const c = cascade.view();
    const nodes = Object.keys(MUTATION_NODES).map(n => nodeView(+n, c));
    const master = {
      color: equipped ? mutationArtColor(items[equipped].colors) : "default", stage: ROMAN[mutations.stage(state)], selected: sel === MASTER,
      attrs: ` data-mnode="${MASTER}" data-master tabindex="0" role="button" aria-label="${esc(`${catalog.mutations.master.name}, stage ${mutations.stage(state)}`)}"`
    };
    const points = app.stats.points(state, app.lockMode()).left;
    const layouts = app.game.panels.mutationLayouts(), layout = stacked.matches ? layouts.stacked : layouts.game;
    patchHtml(view, `<svg class="gsvg gmut-svg" viewBox="${layout.view.join(" ")}" preserveAspectRatio="xMidYMid meet">`
      + app.game.panels.mutationPanel({ layout, nodes, master, connectorColor, title: labels.title, points }) + `</svg>`);
    drawLegend();
    tips.render();
  }

  return { render, open, close, isOpen };
}
