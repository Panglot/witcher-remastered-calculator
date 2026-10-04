// The Esc menu, like the game's in-game menu (panel_ingamemenu, MenuListModule) but centred: text
// items on a torn black sheet over a fainter mask, the hovered or focused item in a framed box.
// Submenus (Settings, About) switch the content inside the menu; they are not layers of their own.
// The menu is a modal layer (ui/layers.js): Esc or the right mouse button goes back from a submenu,
// then closes the menu; with nothing else open, Esc opens it.
//
// Every page shows the game's logo above its title, as in game, and the fan content notice at the
// bottom, so the logo never appears without it. About says it in its own text instead.
//
// Each menu page is { title, sub?, body?, ownNotice?, options?, items }; an item is { label, open? | run? | drawer? | unavailable? }:
// open: the page it switches to, run: what it does, drawer: content that opens under the item like
// an accordion (ui/buildMenu.js has the interface), unavailable: shown greyed out, does nothing.
// Submenus get a Back item at the end. options: settings picked with sliders (ui/options.js). A page
// with options is laid out like the game's options screen: the menu moves to the game's place left
// of centre and the option rows sit on its right. The arrows up and down move through the rows and
// then the items; left and right change the focused row, E steps it round. In an open drawer the
// arrows up and down stop once on each of its rows (its parts with class gmenu-stop and tabindex 0),
// left and right move along a row, and Esc closes the drawer first. Parts with data-hint get the
// game's hint tooltip, like on the planner screen (ui/tooltip.js).
import { esc } from "./dom.js";
import { confirmPopup } from "./popup.js";
import { bindOptionRows, optionRowsHtml } from "./options.js";
import { createBuildDrawer } from "./buildMenu.js";
import { createTipHost } from "./tipHost.js";
import { hintTip } from "./tooltip.js";
import { clearSavedState } from "../state.js";
import { OPTIONS, clearSavedSettings } from "../settings.js";
import { FAN_NOTICE, REPO_URL } from "./pageInfo.js";

// The game version the planner follows, shown under the logo.
const GAME_VERSION = "5.0.0c";
const ABOUT = [
  "A build planner for The Witcher 3: Wild Hunt (Remastered): spend skill points, slot skills and mutagens, and share the build as a code or a file.",
  "The screen is drawn with the game's own interface art and layout, read from the game files. Skill descriptions and numbers come from the game files too.",
  "The Witcher and all related names, icons and assets are property of CD PROJEKT RED. " + FAN_NOTICE + " Free and non-commercial, made for the community."
];
// Keys the menu takes besides Esc: E picks the focused item (Enter and Space press a focused
// button already), the arrows move between items.
const PICK_KEY = "e";
const MOVE_KEYS = { ArrowUp: -1, ArrowDown: 1 };
const CHANGE_KEYS = { ArrowLeft: -1, ArrowRight: 1 };
// Rows and items the arrows move through, in page order, and what the pointer focuses on hover.
const FOCUSABLE = ".gopt, .gmenu-item, .gmenu-stop[tabindex='0']";
const POINTABLE = ".gopt, .gmenu-item, .gmenu-stop";
const isField = el => !!(el && el.closest && el.closest("input, textarea"));

export function mountMenu(app) {
  const pages = {
    main: { title: "Build planner", items: [
      { label: "Resume", run: close },
      { label: "Build", drawer: createBuildDrawer(app, { renamed }) },
      { label: "Settings", open: "settings" },
      { label: "About", open: "about" }
    ] },
    settings: { title: "Settings", options: [OPTIONS.holdMs, OPTIONS.background, OPTIONS.skillText], items: [
      { label: "Reset all data", run: resetAllData }
    ] },
    about: { title: "About", body: ABOUT, ownNotice: true, items: [
      { label: "Source code", run: () => window.open(REPO_URL, "_blank", "noopener") }
    ] }
  };

  const root = document.createElement("div");
  root.className = "glayer gmenu-layer";
  root.innerHTML = `<div class="glayer-mask"></div><div class="glayer-mask gmenu-options-mask"></div><div class="gmenu-sheet"></div>
    <div class="gmenu" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1"></div>
    <div class="gmenu-legend"></div><div class="gmenu-tip" hidden></div>`;
  const menu = root.querySelector(".gmenu"), legend = root.querySelector(".gmenu-legend");
  const tip = createTipHost({ area: root, el: root.querySelector(".gmenu-tip"), kinds: { hint: part => hintTip(app, part) }, shown: () => !!app.game });

  // The page shown, the item to focus on going back to the page that opened it, and the item that
  // has (or last had) focus: the one E and the legend's Select pick, even after focus moved away.
  // openDrawer: the item whose drawer is open on this page, else null.
  let page = "main", current = null, optionRows = null, openDrawer = null;
  const cameFrom = [];
  const settingsStore = {
    get: key => app.settings[key],
    set: (key, value) => app.setSetting(key, value)
  };

  const layer = {
    name: "menu", modal: true,
    live: () => [root],
    keys(e) {
      if (e.key in MOVE_KEYS) { move(MOVE_KEYS[e.key]); return true; }
      if (e.key in CHANGE_KEYS) return change(CHANGE_KEYS[e.key]);
      if (e.key.toLowerCase() !== PICK_KEY) return false;
      if (!e.repeat) pick(current);
      return true;
    },
    escape
  };

  // A closed drawer is inert, so its parts are skipped.
  const items = () => [...menu.querySelectorAll(FOCUSABLE)].filter(el => !el.closest("[inert]"));
  const drawers = () => menu.list.filter(item => item.drawer).map(item => item.drawer);
  const itemButton = item => menu.querySelector(`.gmenu-item[data-i="${menu.list.indexOf(item)}"]`);

  function itemHtml(item, i) {
    const button = `<li><button type="button" class="gmenu-item${item.back ? " back" : ""}" data-i="${i}"${
      item.unavailable ? ` aria-disabled="true"` : ""}${
      item.drawer ? ` aria-expanded="${item === openDrawer}" aria-controls="gmenu-drawer-${i}"` : ""}>${esc(item.label)}</button></li>`;
    if (!item.drawer) return button;
    const open = item === openDrawer;
    return button + `<li class="gmenu-drawer${open ? " open" : ""}" id="gmenu-drawer-${i}" data-i="${i}"${open ? "" : " inert"}>
      <div class="gmenu-drawer-body">${item.drawer.markup()}</div></li>`;
  }

  function draw(focusIndex = 0) {
    const p = pages[page], sub = page !== "main";
    const list = sub ? [...p.items, { label: "Back", run: back, back: true }] : p.items;
    menu.setAttribute("aria-label", p.title);
    root.classList.toggle("has-options", !!p.options);
    menu.innerHTML = `<img class="gmenu-logo" src="assets/ui/menu/logo.png" alt="The Witcher 3: Wild Hunt Remastered">
      <p class="gmenu-version">${esc(GAME_VERSION)}</p>
      <p class="gmenu-title">${esc(p.title)}</p>
      ${sub ? "" : `<p class="gmenu-sub"></p>`}
      ${p.body ? `<div class="gmenu-body">${p.body.map(t => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      ${p.options ? `<div class="gopts">${optionRowsHtml(p.options)}</div>` : ""}
      <ul class="gmenu-list">${list.map(itemHtml).join("")}</ul>
      ${p.ownNotice ? "" : `<p class="gmenu-note">${esc(FAN_NOTICE)}</p>`}`;
    menu.list = list;
    showName();
    optionRows = p.options ? bindOptionRows(menu.querySelector(".gopts"), p.options, settingsStore) : null;
    menu.querySelectorAll(".gmenu-drawer").forEach(el => list[+el.dataset.i].drawer.mount(el.firstElementChild));
    drawLegend();
    const all = items();
    (all[focusIndex] || all[0]).focus({ preventScroll: true });
    tip.render();
  }

  // The main page shows the build name under its title.
  function showName() {
    const el = menu.querySelector(".gmenu-sub");
    if (!el) return;
    el.textContent = app.state.name || "";
    el.hidden = !app.state.name;
  }

  function drawLegend() {
    legend.innerHTML = app.game ? app.game.panels.legend([
      { key: "E", label: "Select", action: "pick" },
      { key: "Esc", label: page !== "main" || openDrawer ? "Back" : "Close", action: "back" }
    ]) : "";
  }

  // The name field in the Build drawer changed the name: save it and update everything that shows it.
  function renamed() {
    showName();
    app.render("menu");
  }

  function show(name, focusIndex = 0) {
    page = name;
    openDrawer = null;
    draw(focusIndex);
  }

  /** Opens or closes an item's drawer in place (no redraw, so it can slide). One is open at a time. */
  function toggleDrawer(item, open = item !== openDrawer) {
    if (open && openDrawer && openDrawer !== item) toggleDrawer(openDrawer, false);
    const button = itemButton(item), el = menu.querySelector(`#${button.getAttribute("aria-controls")}`);
    if (!open && el.contains(document.activeElement)) button.focus({ preventScroll: true });
    openDrawer = open ? item : null;
    el.classList.toggle("open", open);
    el.inert = !open;
    button.setAttribute("aria-expanded", String(open));
    drawLegend();
  }

  // Left and right: the focused option row, else the drawer row the focus is in.
  function change(dir) {
    if (optionRows && optionRows.step(current, dir)) return true;
    return drawers().some(d => d.step(current, dir));
  }

  function pick(button) {
    if (!button || !menu.contains(button)) return;
    if (optionRows && optionRows.step(button.closest(".gopt"), 1, true)) return;
    if (drawers().some(d => d.pick(button))) return;
    const item = menu.list[+button.dataset.i];
    if (!item || item.unavailable) return;
    if (item.open) { cameFrom.push({ page, index: items().indexOf(button) }); show(item.open); }
    else if (item.drawer) toggleDrawer(item);
    else item.run();
  }

  /** Esc and the right mouse button: out of a text field, then shut the open drawer, then back. */
  function escape() {
    if (openDrawer && isField(document.activeElement) && menu.contains(document.activeElement)) {
      itemButton(openDrawer).focus({ preventScroll: true });
    } else if (openDrawer) toggleDrawer(openDrawer, false);
    else back();
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
    page = "main"; cameFrom.length = 0; openDrawer = null;
    // Back to the centred layout before it shows, so a menu closed on an options page doesn't slide in.
    root.classList.remove("has-options");
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

  // Everything this page keeps in the browser: the build and the settings. Resetting only the build
  // is the legend's "Reset abilities".
  async function resetAllData() {
    if (!app.game) return;
    const yes = await confirmPopup(app, {
      title: "Reset all data",
      text: "Delete everything kept in this browser, the build and the settings, and start over? Copy or export the build first to keep it."
    });
    if (!yes) return;
    clearSavedState(app.catalog, app.state);
    clearSavedSettings(app.settings);
    app.msg = "";
    close();
    app.render();
  }

  menu.addEventListener("click", e => pick(e.target.closest(".gmenu-item")));
  menu.addEventListener("focusin", e => { current = e.target.closest(POINTABLE) || current; });
  // The pointer picks like the arrow keys: the item or row under it gets the frame. Not while
  // typing in a field, which would lose the focus.
  menu.addEventListener("pointerover", e => {
    const button = e.target.closest(POINTABLE);
    if (button && document.activeElement !== button && !isField(document.activeElement)) button.focus({ preventScroll: true });
  });
  legend.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "back") escape();
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
