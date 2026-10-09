// The Character screen's panels, built from the pieces in screen units (layout/screen.json): tree
// panel (a skill tree or the mutagen inventory), points row, mutagen panel, key legend, tooltip and
// message popup. Each takes a plain view model. Interactive parts take the caller's `attrs`
// (data-*, tabindex, aria-*); the caller wires the events.
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
// Dashed frame (planner-only, not game art) on a skill or mutagen that is marked (in highlighted
// skill sets) or found (by the search, ui/search.js). Coloured by how many highlighted sets the
// skill is in: 1 (also for a found one in none), 2, or MARK_LEVELS and more (styles.css, --mark-n);
// a found one pulses. Just outside a tree node, socket or diamond (the diamond's turns with it);
// inside an inventory cell, which touches its neighbours.
const MARK_LEVELS = 3;
const MARK_OUTSIDE = { at: -6, size: SOCKET + 12 };
const MARK_INSIDE = { at: 2, size: INVENTORY.cell - 4 };
const mark = ({ marked = 0, found = false }, { at, size } = MARK_OUTSIDE) => marked || found
  ? `<rect class="${classes("gmark", found && "found")}" data-sets="${Math.min(Math.max(marked, 1), MARK_LEVELS)}" x="${at}" y="${at}" width="${size}" height="${size}"/>` : "";
// Tab shape bounds around its origin (see pieces.tab).
const TAB_HIT = hit(-30, -5, 66, 52);
const LINE_STROKE = { open: LINE_COLORS.open, closed: LINE_COLORS.closed };
// Inventory grid lines: 1px, warm and faint (by eye from docs/reference/mutagens.png).
const GRID_LINE = ` stroke="#45362d" stroke-opacity="0.12" stroke-width="1" fill="none"`;
const classes = (...names) => names.filter(Boolean).join(" ");
// The touch buttons, centred on a skill's left (point out) and right (point in) edge: name, x, and
// the side the edge faces.
const STEP_SIDES = [["remove", 0, -1], ["add", SOCKET, 1]];

/**
 * View models. `cls` adds classes and `attrs` adds attributes to the part's group.
 * @typedef {{ id: string, open: boolean, count?: number, attrs?: string }} TabView  id: a GAME_TABS id.
 * @typedef {{ col: number, row: number, icon: string, state: "locked" | "open" | "learned",
 *   rank?: number, selected?: boolean, marked?: number, found?: boolean, mid?: boolean, cls?: string, attrs?: string,
 *   steps?: { remove?: string, add?: string } }} NodeView
 *   col/row in game grid units; mid: lines end at the node's vertical middle; marked: framed as part
 *   of that many highlighted skill sets (0 = none); found: framed as a search match; steps: the touch buttons on its left (remove, a down arrow) and
 *   right (add, an up arrow) side, each drawn when given, with its attrs.
 * @typedef {{ a: number, b: number, state: "lit" | "open" | "closed" }} LinkView  a, b: node indexes.
 * @typedef {{ icon?: string, color?: string, rank?: number, selected?: boolean, marked?: number, found?: boolean, cls?: string, attrs?: string }} SocketView
 *   No icon = empty socket. marked, found: framed like a tree node.
 * @typedef {{ col: number, row: number, icon: string, selected?: boolean, found?: boolean, cls?: string, attrs?: string }} ItemView
 *   An inventory item; col/row: its cell. found: framed as a search match.
 * @typedef {{ mutagen: string, size?: string, bonus?: string, locked?: boolean, selected?: boolean, found?: boolean, cls?: string, attrs?: string,
 *   sockets: SocketView[] }} GroupView
 *   mutagen: its colour ("" = none), size: its icon size. found: the diamond framed as a search match.
 *   cls and attrs go on the diamond.
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
      + hit(0, 0, cell, cell) + pieces.item({ icon: it.icon, selected: true }) + mark(it, MARK_INSIDE) + `</g>`).join("");
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
   * caller can move the selection without a redraw. The touch buttons come last, over the nodes, and
   * outside them, so pressing one doesn't press the skill.
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
      + SOCKET_HIT + pieces.treeNode({ ...n, color, selected: true }) + mark(n) + `</g>`).join("");
    const steps = nodes.map((n, i) => STEP_SIDES.map(([step, dx, out]) => n.steps && n.steps[step] != null
      ? `<g transform="translate(${fmt(pos[i].x + dx)} ${fmt(pos[i].y + SOCKET / 2)})">${pieces.stepButton(step, color, n.state, out, n.steps[step])}</g>` : "").join("")).join("");
    return lines + cells + steps;
  }

  /**
   * POINTS AVAILABLE under the tree, `n` the points left (overspent: negative). The game right-aligns
   * the label and the number in two fixed fields, so a third digit runs into the label. Here they are
   * one text, right-aligned at the number's field (txfPointsValue), with POINTS_GAP between them, and
   * the diamond after it. The text's width is known only once drawn, so centerPointsRow then centres
   * the row (class "gpoints-row") under the separator.
   */
  function pointsRow(n) {
    const S = art.layout("screen"), L = S.txfAvailablePoints.text, V = S.txfPointsValue;
    const [, , x1] = V.text.box, [, , , , tx, ty] = V.matrix;
    // Flash text fields have a 2px gutter inside their box (gamePieces.text). Each tspan names its
    // baseline too: Safari doesn't pass dominant-baseline down from the <text>, so the row would sit
    // a line higher there, on the separator.
    const hang = `dominant-baseline="text-before-edge"`;
    const text = `<text x="${fmt(tx + x1 - 2)}" y="${fmt(ty)}" ${hang} font-size="${V.text.size}" text-anchor="end">`
      + `<tspan ${hang} fill="${L.color}" font-size="${L.size}">${esc(pointsLabel(n))}</tspan>`
      // Overspent, the number turns red (styles.css, .gpoints-value.over).
      + `<tspan ${hang} dx="${POINTS_GAP}" fill="${V.text.color}" class="gpoints-value${n < 0 ? " over" : ""}">${Math.abs(n)}</tspan></text>`;
    return placed(S.mcPointsBorder, pieces.img("tree/separator.png", 0, 0, 0.5))
      // The row sits lower than in the game, clear of the side panel toggle on the separator.
      + `<g transform="translate(0 ${POINTS_DROP})"><g class="gpoints-row">` + text
      // Unlike the 2x slices around it, this one is drawn at its own size (by eye, from the reference).
      + placed(S.mcPointIcon, pieces.imgAt("points/diamond.png", 0, 0))
      + `</g></g>`;
  }

  /**
   * Centres a drawn pointsRow under the separator: from the label's start to the diamond's right
   * tip. Call again when the text's width may change (a new value, the game font loading).
   * @param {Element} root  an element holding the row
   */
  function centerPointsRow(root) {
    const row = root.querySelector(".gpoints-row");
    const width = row && row.querySelector("text").getComputedTextLength();
    if (!width) return; // not drawn (hidden)
    const S = art.layout("screen"), V = S.txfPointsValue;
    const end = V.matrix[4] + V.text.box[2] - 2;
    const left = end - width, right = S.mcPointIcon.matrix[4] + POINTS_DIAMOND_HALF;
    const center = S.mcPointsBorder.matrix[4] + art.size("tree/separator.png")[0] * 0.5 / 2;
    row.setAttribute("transform", `translate(${fmt(center - (left + right) / 2)} 0)`);
  }
  const POINTS_DROP = 6;
  // Space between the label and the number, in screen units (by eye).
  const POINTS_GAP = 12;
  // Half the diamond's solid width (points/diamond.png: alpha over 128 spans x 27 to 69, centred), without its glow.
  const POINTS_DIAMOND_HALF = 21;
  // Overspent points read as a shortfall: "POINTS NEEDED 2" rather than "POINTS AVAILABLE -2".
  const pointsLabel = n => n < 0 ? "POINTS NEEDED" : "POINTS AVAILABLE";

  /**
   * The slot groups at their screen position: sockets, connectors, diamonds, bonus labels and the
   * centre ornament. Groups in order: left top, right top, left bottom, right bottom. A socket's
   * connectors light when its skill colour matches the group's mutagen. Like tree nodes, sockets
   * and diamonds carry their selection frame for CSS (`.gsock.selected`, `.gdiamond.selected`), and
   * class "full" when they hold something.
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
          SOCKET_HIT + pieces.socket({ ...s, locked: g.locked, selected: true }) + mark(s),
          ` class="${classes("gsock", s.selected && "selected", s.icon && "full", s.cls)}"${s.attrs || ""}`);
      });
      parts += placed(G[`gr${n}_mutagen`], SOCKET_HIT + pieces.diamond({ color: g.mutagen, size: g.size, locked: g.locked, selected: true }) + mark(g),
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

  /**
   * Key legend (HTML), left to right. items: LegendItem[], or LegendItem[][] for groups set apart by
   * a wider gap, each kept together when the legend wraps. Sizes follow --u (1 game px).
   */
  function legend(items) {
    const groups = Array.isArray(items[0]) ? items : [items];
    return `<div class="glegend">${groups.map(g => `<div class="glegend-group">${g.map(legendItem).join("")}</div>`).join("")}</div>`;
  }

  function legendItem(b) {
    const u = n => `calc(${n} * var(--u, 1px))`;
    const mouse = b.mouse && `legend/mouse-${b.mouse}.png`, [w, h] = mouse ? art.size(mouse) : [];
    const cap = [
      mouse && `<span class="gmouse"><img src="${artUrl(mouse)}" alt="" style="width:${u(w)};height:${u(h)}">${
        b.clicks > 1 ? `<span class="gclicks">${b.clicks}x</span>` : ""}</span>`,
      b.key && `<span class="gkey">${esc(b.key)}</span>`
    ].filter(Boolean).join(`<span class="gor">/</span>`);
    const label = `<span class="glabel">${b.prefix ? `<span class="ghold">${esc(b.prefix)}</span> ` : ""}${esc(b.label)}</span>`;
    return b.action ? `<button type="button" class="gbtn" data-action="${esc(b.action)}">${cap}${label}</button>`
      : `<span class="gbtn">${cap}${label}</span>`;
  }

  // Tooltip frame: the gray header holding the given text spans, the body under it, and an
  // optional note line at the bottom, red unless `noteOk` (what an action did, when it worked).
  const tipFrame = (head, body, note, cls = "", noteOk = false) => `<div class="gtip${cls}">
      <div class="gtip-head">
        <img src="${artUrl("tooltip/header.png")}" alt="">
        <div class="gtip-frame" aria-hidden="true"></div>
        ${head}
      </div>
      ${body}
      ${note ? `<p class="gtip-note${noteOk ? " ok" : ""}">${esc(note)}</p>` : ""}
    </div>`;
  const span = (cls, text) => text ? `<span class="${cls}">${esc(text)}</span>` : "";

  /**
   * A tooltip line: plain text, or segments of text with an optional class each (a highlighted number).
   * @typedef {string | (string | { text: string, cls?: string })[]} TipLine
   */
  const tipLine = l => `<span>${typeof l === "string" ? esc(l)
    : l.map(p => typeof p === "string" ? esc(p) : p.cls ? span(p.cls, p.text) : esc(p.text)).join("")}</span>`;

  /**
   * Skill tooltip (HTML, SkillTooltipRef): the gray header with the name, optional type and the
   * level string ("1/3"), then the current and next level blocks. Each block is a list of lines.
   * `all` replaces both with one unlabelled block (the "Modern" text for every rank, ui/tooltip.js).
   * `req` is the red requirement text, `note` a red line under everything. `sets` (not the game's)
   * are the skill's sets, in a column right of the name and level: each kept on one line, the list
   * wrapping between them, and the header growing to fit (styles.css, .gtip-sets).
   * @param {{ name: string, type?: string, level?: string, req?: string, sets?: string[], current?: TipLine[],
   *   next?: TipLine[], all?: TipLine[], note?: string }} o
   */
  function tooltip({ name, type = "", level = "", req = "", sets = [], current, next, all, note = "" }) {
    const block = (cls, label, lines) => lines && lines.length
      ? `<div class="${cls}">${label ? `<span class="gtip-label">${label}</span>` : ""}${lines.map(tipLine).join("")}</div>` : "";
    // The comma stays with the set before it, so a line never starts with one.
    const setList = sets.length ? `<span class="gtip-sets">${sets.map((s, i) =>
      span("gtip-set", i < sets.length - 1 ? `${s},` : s)).join(" ")}</span>` : "";
    return tipFrame(
      span("gtip-name", name.toUpperCase()) + span("gtip-type", type) + span("gtip-level", level) + span("gtip-req", req) + setList,
      all ? block("gtip-cur gtip-all", "", all)
        : block("gtip-cur", "Current level:", current) + block("gtip-next", "Next level:", next), note, " gtip-skill");
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
   * Hint tooltip (HTML, SkillTooltipRef as the game shows it over an empty slot): the header with
   * only the title, then plain text, and an optional note under it (red when `noteBad`).
   * @param {{ title?: string, text: string, terms?: string[], note?: string, noteBad?: boolean }} o
   */
  function hintTooltip({ title = "", text, terms = [], note = "", noteBad = false }) {
    // A line break in the text starts a new line (a switch's hint: one line per choice). A line that
    // starts with one of `terms` (the choices' names) has it in the values' colour.
    const line = l => {
      const term = terms.find(t => l.startsWith(`${t} `));
      return term ? span("gtip-term", term) + esc(l.slice(term.length)) : esc(l);
    };
    const lines = text.split("\n").map(line).join("<br>");
    return tipFrame(span("gtip-name", title.toUpperCase()), `<p class="gtip-text">${lines}</p>`, note, " gtip-hint", !noteBad);
  }

  /**
   * Message popup (HTML, popup_message's SystemMessageModuleRef, the look of the game's "Are you
   * sure you want to quit?"): the title in its header band, optional text, and the buttons on a strip
   * over the bottom edge. Without text the panel shrinks to its title and buttons (.gpopup-short).
   * A tone colours the label like the game's A / B buttons (ModuleInputFeedback.getColorByNavCode).
   * body: markup under the text (ui/popup.js puts its fields there), escaped by the caller.
   * @param {{ title: string, text?: string, body?: string, buttons: PopupButton[] }} o
   */
  function popup({ title, text = "", body = "", buttons }) {
    const button = b => `<button type="button" class="${classes("gpopup-btn", b.tone)}" data-action="${esc(b.action)}">`
      + `<span class="gpopup-key">[${esc(b.key.toUpperCase())}]</span> ${esc(b.label)}</button>`;
    return `<div class="${classes("gpopup", !text && !body && "gpopup-short")}">
      <p class="gpopup-title">${esc(title)}</p>
      ${text ? `<p class="gpopup-text">${esc(text)}</p>` : ""}${body}
      <div class="gpopup-buttons">${buttons.map(button).join("")}</div>
    </div>`;
  }

  return { svg, treePanel, treePanelLift, skillGrid, inventory, pointsRow, centerPointsRow, mutagenPanel, bonusLabel, legend, tooltip, itemTooltip, hintTooltip, popup };
}
