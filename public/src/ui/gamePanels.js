// The Character screen's panels, built from the pieces in screen units (layout/screen.json): tree
// panel (a skill tree or the mutagen inventory), points row, mutagen panel, key legend, tooltip and
// message popup. Each takes a plain view model,
// so the planner and the asset demo draw the same screen from different data. Interactive parts
// take the caller's `attrs` (data-*, tabindex, aria-*); the caller wires the events.
import { esc } from "./dom.js";
import { artUrl, doubleLine, gridPos, lineEnds, BONUS_BAR, BONUS_GLYPH_AT, GAME_TABS, INVENTORY, LINE_COLORS, MUTAGEN_ART, SOCKET } from "./gameArt.js";
import { fmt, placed } from "./gamePieces.js";

/**
 * Screen regions the planner shows, as SVG viewBoxes [x, y, w, h] in screen units. Side by side
 * they span the game's content edges (103.65 to 1816.35); styles.css (.screen) uses the same widths.
 */
export const VIEWS = {
  tree: [103.65, 130, 616.35, 770],
  points: [103.65, 900, 616.35, 70],
  slots: [845, 130, 971.35, 840]
};

// Transparent squares under a piece, so the whole area takes the pointer and can show focus.
const hit = (x, y, w, h) => `<rect class="ghit" x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>`;
const SOCKET_HIT = hit(0, 0, SOCKET, SOCKET);
// Dashed frame just outside a marked skill (planner-only, not game art).
const MARK = `<rect class="gmark" x="-6" y="-6" width="${SOCKET + 12}" height="${SOCKET + 12}"/>`;
// Tab shape bounds around its origin (see pieces.tab).
const TAB_HIT = hit(-30, -5, 66, 52);
const LINE_STROKE = { open: LINE_COLORS.open, closed: LINE_COLORS.closed };
// Inventory grid lines: 1px, warm and faint (by eye from docs/reference/mutagens.png).
const GRID_LINE = ` stroke="#45362d" stroke-opacity="0.12" stroke-width="1" fill="none"`;
const classes = (...names) => names.filter(Boolean).join(" ");

/**
 * View models. `cls` adds classes and `attrs` adds attributes to the part's group.
 * @typedef {{ id: string, open: boolean, count?: number, attrs?: string }} TabView  id: a GAME_TABS id.
 * @typedef {{ col: number, row: number, icon: string, state: "locked" | "open" | "learned",
 *   rank?: number, selected?: boolean, marked?: boolean, mid?: boolean, cls?: string, attrs?: string }} NodeView
 *   col/row in game grid units; mid: lines end at the node's vertical middle; marked: framed as part
 *   of a highlighted archetype.
 * @typedef {{ a: number, b: number, state: "lit" | "open" | "closed" }} LinkView  a, b: node indexes.
 * @typedef {{ icon?: string, color?: string, rank?: number, selected?: boolean, cls?: string, attrs?: string }} SocketView
 *   No icon = empty socket.
 * @typedef {{ col: number, row: number, icon: string, selected?: boolean, cls?: string, attrs?: string }} ItemView
 *   An inventory item; col/row: its cell.
 * @typedef {{ mutagen: string, size?: string, bonus?: string, locked?: boolean, selected?: boolean, cls?: string, attrs?: string,
 *   sockets: SocketView[] }} GroupView
 *   mutagen: its colour ("" = none), size: its icon size. cls and attrs go on the diamond.
 * @typedef {{ key?: string, mouse?: string, clicks?: number, label: string, prefix?: string, action?: string }} LegendItem
 *   mouse: legend/mouse-<mouse>.png, key: key cap text; with both, "mouse / key". clicks: a "2x" badge on the
 *   mouse icon (it only applies to the mouse, so it isn't a prefix). prefix: "[Hold]"-style
 *   text before the label. action: render as a <button data-action>.
 * @typedef {{ key: string, label: string, action: string, tone?: "accept" | "cancel" }} PopupButton
 *   key: shown in brackets ("E" as "[E]"). action: the button's data-action.
 */

/**
 * @param {import("./gameArt.js").Art} art
 * @param {ReturnType<import("./gamePieces.js").createPieces>} pieces
 */
export function createPanels(art, pieces) {
  /** An SVG showing one screen region. */
  const svg = ([x, y, w, h], inner, attrs = "") =>
    `<svg class="gsvg" viewBox="${x} ${y} ${w} ${h}"${attrs}>${inner}</svg>`;

  /**
   * The tree panel at its screen position: background, frame, tabs, title, and the skill grid or
   * the inventory grid.
   * @param {{ bg: string, title: string, tabs: TabView[], grid?: { color: string, nodes: NodeView[], links: LinkView[] },
   *   items?: ItemView[] }} o
   *   bg: a GAME_TABS id for the background art. Each tab lands on its game slot.
   */
  function treePanel({ bg, title, tabs, grid, items }) {
    const S = art.layout("screen"), P = art.layout("tree-panel");
    const tabMarkup = tabs.map(t => placed(P[`mcTabListItem${GAME_TABS.indexOf(t.id) + 1}`],
      TAB_HIT + pieces.tab(t.id, t.open, t.count), ` class="gtab${t.open ? " open" : ""}"${t.attrs || ""}`)).join("");
    return placed(S.mcDupeTabModule,
      placed(P.mcNewTabBackground, pieces.img(`tree/bg-${bg}.png`, 0, 0) + pieces.img("tree/frame.png", 0, 0))
      + tabMarkup
      + pieces.text(P.txtTitle, title.toUpperCase())
      + (grid ? placed(P.mcSkillModule, skillGrid(grid)) : "")
      + (items ? placed(P.mcMutagenSlotList, inventory(items)) : ""));
  }

  /** The inventory grid in mcMutagenSlotList units: every cell's lines, then the items. */
  function inventory(items) {
    const { columns, rows, cell } = INVENTORY, w = columns * cell, h = rows * cell;
    let lines = "";
    for (let c = 0; c <= columns; c++) lines += `M${c * cell} 0V${h}`;
    for (let r = 0; r <= rows; r++) lines += `M0 ${r * cell}H${w}`;
    return `<path d="${lines}"${GRID_LINE}/>` + items.map(it =>
      `<g class="${classes("gitem", it.selected && "selected", it.cls)}" transform="translate(${it.col * cell} ${it.row * cell})"${it.attrs || ""}>`
      + hit(0, 0, cell, cell) + pieces.item({ icon: it.icon, selected: true }) + `</g>`).join("");
  }

  /**
   * One skill or inventory item alone, where the tree panel draws it: the game's apply-mode avatar
   * (CharacterModeBackground.createSlotAvatar), drawn over the mask. Its group has class "glift"
   * for the grow and glow (styles.css). Pass `node` with the tree's `color`, or `item`.
   * @param {{ color?: string, node?: NodeView, item?: ItemView }} o
   */
  function treePanelLift({ color, node, item }) {
    const S = art.layout("screen"), P = art.layout("tree-panel");
    const lift = (at, inner) => `<g transform="translate(${fmt(at.x)} ${fmt(at.y)})"><g class="glift">${inner}</g></g>`;
    const cell = INVENTORY.cell;
    const inner = node
      ? placed(P.mcSkillModule, lift(gridPos(node.col, node.row), pieces.treeNode({ ...node, color, selected: false })))
      : placed(P.mcMutagenSlotList, lift({ x: item.col * cell, y: item.row * cell }, pieces.item({ icon: item.icon })));
    return placed(S.mcDupeTabModule, inner);
  }

  /**
   * Skills and their lines in mcSkillModule units (CharacterSkillsGridModule). Lit lines take the
   * tree colour. Every node carries its selection frame; CSS shows it on `.gnode.selected`, so a
   * caller can move the selection without a redraw.
   */
  function skillGrid({ color, nodes, links }) {
    const pos = nodes.map(n => gridPos(n.col, n.row));
    const lines = links.map(({ a, b, state }) => {
      const [p, q] = lineEnds(pos[a], pos[b], nodes[a].mid, nodes[b].mid);
      const stroke = state === "lit" ? LINE_COLORS[color] : LINE_STROKE[state];
      return doubleLine(p, q).map(([s, e]) =>
        `<line class="gline ${state}" x1="${fmt(s.x)}" y1="${fmt(s.y)}" x2="${fmt(e.x)}" y2="${fmt(e.y)}" stroke="${stroke}"/>`).join("");
    }).join("");
    const cells = nodes.map((n, i) =>
      `<g class="${classes("gnode", n.selected && "selected", n.cls)}" transform="translate(${fmt(pos[i].x)} ${fmt(pos[i].y)})"${n.attrs || ""}>`
      + SOCKET_HIT + pieces.treeNode({ ...n, color, selected: true }) + (n.marked ? MARK : "") + `</g>`).join("");
    return lines + cells;
  }

  /**
   * POINTS AVAILABLE under the tree. `value` is markup at txfPointsValue: pointsValue(n) or a
   * caller's field. `n` picks the label (pointsLabel); `labelAttrs` lets a caller find it to update.
   */
  function pointsRow(value, { n = 0, labelAttrs = "" } = {}) {
    const S = art.layout("screen");
    return placed(S.mcPointsBorder, pieces.img("tree/separator.png", 0, 0, 0.5))
      + pieces.text(S.txfAvailablePoints, pointsLabel(n), labelAttrs)
      + value
      // Unlike the 2x slices around it, this one is drawn at its own size (by eye, from the reference).
      + placed(S.mcPointIcon, pieces.imgAt("points/diamond.png", 0, 0));
  }
  // Overspent points read as a shortfall: "POINTS NEEDED 2" rather than "POINTS AVAILABLE -2".
  const pointsLabel = n => n < 0 ? "POINTS NEEDED" : "POINTS AVAILABLE";
  const pointsValue = n => pieces.text(art.layout("screen").txfPointsValue, String(Math.abs(n)));

  /**
   * The slot groups at their screen position: sockets, connectors, diamonds, bonus labels and the
   * centre ornament. Groups in order: left top, right top, left bottom, right bottom. A socket's
   * connectors light when its skill colour matches the group's mutagen. Like tree
   * nodes, sockets and diamonds carry their selection frame for CSS (`.gsock.selected`, `.gdiamond.selected`),
   * and "full" when they hold something.
   * @param {{ groups: GroupView[], bonusSockets?: boolean }} o  bonusSockets: the four locked
   *   Mutations sockets, which the game shows only with Blood and Wine mutations.
   */
  function mutagenPanel({ groups, bonusSockets = false }) {
    const S = art.layout("screen"), M = art.layout("mutagen-panel"), G = art.layout("mutagen-slots");
    let wires = "", parts = "", labels = "";
    groups.forEach((g, gi) => {
      const n = gi + 1;
      const match = g.sockets.map(s => !g.locked && !!s.icon && s.color === g.mutagen);
      wires += placed(G[`groupConnector${n}`], pieces.connector("line", match.some(Boolean) && g.mutagen));
      g.sockets.forEach((s, si) => {
        wires += placed(G[`connector_g${n}_s${si + 1}`], pieces.connector(si === 1 ? "line" : "corner", match[si] && g.mutagen));
        parts += placed(G[`gr${n}_socket${si + 1}`],
          SOCKET_HIT + pieces.socket({ ...s, locked: g.locked, selected: true }),
          ` class="${classes("gsock", s.selected && "selected", s.icon && "full", s.cls)}"${s.attrs || ""}`);
      });
      parts += placed(G[`gr${n}_mutagen`], SOCKET_HIT + pieces.diamond({ color: g.mutagen, size: g.size, locked: g.locked, selected: true }),
        ` class="${classes("gdiamond", g.selected && "selected", g.mutagen && "full", g.cls)}"${g.attrs || ""}`);
      if (g.mutagen && g.bonus != null) labels += bonusLabel(n, g.mutagen, g.bonus);
    });
    if (bonusSockets) for (let i = 1; i <= 4; i++) parts += placed(G[`bonusSocket${i}`], pieces.socket({ locked: true }));
    return placed(S.moduleSkillSlot, labels + placed(M.mcSlotsNormal, ornament(G) + wires + parts));
  }

  /**
   * A group's bonus label in mutagen-panel units (mc_bonus_bkg_new): the bar at alpha 0.8 with the
   * stat glyph on a shield, the stat name and `value`, both centred on the bar. Right-side groups
   * are mirrored.
   */
  function bonusLabel(n, color, value) {
    const M = art.layout("mutagen-panel"), at = M[`groupBonusBkg${n}_1`];
    const { glyph, stat } = MUTAGEN_ART[color];
    const [bx, by, bw, bh] = BONUS_BAR, [gx, gy] = BONUS_GLYPH_AT[glyph];
    const bkg = pieces.box(`bonus/bar-${color}.png`, bx, by, bw, bh, ` opacity="0.8"`)
      + pieces.img("bonus/shield.png", 5, 8) + pieces.img(`bonus/glyph-${glyph}.png`, gx, gy);
    const [, , , d, , ty] = at.matrix;
    const middle = ty + d * (by + bh / 2);
    return placed(at, bkg)
      + pieces.text(M[`txtBonus${n}_1`], stat, "", { middle })
      + pieces.text(M[`txtBonus${n}_1p`], value, "", { middle });
  }

  // Centre ornament between the groups and the four divider lines (placed as in the game).
  function ornament(G) {
    const top = G.gr1_socket3.matrix, right = G.gr2_socket3.matrix, bottom = G.gr3_socket1.matrix;
    const cx = (top[4] + SOCKET + right[4]) / 2, cy = (top[5] + SOCKET + bottom[5]) / 2;
    const lines = ["dividerTop", "dividerBottom", "dividerLeft", "dividerRight"]
      .map(name => placed(G[name], pieces.divider())).join("");
    return lines + pieces.imgAt("slots/divider-ornament.png", cx, cy, 0.5);
  }

  /** Key legend (HTML), left to right. Sizes follow the CSS custom property --u (1 game px). */
  function legend(items) {
    const u = n => `calc(${n} * var(--u, 1px))`;
    return `<div class="glegend">${items.map(b => {
      const mouse = b.mouse && `legend/mouse-${b.mouse}.png`, [w, h] = mouse ? art.size(mouse) : [];
      const cap = [
        mouse && `<span class="gmouse"><img src="${artUrl(mouse)}" alt="" style="width:${u(w)};height:${u(h)}">${
          b.clicks > 1 ? `<span class="gclicks">${b.clicks}x</span>` : ""}</span>`,
        b.key && `<span class="gkey">${esc(b.key)}</span>`
      ].filter(Boolean).join(`<span class="gor">/</span>`);
      const label = `<span class="glabel">${b.prefix ? `<span class="ghold">${esc(b.prefix)}</span> ` : ""}${esc(b.label)}</span>`;
      return b.action ? `<button type="button" class="gbtn" data-action="${esc(b.action)}">${cap}${label}</button>`
        : `<span class="gbtn">${cap}${label}</span>`;
    }).join("")}</div>`;
  }

  // Tooltip frame: the gray header holding the given text spans, the body under it, and an
  // optional red note line at the bottom.
  const tipFrame = (head, body, note, cls = "") => `<div class="gtip${cls}">
      <div class="gtip-head">
        <img src="${artUrl("tooltip/header.png")}" alt="">
        <img src="${artUrl("tooltip/header-frame.png")}" alt="">
        ${head}
      </div>
      ${body}
      ${note ? `<p class="gtip-note">${esc(note)}</p>` : ""}
    </div>`;
  const span = (cls, text) => text ? `<span class="${cls}">${esc(text)}</span>` : "";

  /**
   * Skill tooltip (HTML, SkillTooltipRef): the gray header with the name, optional type and the
   * level string ("1/3"), then the current and next level blocks. Each block is a list of lines.
   * `req` is the red requirement text, `note` a red line under everything.
   * @param {{ name: string, type?: string, level?: string, req?: string, current?: string[],
   *   next?: string[], note?: string }} o
   */
  function tooltip({ name, type = "", level = "", req = "", current, next, note = "" }) {
    const block = (cls, label, lines) => lines && lines.length
      ? `<div class="${cls}"><span class="gtip-label">${label}</span>${lines.map(l => `<span>${esc(l)}</span>`).join("")}</div>` : "";
    return tipFrame(
      span("gtip-name", name.toUpperCase()) + span("gtip-type", type) + span("gtip-level", level) + span("gtip-req", req),
      block("gtip-cur", "Current level:", current) + block("gtip-next", "Next level:", next), note);
  }

  /**
   * Item tooltip (HTML, TooltipInventory): the header with the name and the upper-case item type
   * under it, the stat list (value, then label), the description lines straight under it in the
   * stat label's style, and the rarity line. The game's weight and price row is left out.
   * @param {{ name: string, type?: string, stats?: { value: string, label: string }[], body?: string[],
   *   rarity?: string, note?: string }} o
   */
  function itemTooltip({ name, type = "", stats = [], body = [], rarity = "", note = "" }) {
    const statList = stats.length
      ? `<div class="gtip-stats">${stats.map(s => `<span>${span("gtip-value", s.value)} ${span("gtip-stat", s.label)}</span>`).join("")}</div>` : "";
    return tipFrame(
      span("gtip-name", name.toUpperCase()) + span("gtip-itemtype", type.toUpperCase()),
      statList + (body.length ? `<div class="gtip-desc">${body.map(l => `<span>${esc(l)}</span>`).join("")}</div>` : "") + (rarity ? `<p class="gtip-rarity">${esc(rarity)}</p>` : ""),
      note, " gtip-item");
  }

  /**
   * Message popup (HTML, popup_message's SystemMessageModuleRef, the look of the game's "Are you
   * sure you want to quit?"): the title in its header band, optional text, and the buttons on a strip
   * over the bottom edge. Without text the panel shrinks to its title and buttons (.gpopup-short).
   * A tone colours the label like the game's A / B buttons (ModuleInputFeedback.getColorByNavCode).
   * @param {{ title: string, text?: string, buttons: PopupButton[] }} o
   */
  function popup({ title, text = "", buttons }) {
    const button = b => `<button type="button" class="${classes("gpopup-btn", b.tone)}" data-action="${esc(b.action)}">`
      + `<span class="gpopup-key">[${esc(b.key.toUpperCase())}]</span> ${esc(b.label)}</button>`;
    return `<div class="${classes("gpopup", !text && "gpopup-short")}">
      <p class="gpopup-title">${esc(title)}</p>
      ${text ? `<p class="gpopup-text">${esc(text)}</p>` : ""}
      <div class="gpopup-buttons">${buttons.map(button).join("")}</div>
    </div>`;
  }

  return { svg, treePanel, treePanelLift, skillGrid, inventory, pointsRow, pointsLabel, pointsValue, mutagenPanel, bonusLabel, legend, tooltip, itemTooltip, popup };
}
