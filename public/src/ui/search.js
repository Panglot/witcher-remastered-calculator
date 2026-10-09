// Skill search: Ctrl+F (Cmd+F on a Mac) or the legend's Search asks for a query in the message
// popup (ui/popup.js, fieldsPopup). The skills and mutagens it matches (core/search.js), in the
// tree, the inventory and the slots, are framed like a skill set's skills and pulse like the
// selection (ui/gamePanels.js, mark). When the open tab shows none of them, the tab of the first
// match opens and focuses it, without selecting it. A query that finds nothing closes the popup with a toast and clears the
// search, as does accepting an empty field (Clear empties it); Cancel keeps the search.
// The key works while no popup or menu is open and no field has focus, like the build rail's.
import { fieldsPopup } from "./popup.js";
import { queryWords } from "../core/search.js";
import { MUTAGEN_TAB } from "../core/catalog.js";
import { openTab } from "../core/slotKinds.js";

const typing = el => !!(el && el.closest && el.closest("input, textarea, select, [contenteditable]"));

export function mountSearch(app) {
  const { catalog, state, kinds } = app;
  let asking = false;

  const nothingFound = f => !f.skill.size && !f.mutagen.size;
  // The first match in tab order, as [kind name, id], or null.
  function firstMatch(found) {
    for (const t of catalog.tabs) {
      if (t === MUTAGEN_TAB) {
        const m = Object.values(catalog.mutagens).find(x => found.mutagen.has(x.id));
        if (m) return ["mutagen", m.id];
      } else {
        const n = catalog.skillsIn(t).find(x => found.skill.has(x.id));
        if (n) return ["skill", n.id];
      }
    }
    return null;
  }
  const shownInTab = found => state.tab === MUTAGEN_TAB ? found.mutagen.size > 0
    : [...found.skill].some(id => catalog.nodes[id].tree === state.tab);

  async function open() {
    if (asking || !app.game || app.layers.blocking()) return;
    asking = true;
    const values = await fieldsPopup(app, {
      title: "Search",
      fields: [{ name: "query", label: "Find", value: state.search, placeholder: "Name, effect or skill set", maxLength: 60, clearable: true }],
      accept: "Search"
    });
    asking = false;
    if (!values) return;
    const query = values.query.trim();
    const missed = queryWords(query).length > 0 && nothingFound(app.found(query));
    if (missed) app.toast.show("Nothing matches the search criteria");
    state.search = missed ? "" : query;
    app.msg = "";
    const found = app.found(), first = !shownInTab(found) && firstMatch(found);
    if (first) openTab(kinds, state, kinds[first[0]].tabOf(first[1]));
    app.render();
    if (first) app.views.tree.focus(...first);
  }

  document.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
    // A second Ctrl+F over the search popup doesn't open the browser's find over it.
    if (asking) { e.preventDefault(); return; }
    if (!app.game || app.layers.blocking() || typing(e.target)) return;
    e.preventDefault();
    if (!e.repeat) open();
  });

  return { open, render() {} };
}
