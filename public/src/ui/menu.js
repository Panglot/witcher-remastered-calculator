// The Esc menu, like the game's in-game menu (panel_ingamemenu, MenuListModule) but centred: text
// items on a torn black sheet over a fainter mask, the hovered or focused item in a framed box.
// Submenus (Settings, About) switch the content inside the menu; they are not layers of their own.
// The menu is a modal layer (ui/layers.js): Esc or the right mouse button goes back from a submenu,
// then closes the menu; with nothing else open, Esc opens it (docs/roadmap.md, items 2 and 8).
//
// Every page shows the game's logo above its title, as in game, and the fan content notice at the
// bottom, so the logo never appears without it. About says it in its own text instead.
//
// Each menu page is { title, sub?, body?, ownNotice?, items }; an item is { label, open? | run? | unavailable? }:
// open: the page it switches to, run: what it does, unavailable: shown greyed out, does nothing.
// Submenus get a Back item at the end.
import { esc } from "./dom.js";
import { confirmPopup } from "./popup.js";
import { clearSavedState } from "../state.js";

// The game version the planner follows, shown under the logo.
const GAME_VERSION = "5.0.0c";
const FAN_NOTICE ="Unofficial fan work, not approved or endorsed by CD PROJEKT RED.";
const ABOUT = [
  "A build planner for The Witcher 3: Wild Hunt (Remastered): spend skill points, slot skills and mutagens, and share the build as a code or a file.",
  "The screen is drawn with the game's own interface art and layout, read from the game files. Skill descriptions and numbers are not in yet.",
  "The Witcher and all related names, icons and assets are property of CD PROJEKT RED. " + FAN_NOTICE + " Free and non-commercial, made for the community."
];
// Keys the menu takes besides Esc: E picks the focused item (Enter and Space press a focused
// button already), the arrows move between items.
const PICK_KEY = "e";
const MOVE_KEYS = { ArrowUp: -1, ArrowDown: 1 };

export function mountMenu(app) {
  const pages = {
    main: { title: "Build planner", items: [
      { label: "Resume", run: close },
      // The Build submenu's form is still open (docs/roadmap.md, item 5).
      { label: "Build", unavailable: true },
      { label: "Settings", open: "settings" },
      { label: "About", open: "about" }
    ] },
    settings: { title: "Settings", items: [
      { label: "Reset saved data", run: resetSavedData }
    ] },
    about: { title: "About", body: ABOUT, ownNotice: true, items: [] }
  };

  const root = document.createElement("div");
  root.className = "glayer gmenu-layer";
  root.innerHTML = `<div class="glayer-mask"></div><div class="gmenu-sheet"></div>
    <div class="gmenu" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1"></div>
    <div class="gmenu-legend"></div>`;
  const menu = root.querySelector(".gmenu"), legend = root.querySelector(".gmenu-legend");

  // The page shown, the item to focus on going back to the page that opened it, and the item that
  // has (or last had) focus: the one E and the legend's Select pick, even after focus moved away.
  let page = "main", current = null;
  const cameFrom = [];

  const layer = {
    name: "menu", modal: true,
    live: () => [root],
    keys(e) {
      if (e.key in MOVE_KEYS) { move(MOVE_KEYS[e.key]); return true; }
      if (e.key.toLowerCase() !== PICK_KEY) return false;
      if (!e.repeat) pick(current);
      return true;
    },
    escape: back
  };

  const items = () => [...menu.querySelectorAll(".gmenu-item")];

  function draw(focusIndex = 0) {
    const p = pages[page], sub = page !== "main";
    const list = sub ? [...p.items, { label: "Back", run: back, back: true }] : p.items;
    const subtitle = !sub && app.state.name ? app.state.name : "";
    menu.setAttribute("aria-label", p.title);
    menu.innerHTML = `<img class="gmenu-logo" src="assets/ui/menu/logo.png" alt="The Witcher 3: Wild Hunt Remastered">
      <p class="gmenu-version">${esc(GAME_VERSION)}</p>
      <p class="gmenu-title">${esc(p.title)}</p>
      ${subtitle ? `<p class="gmenu-sub">${esc(subtitle)}</p>` : ""}
      ${p.body ? `<div class="gmenu-body">${p.body.map(t => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      <ul class="gmenu-list">${list.map((item, i) => `<li><button type="button" class="gmenu-item${item.back ? " back" : ""}"
        data-i="${i}"${item.unavailable ? ` aria-disabled="true"` : ""}>${esc(item.label)}</button></li>`).join("")}</ul>
      ${p.ownNotice ? "" : `<p class="gmenu-note">${esc(FAN_NOTICE)}</p>`}`;
    menu.list = list;
    legend.innerHTML = app.game ? app.game.panels.legend([
      { key: "E", label: "Select", action: "pick" },
      { key: "Esc", label: sub ? "Back" : "Close", action: "back" }
    ]) : "";
    const all = items();
    (all[focusIndex] || all[0]).focus({ preventScroll: true });
  }

  function show(name, focusIndex = 0) {
    page = name;
    draw(focusIndex);
  }

  function pick(button) {
    if (!button || !menu.contains(button)) return;
    const item = menu.list[+button.dataset.i];
    if (item.unavailable) return;
    if (item.open) { cameFrom.push({ page, index: +button.dataset.i }); show(item.open); }
    else item.run();
  }

  function move(step) {
    const all = items(), i = Math.max(0, all.indexOf(current));
    all[(i + step + all.length) % all.length].focus({ preventScroll: true });
  }

  /** Esc and the right mouse button: back to the page that opened this one, else close. */
  function back() {
    const from = cameFrom.pop();
    if (from) show(from.page, from.index);
    else close();
  }

  function open() {
    if (app.layers.isOpen(layer)) return;
    page = "main"; cameFrom.length = 0;
    // Appended last, so it sits above every layer open before it.
    document.body.append(root);
    app.layers.open(layer);
    draw();
  }

  function close() {
    if (!app.layers.isOpen(layer)) return;
    app.layers.close(layer);
    root.remove();
  }

  async function resetSavedData() {
    if (!app.game) return;
    const yes = await confirmPopup(app, {
      title: "Reset saved data",
      text: "Delete the build kept in this browser and start over? Copy or export the build first to keep it."
    });
    if (!yes) return;
    clearSavedState(app.catalog, app.state);
    app.msg = "";
    close();
    app.render();
  }

  menu.addEventListener("click", e => pick(e.target.closest(".gmenu-item")));
  menu.addEventListener("focusin", e => { current = e.target.closest(".gmenu-item") || current; });
  // The pointer picks like the arrow keys: the item under it gets the frame.
  menu.addEventListener("pointerover", e => {
    const button = e.target.closest(".gmenu-item");
    if (button && document.activeElement !== button) button.focus({ preventScroll: true });
  });
  legend.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "back") back();
    else pick(current);
  });

  // Esc with nothing open opens the menu. In a field it only leaves the field first.
  app.layers.onIdleEscape(() => {
    const f = document.activeElement;
    if (f && f.closest && f.closest("input, textarea, select, [contenteditable]")) { f.blur(); return true; }
    open();
    return true;
  });

  // Redraws an open menu (the build name may have changed).
  function render() {
    if (!app.layers.isOpen(layer) || app.layers.top() !== layer) return;
    draw(Math.max(0, items().indexOf(current)));
  }

  return { render, open, close };
}
