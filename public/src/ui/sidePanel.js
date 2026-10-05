// Side panels: a card that slides over one part of the Character screen
// (Statistics over the tree panel and its tabs, Skill sets over the slots) while the rest stays
// usable. Each is a non-modal layer (ui/layers.js): Esc closes the one opened last, and both can be
// open at once. A key and an arrow button on the covered part's bottom edge toggle it.
//
// The card has the tree panel's frame (tree/frame.png: a double line whose sides fade out), a
// header like the message popup's, and a body that scrolls when it is taller than the card. The
// body is a list of sections: one with no header first, then accordion sections whose header is a
// bar in a tree's colour (like the game's stat categories) with the game's dropdown arrow. Which
// sections are open is a viewer setting (settings.openSections), not part of the build.
//
// Switching follows the game's screen change: the covered part fades out while the card rises the
// last fifth of its height into place and fades in; closing plays it the other way round.
import { esc, patchHtml } from "./dom.js";
import { artUrl, dropdownArrow, dropdownArrowMask, STAT_GLYPHS, STAT_ICON } from "./gameArt.js";

// The dropdown arrow of the game's category lists (IconDropDownListItem.mcOpenedState, the alchemy
// panel's DropDownArrows): game art cut to a one-colour glyph (tools/asset-recipe.json,
// icons/dropdown-arrow.png), pointing down; open sections turn it up (styles.css, .garrow).
const ARROW = `<span class="garrow" aria-hidden="true"></span>`;
// The toggle (28 u): the disc with the legend buttons' double rim (a 1 u dark edge, 1 u of the fill,
// then a 1.5 u dark ring) and the dropdown arrow (gameArt.js, dropdownArrow) in the text colour, in
// one SVG so the browser draws them all at the same sub-pixel position (styles.css, .gtoggle).
// `maskId` keeps the arrow mask's id unique per toggle.
const toggleArt = maskId => `<svg class="gtoggle" viewBox="-14 -14 28 28" aria-hidden="true">`
  + dropdownArrowMask(maskId)
  + `<circle class="gtoggle-disc" r="13.5"/><circle class="gtoggle-ring" r="11.25"/>`
  + `<g class="gtoggle-arrow">${dropdownArrow(maskId)}</g></svg>`;

const SHIELD_FILTER_ID = "gstat-shield";

/** The stat icons' shield filter (alpha times STAT_ICON.shieldBoost), to put once in an always-rendered <svg>. */
export function statIconFilters() {
  return `<filter id="${SHIELD_FILTER_ID}" color-interpolation-filters="sRGB">`
    + `<feComponentTransfer><feFuncA type="linear" slope="${STAT_ICON.shieldBoost}"/></feComponentTransfer></filter>`;
}

/**
 * A stat icon like the character stats popup's (gameArt.js, STAT_ICON): the glyph on a shield, in
 * one SVG whose view box is the shield.
 * @param {string} glyph a STAT_GLYPHS key
 */
export function statIcon(glyph) {
  const [sx, sy, sw, sh] = STAT_ICON.shield, [gx, gy] = STAT_ICON.glyph, [x, y, w, h] = STAT_GLYPHS[glyph];
  return `<svg class="gstat-icon" viewBox="${sx} ${sy} ${sw} ${sh}" aria-hidden="true">`
    + `<image href="${artUrl("stats/shield.png")}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" filter="url(#${SHIELD_FILTER_ID})"/>`
    + `<image href="${artUrl(`stats/icon-${glyph}.png`)}" x="${gx + x}" y="${gy + y}" width="${w}" height="${h}" opacity="${STAT_ICON.alpha}"/></svg>`;
}

/**
 * An accordion section (HTML): its header bar opens and closes the body. Native <details>, so the
 * keyboard and screen readers work without extra code.
 * @param {{ id: string, title: string, color: string, icon?: string, aside?: string,
 *   end?: { text: string, label: string }, open?: boolean, body: string }} o
 *   color: a game colour label ("red", "blue", "green", "yellow") for the header bar; icon: a
 *   STAT_GLYPHS key drawn before the title; aside: text after the title (not capitalised); end: a
 *   value at the bar's right end, before the arrow, with `label` saying what it is (tooltip and
 *   screen readers).
 */
export function section({ id, title, color, icon, aside, end, open = false, body }) {
  return `<details class="gside-sec" data-section="${esc(id)}" data-color="${esc(color)}"${open ? " open" : ""}>
    <summary class="gside-bar">${icon ? statIcon(icon) : ""}<span class="gside-bar-title">${esc(title)}`
    + `${aside ? ` <span class="gside-bar-aside">${esc(aside)}</span>` : ""}</span>`
    + `${end ? `<span class="gside-bar-end" title="${esc(end.label)}"><span aria-hidden="true">${esc(end.text)}</span>`
      + `<span class="visually-hidden">${esc(end.label)}</span></span>` : ""}${ARROW}</summary>
    <div class="gside-sec-body">${body}</div>
  </details>`;
}

/**
 * Value and label rows, like the game's stat lists: values in one column, labels aligned after it.
 * A row with `attrs` is a button (the caller wires it); `pressed` marks a toggled one.
 * @param {{ value: string, label: string, attrs?: string, pressed?: boolean }[]} rows
 */
export function statRows(rows) {
  return `<div class="gstats">${rows.map(r => {
    const cells = `<span class="gstat-value">${esc(r.value)}</span><span class="gstat-label">${esc(r.label)}</span>`;
    return r.attrs
      ? `<button type="button" class="gstat gstat-btn"${r.pressed != null ? ` aria-pressed="${!!r.pressed}"` : ""}${r.attrs}>${cells}</button>`
      : `<div class="gstat">${cells}</div>`;
  }).join("")}</div>`;
}

/** A sub-heading inside a section, white capitals like the game's sign names. */
export const subhead = text => `<p class="gside-sub">${esc(text)}</p>`;

/** A muted line: an empty list or a placeholder for what isn't in yet. */
export const note = text => `<p class="gside-note">${esc(text)}</p>`;

/**
 * Mounts a side panel over `cover` (a grid area of the screen).
 * @param {object} app
 * @param {{ name: string, title: string, area: "tree" | "slots", cover: HTMLElement, key: string,
 *   hint: string, head?: string, mount?: (body: HTMLElement) => void, markup: () => string }} o
 *   name: the layer and settings name; key: the toggle key (also shown on the toggle's tooltip);
 *   hint: the toggle's tooltip text; head: static markup above the sections, drawn once (fields
 *   that keep focus while typing); mount: wires the body's events once; markup: the sections,
 *   redrawn on render when they changed.
 */
export function createSidePanel(app, { name, title, area, cover, key, hint, head = "", mount, markup }) {
  const screen = cover.closest(".screen");
  const id = `side-${name}`;

  const root = document.createElement("section");
  root.className = `gside gside-${area}`;
  root.id = id;
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute("aria-label", title);
  root.innerHTML = `<h2 class="gside-title">${esc(title)}</h2>
    <div class="gside-body"><div class="gside-head">${head}</div><div class="gside-live"></div></div>`;
  const body = root.querySelector(".gside-body"), live = root.querySelector(".gside-live");

  // The toggle sits on its own [data-panel] so the screen's tooltip (data-hint) follows it.
  const toggleWrap = document.createElement("div");
  toggleWrap.className = `gside-toggle-wrap gside-${area}`;
  toggleWrap.dataset.panel = "";
  toggleWrap.innerHTML = `<button type="button" class="gside-toggle" aria-controls="${id}" aria-expanded="false"
    aria-label="${esc(title)}" data-hint-title="${esc(title)}" data-hint="${esc(`${hint}`)}">${toggleArt(`${id}-arrow`)}</button>`;
  const toggleBtn = toggleWrap.querySelector("button");
  screen.append(root, toggleWrap);

  const layer = { name, modal: false, escape: close };
  let drawn = null;

  // Restarts a one-shot CSS animation class on `el`.
  function play(el, cls, other) {
    el.classList.remove(cls, other);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  // The rise classes clip the screen while they are on (styles.css), so they come off once the rise ends.
  for (const el of [root, cover]) {
    el.addEventListener("animationend", e => {
      if (e.target === el && e.animationName === "gside-rise") el.classList.remove("gside-enter", "gside-uncover");
    });
  }
  // Runs `fn` once the element's animation ends, or now if it has none (reduced motion).
  function afterAnimation(el, fn) {
    if (getComputedStyle(el).animationName === "none") { fn(); return; }
    el.addEventListener("animationend", function done(e) {
      if (e.target !== el) return;
      el.removeEventListener("animationend", done);
      fn();
    });
  }

  const isOpen = () => app.layers.isOpen(layer);

  function open() {
    if (isOpen()) return;
    const focusInCover = cover.contains(document.activeElement);
    app.layers.open(layer);
    root.hidden = false;
    play(root, "gside-enter", "gside-leave");
    play(cover, "gside-covered", "gside-uncover");
    // Covered parts take no pointer, focus or keys (ui/dom.js, keyTarget) until it closes.
    cover.inert = true;
    toggleBtn.setAttribute("aria-expanded", "true");
    drawn = null;
    render();
    // Focus inside the covered part would be lost: it moves to the card.
    if (focusInCover) root.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    cover.inert = false;
    app.layers.close(layer);
    toggleBtn.setAttribute("aria-expanded", "false");
    play(root, "gside-leave", "gside-enter");
    play(cover, "gside-uncover", "gside-covered");
    afterAnimation(root, () => { if (!isOpen()) root.hidden = true; });
    app.views.tooltip.render();
  }

  const toggle = () => (isOpen() ? close() : open());

  // Accordion sections remember being open. "toggle" doesn't bubble, so it is caught on the way down.
  body.addEventListener("toggle", e => {
    const d = e.target;
    if (!d.matches || !d.matches("details[data-section]")) return;
    const all = app.settings.openSections, list = new Set(all[name] || []);
    if (d.open) list.add(d.dataset.section); else list.delete(d.dataset.section);
    all[name] = [...list];
    app.saveSettings();
  }, true);
  toggleBtn.addEventListener("click", toggle);
  app.hotkeys.add(e => {
    if (e.repeat || e.key.toLowerCase() !== key) return false;
    toggle();
    return true;
  });
  if (mount) mount(body);

  // Redraws the sections only when they changed, and in place (dom.js, patchHtml), so focus,
  // scroll and a tapped row stay put.
  function render() {
    if (!isOpen()) return;
    const html = markup();
    if (html === drawn) return;
    patchHtml(live, html);
    drawn = html;
  }

  /** True if the section `sectionId` of this panel is open (settings). */
  const sectionOpen = sectionId => (app.settings.openSections[name] || []).includes(sectionId);

  return { render, open, close, toggle, isOpen, sectionOpen, body, cover };
}
