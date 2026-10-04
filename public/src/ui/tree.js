// The tree panel of the Character screen: the tabs, then the open tab's content, drawn with the
// game art once it has loaded (app.game). A tree tab shows its skills (below); the Mutagens tab
// shows the inventory (ui/mutagenList.js).
// Skills: pressing selects; holding the left button or E (on the focused or selected skill) adds a
// point, as the game's "[Hold] Acquire Ability" does (ui/hold.js); right-click removes one. Space or
// a double-click on a learned skill equips it through apply mode (ui/applyMode.js). With a skill
// focused, Enter selects and + / - change rank.
import { $, esc, keyTarget } from "./dom.js";
import { createHold } from "./hold.js";
import { skillIcon, TREE_ART } from "./gameArt.js";
import { VIEWS } from "./gamePanels.js";
import { MUTAGEN_TAB } from "../core/catalog.js";
import { createMutagenList, MUTAGEN_ART_TAB } from "./mutagenList.js";

/**
 * What a tab shows and how it reacts. The panel handles the tabs and hands every other event on.
 * Pointer handlers are optional; hotkey(e) gets page-wide key presses (dom.js, createHotkeys) and
 * returns true when it used one. liftView(id) is the item's view for apply mode's lifted copy
 * (gamePanels.treePanelLift); focus(id) focuses the item.
 * @typedef {{ panel(): { bg: string, title: string, grid?: object, items?: object[] },
 *   onOpen?(): void, pointerdown?(e: PointerEvent): void, click?(e: Event): void, dblclick?(e: Event): void,
 *   contextmenu?(e: Event): void, keydown(e: KeyboardEvent): void, hotkey?(e: KeyboardEvent): boolean,
 *   liftView(id: string): object, icon(id: string): string, focus(id: string): void }} TabContent
 */

export function mountTree(app) {
  const { catalog, state } = app;
  const el = $("treePanel");
  const skills = createSkillTree(app, el);
  const mutagenList = createMutagenList(app, el);
  /** @returns {TabContent} */
  const content = () => state.tab === MUTAGEN_TAB ? mutagenList : skills;
  // The content listing each slot kind (core/slotKinds.js).
  const byKind = { skill: skills, mutagen: mutagenList };

  function openTab(t) {
    state.tab = t; app.msg = "";
    const c = content();
    if (c.onOpen) c.onOpen();
    app.render();
  }

  // Hands an event to the open tab's content, if it handles that type.
  const pass = e => { const handler = content()[e.type]; if (handler) handler(e); };
  el.addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) openTab(tab.dataset.tab); else pass(e);
  });
  ["pointerdown", "dblclick", "contextmenu"].forEach(type => el.addEventListener(type, pass));
  el.addEventListener("keydown", e => {
    const tab = e.target.closest("[data-tab]");
    // The tab takes the key, so Space doesn't also equip the selected skill (page-wide keys).
    if (tab && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); openTab(tab.dataset.tab); return; }
    content().keydown(e);
  });
  app.hotkeys.add(e => {
    const c = content();
    return !e.repeat && !!c.hotkey && c.hotkey(e);
  });

  // Tree tabs count the points spent in them; the Mutagens tab counts equipped mutagens.
  function tabView(t) {
    const open = t === state.tab, mut = t === MUTAGEN_TAB;
    const name = mut ? "Mutagens" : catalog.trees[t].name;
    return {
      id: mut ? MUTAGEN_ART_TAB : t, open,
      count: mut ? state.mut.filter(Boolean).length : app.planner.spentIn(state, t),
      attrs: ` data-tab="${t}" role="tab" tabindex="0" aria-selected="${open}" aria-label="${esc(name)}"`
    };
  }

  function render() {
    if (!app.game) return;
    const view = content().panel();
    el.innerHTML = app.game.panels.svg(VIEWS.tree,
      app.game.panels.treePanel({ ...view, tabs: catalog.tabs.map(tabView) }),
      ` role="group" aria-label="${esc(view.title)}"`);
  }

  return {
    render,
    liftView: (kind, id) => byKind[kind].liftView(id),
    icon: (kind, id) => byKind[kind].icon(id),
    focus: (kind, id) => byKind[kind].focus(id)
  };
}

/**
 * A tree tab's content: the open tree's skills and their lines.
 * @returns {TabContent}
 */
function createSkillTree(app, el) {
  const { catalog, planner, state } = app;
  const { nodes, edges, maxRank } = catalog;

  const nodeEl = id => el.querySelector(`.gnode[data-id="${id}"]`);
  function focusNode(id) { const g = nodeEl(id); if (g) g.focus({ preventScroll: true }); }
  // Selecting in the tree takes the selection off any socket (core/slotKinds.js).
  const kind = app.kinds.skill;
  const selectNode = id => kind.select(state, id);
  function shake(id) {
    const g = nodeEl(id);
    if (g) { g.classList.remove("shake"); void g.getBBox(); g.classList.add("shake"); }
  }
  // Runs a planner action on a skill, redraws, keeps focus, and shakes the node if it was refused with a reason.
  function act(id, action) {
    selectNode(id);
    const r = action(state, id);
    app.msg = r.msg; app.render(); focusNode(id);
    if (!r.ok && r.msg) shake(id);
  }
  const skillOf = e => { const g = e.target.closest("[data-id]"); return g && g.dataset.id; };
  // Selects in place (no tree redraw), so the pressed element stays under the pointer.
  function selectInPlace(g) {
    selectNode(g.dataset.id); app.msg = "";
    el.querySelectorAll(".gnode.selected").forEach(n => n.classList.remove("selected"));
    g.classList.add("selected");
    ["slots", "legend", "tooltip"].forEach(v => app.views[v].render()); app.save();
  }
  // Hold to acquire: the game only starts the fill on a skill that can take a point.
  const hold = createHold(() => app.settings.holdMs);
  const acquire = id => act(id, planner.addPoint);
  // The skill E and Space act on: the focused one, else the selection when the panel frames it.
  const target = () => keyTarget(el, ".gnode[data-id]",
    () => state.sel && kind.framedInPanel(state, state.sel) ? nodeEl(state.sel) : null);
  // Equipping goes through apply mode; the game ignores it on a skill without points.
  const equip = id => app.views.apply.start("skill", id);

  /** @returns {import("./gamePanels.js").NodeView} */
  function nodeView(n) {
    const rank = planner.rank(state, n.id), open = planner.isOpen(state, n.id);
    return {
      col: n.col, row: n.row, mid: n.midLines, icon: skillIcon(n.tree, n.game), rank,
      state: rank > 0 ? "learned" : open ? "open" : "locked", selected: kind.framedInPanel(state, n.id),
      attrs: ` data-id="${n.id}" data-tip="${n.id}" data-drag="skill" data-drag-item="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)}, rank ${rank} of ${maxRank}${open ? "" : ", locked"}"`
    };
  }

  // Skills of the highlighted archetypes (ui/archetypes.js).
  function highlighted() {
    const ids = new Set();
    state.arch.forEach(a => { const A = catalog.archetypes.find(x => x.id === a); if (A) A.ids.forEach(i => ids.add(i)); });
    return ids;
  }

  // Game line states (docs/game-assets.md, Line colors), from the required skill to the one it
  // opens: lit when both are learned, white when only the required one is, dark otherwise.
  function linkState(from, to) {
    const lf = planner.rank(state, from) > 0;
    return lf && planner.rank(state, to) > 0 ? "lit" : lf ? "open" : "closed";
  }

  return {
    // Opening a tree selects its first skill unless the selection is already in it.
    onOpen() {
      if (!state.sel || nodes[state.sel].tree !== state.tab) selectNode(catalog.skillsIn(state.tab)[0].id);
    },
    pointerdown(e) {
      const g = e.target.closest("[data-id]"); if (!g || e.button !== 0) return;
      selectInPlace(g);
      const id = g.dataset.id;
      if (planner.canAddPoint(state, id)) hold.press(e, g, () => acquire(id));
    },
    dblclick(e) { const id = skillOf(e); if (id) equip(id); },
    contextmenu(e) {
      const id = skillOf(e); if (!id) return;
      e.preventDefault();
      // A touch long-press fires contextmenu; it must not remove a point mid-hold.
      if (!hold.active()) act(id, planner.removePoint);
    },
    hotkey(e) {
      const key = e.key.toLowerCase();
      if (key !== "e" && key !== " ") return false;
      const g = target(); if (!g) return false;
      const id = g.dataset.id;
      if (key === " ") { equip(id); return true; }
      selectInPlace(g); g.focus({ preventScroll: true });
      if (planner.canAddPoint(state, id)) hold.key(e, g, () => acquire(id));
      return true;
    },
    keydown(e) {
      const id = skillOf(e); if (!id) return;
      if (e.key === "Enter") { e.preventDefault(); selectNode(id); app.msg = ""; app.render(); focusNode(id); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); act(id, planner.addPoint); }
      else if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); act(id, planner.removePoint); }
    },
    liftView: id => ({ color: TREE_ART[nodes[id].tree].color, node: nodeView(nodes[id]) }),
    icon: id => skillIcon(nodes[id].tree, nodes[id].game),
    focus: focusNode,
    panel() {
      const T = catalog.trees[state.tab];
      const list = catalog.skillsIn(state.tab);
      const index = Object.fromEntries(list.map((n, i) => [n.id, i]));
      const marked = highlighted();
      const grid = {
        color: TREE_ART[state.tab].color,
        nodes: list.map(n => ({ ...nodeView(n), marked: marked.has(n.id) })),
        links: edges.filter(([a]) => nodes[a].tree === state.tab)
          .map(([a, b]) => ({ a: index[a], b: index[b], state: linkState(a, b) }))
      };
      return { bg: state.tab, title: T.name, grid };
    }
  };
}
