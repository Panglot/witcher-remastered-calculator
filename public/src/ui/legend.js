// Key legend under the planner screen, in the game's style. Like the game, it lists the controls
// for what is selected: the open tab, then the selected skill's state or the socket / diamond that
// frames the selection, then the general controls in a group of their own. "Reset abilities" is a
// button and the R key, both asking first in the game's message popup (ui/popup.js). "Menu" opens
// the Esc menu (ui/menu.js), like Esc; "Statistics" toggles the Statistics panel
// (ui/statistics.js), like D; "Skill sets" the Skill sets panel (ui/skillSets.js), like S; "Builds"
// the Builds panel (ui/builds.js), like B; "Search" asks for a search (ui/search.js), like Ctrl+F;
// "Mutations" opens the Mutations panel (ui/mutationsPanel.js), like C; without mutations it is
// "[Hold] Add mutations", like holding C. Remove
// point, Equip and Unequip are buttons for the selection, like their mouse buttons and keys. Apply
// mode hides the legend while its popup is up.
import { $, isLongPress } from "./dom.js";
import { confirmPopup } from "./popup.js";
import { MUTAGEN_TAB } from "../core/catalog.js";
import { MUTATIONS_KEY } from "./slots.js";

const RESET = { key: "R", label: "Reset abilities", action: "reset" };
const MENU = { key: "Esc", label: "Menu", action: "menu" };
// The Statistics side panel (ui/statistics.js).
const STATS = { key: "D", label: "Statistics", action: "stats" };
// The Skill sets side panel (ui/skillSets.js).
const SKILL_SETS = { key: "S", label: "Skill sets", action: "skillSets" };
// The Builds side panel (ui/builds.js).
const BUILDS = { key: "B", label: "Builds", action: "builds" };
// The Mutations panel (ui/mutationsPanel.js), while the build has mutations; without them C held
// adds them (ui/slots.js), and the button adds them on a click or a hold. Held with mutations, it
// asks to remove them, like the orb and C.
const MUTATIONS = { key: MUTATIONS_KEY, label: "Mutations", action: "mutations" };
const ADD_MUTATIONS = { key: MUTATIONS_KEY, prefix: "[Hold]", label: "Add mutations", action: "addMutations" };
// The skill search popup (ui/search.js).
const SEARCH = { key: "Ctrl+F", label: "Search", action: "search" };
// Left button or E, held (ui/tree.js, ui/slots.js).
const ACQUIRE = { mouse: "left", key: "E", prefix: "[Hold]", label: "Acquire ability" };
// One mouse and one key per item at most: other ways in (drag, double-click to unequip) work unlisted.
// The selection's actions are buttons too, acting on the selection: touch screens have no right
// button or keys, and a long press is the hold.
const UNEQUIP = { mouse: "right", key: "Space", label: "Unequip", action: "unequip" };
const EQUIP = { mouse: "left", clicks: 2, key: "Space", label: "Equip", action: "equip" };
const REMOVE = { mouse: "right", label: "Remove point", action: "remove" };
const UNEQUIP_MUTAGEN = { mouse: "right", label: "Unequip", action: "unequipMutagen" };
// Two groups: the selection's skill controls (Reset abilities always last), then the general ones (Menu last).
const GENERAL = [STATS, SKILL_SETS, BUILDS, ADD_MUTATIONS, SEARCH, MENU];
const WITH_MUTATIONS = [STATS, SKILL_SETS, BUILDS, MUTATIONS, SEARCH, MENU];
// One set of item lists per general group, so a redraw can compare lists by identity.
const itemSet = general => {
  const skillGroup = (...items) => [[...items, RESET], general];
  return {
    unlearned: skillGroup(ACQUIRE),
    learned: skillGroup(ACQUIRE, REMOVE, EQUIP),
    socket: skillGroup(ACQUIRE, UNEQUIP),
    mutagens: skillGroup(EQUIP, UNEQUIP_MUTAGEN),
    diamond: skillGroup(UNEQUIP)
  };
};
const ITEMS_PLAIN = itemSet(GENERAL), ITEMS_MUTATIONS = itemSet(WITH_MUTATIONS);

export function mountLegend(app) {
  const { planner, state, kinds, catalog } = app;
  const el = $("legend");
  let drawn = null, asking = false;

  function itemsFor() {
    const ITEMS = app.mutations.isOn(state) ? ITEMS_MUTATIONS : ITEMS_PLAIN;
    if (state.tab === MUTAGEN_TAB) return kinds.mutagen.heldAt(state) != null ? ITEMS.diamond : ITEMS.mutagens;
    if (kinds.skill.heldAt(state) != null) return ITEMS.socket;
    return state.sel && planner.rank(state, state.sel) > 0 ? ITEMS.learned : ITEMS.unlearned;
  }

  // A reset also clears the build name and puts the points back to a new build's (core/budget.js);
  // it does nothing on a build that is already new.
  const defaultProgress = catalog.budget.defaults();
  const isFresh = () => !Object.keys(state.pts).length && !state.mut.some(Boolean) && !app.mutations.researchedCount(state)
    && !state.name && Object.keys(defaultProgress).every(k => state.progress[k] === defaultProgress[k]);

  async function reset() {
    if (asking || !app.game || isFresh()) return;
    asking = true;
    const yes = await confirmPopup(app, {
      title: "Reset abilities",
      text: app.mutations.isOn(state)
        ? "Reset all abilities and mutation research, the build name and the points? All skills, mutagens and the active mutation will be unequipped."
        : "Reset all abilities, the build name and the points? All skills and mutagens will be unequipped."
    });
    asking = false;
    if (!yes) return;
    planner.clearAll(state);
    state.name = "";
    catalog.budget.restoreDefaults(state);
    app.msg = ""; app.render();
  }

  // The slot kind the open tab shows (skills in a tree tab, mutagens in the Mutagens tab).
  const shownKind = () => state.tab === MUTAGEN_TAB ? "mutagen" : "skill";
  function done(r) { app.msg = r.msg; app.render(); }
  // Selection actions read the selection when pressed; each does nothing without one.
  const ACTIONS = {
    reset,
    menu: () => app.views.menu.open(),
    stats: () => app.views.stats.toggle(),
    skillSets: () => app.views.skillSets.toggle(),
    builds: () => app.views.builds.toggle(),
    search: () => app.views.search.open(),
    mutations: () => app.views.mutations.open(),
    addMutations() { app.mutations.setOn(state, true); app.msg = ""; app.render(); },
    remove() {
      if (!state.sel) return;
      const r = planner.removePoint(state, state.sel, { cascade: app.cascade() });
      app.views.tree.took(r);
      done(r);
    },
    equip() {
      const name = shownKind(), id = kinds[name].selected(state);
      if (id) app.views.apply.start(name, id);
    },
    unequip() {
      const kind = kinds[shownKind()], i = kind.heldAt(state);
      if (i != null) done(kind.clear(state, i));
    },
    unequipMutagen() {
      const id = kinds.mutagen.selected(state);
      if (id) done(planner.unequipMutagen(state, id));
    }
  };
  // The Mutations buttons work like the orb (ui/slots.js): a hold adds or removes mutations.
  const MUTATION_ACTIONS = new Set(["mutations", "addMutations"]);
  const mutationButtonOf = e => { const b = e.target.closest && e.target.closest("[data-action]"); return b && MUTATION_ACTIONS.has(b.dataset.action) ? b : null; };
  el.addEventListener("pointerdown", e => { const b = mutationButtonOf(e); if (b) app.views.slots.pressMutations(e, b); });
  // A touch long-press is the hold, not the browser's menu.
  el.addEventListener("contextmenu", e => { if (isLongPress(e) && mutationButtonOf(e)) e.preventDefault(); });
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (mutationButtonOf(e) && app.views.slots.tookHold()) return;
    if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action]();
  });
  app.hotkeys.add(e => {
    if (e.repeat || e.key.toLowerCase() !== "r") return false;
    reset();
    return true;
  });

  // Redrawn only when the selection needs other items.
  function render() {
    const items = itemsFor();
    if (!app.game || drawn === items) return;
    el.innerHTML = app.game.panels.legend(items);
    drawn = items;
  }

  return { render };
}
