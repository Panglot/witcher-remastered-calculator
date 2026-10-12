// The Character screen's panels, built from the pieces in screen units (layout/screen.json): tree
// panel (a skill tree or the mutagen inventory), points row, mutagen panel, key legend, tooltip and
// message popup. Each takes a plain view model. Interactive parts take the caller's `attrs`
// (data-*, tabindex, aria-*); the caller wires the events.
import { esc } from "./dom.js";
import { artUrl, doubleLine, gridPos, lineEnds, BONUS_BAR, BONUS_GLYPH_AT, BONUS_MUTATION_SHIFT, GAME_TABS, INVENTORY, LINE_COLORS, MUTAGEN_ART, SCREEN, SOCKET } from "./gameArt.js";
import { gameLayout, stackedLayout, MASTER_NODE } from "./mutationLayouts.js";
import { fmt, placed, DIAMOND_FRAME } from "./gamePieces.js";

// a after b, both SVG matrices [a, b, c, d, tx, ty].
const compose = ([a, b, c, d, e, f], [a2, b2, c2, d2, e2, f2]) =>
  [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];
// A placement as a CSS transform, so a change of it can animate (styles.css, .gmove).
const cssMatrix = m => `matrix(${m.map(fmt).join(",")})`;
// Point [x, y] through matrix m.
const at2 = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];

/**
 * Screen regions the planner shows, as SVG viewBoxes [x, y, w, h] in screen units. Side by side
 * they span x 103.65 to 1782: 8 px past the content on each side (the tree's edge at about 111.7, the
 * right bonus labels' end at 1774), so the panels sit centred. styles.css (.screen) uses the same widths.
 */
export const VIEWS = {
  tree: [103.65, 130, 616.35, 770],
  points: [103.65, 900, 616.35, 70],
  slots: [845, 130, 937, 840]
};

// Transparent squares under a piece, so the whole area takes the pointer and can show focus.
const hit = (x, y, w, h) => `<rect class="ghit" x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>`;
const SOCKET_HIT = hit(0, 0, SOCKET, SOCKET);
// A skill's black mask, shown faintly while removing the hovered or selected skill would cascade to it (ui/cascade.js).
const CASCADE_MASK = `<rect class="gcascade-mask" width="${SOCKET}" height="${SOCKET}"/>`;
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
 * @typedef {{ id: string, open: boolean, found?: boolean, count?: number, attrs?: string }} TabView  id: a GAME_TABS id.
 *   found: it lists a search match, so its icon pulses.
 * @typedef {{ col: number, row: number, icon: string, state: "locked" | "open" | "learned",
 *   rank?: number, selected?: boolean, marked?: number, found?: boolean, fading?: boolean, mid?: boolean, cls?: string, attrs?: string,
 *   steps?: { remove?: string, add?: string } }} NodeView
 *   col/row in game grid units; mid: lines end at the node's vertical middle; marked: framed as part
 *   of that many highlighted skill sets (0 = none); found: framed as a search match; fading: a cascade
 *   just took it, so its learned fill fades out (ui/cascade.js); steps: the touch buttons on its left (remove, a down arrow) and
 *   right (add, an up arrow) side, each drawn when given, with its attrs.
 * @typedef {{ a: number, b: number, state: "lit" | "open" | "closed" }} LinkView  a, b: node indexes.
 * @typedef {{ icon?: string, color?: string, rank?: number, locked?: boolean, selected?: boolean, marked?: number, found?: boolean, cls?: string, attrs?: string }} SocketView
 *   No icon = empty socket. marked, found: framed like a tree node. locked: the slot is locked
 *   (core/slotLocks.js); a full one still shows its skill, with the lock warning over it.
 * @typedef {{ col: number, row: number, icon: string, selected?: boolean, found?: boolean, cls?: string, attrs?: string }} ItemView
 *   An inventory item; col/row: its cell. found: framed as a search match.
 * @typedef {{ mutagen: string, size?: string, bonus?: string, locked?: boolean, selected?: boolean, found?: boolean, cls?: string, attrs?: string,
 *   sockets: SocketView[] }} GroupView
 * @typedef {{ on: boolean, sockets: (SocketView & { allowed?: string, flip?: boolean })[], orb: OrbView }} MutationSlotsView
 *   The mutation mode of the slot panel: on, its sockets (the game's bonusSocket1-4) and the orb.
 * @typedef {{ color: string, name?: string, description?: string, key?: string, attrs?: string, cls?: string }} OrbView
 *   The orb in the panel's centre (EquippedMutationItemRef): its colour frame ("default" with no
 *   active mutation), the active mutation's name and description beside it (none: hidden), the key
 *   cap drawn on it (none: hidden), and the caller's attrs and classes on its group.
 *   mutagen: its colour ("" = none), size: its icon size. found: the diamond framed as a search match.
 *   locked: the diamond is locked, like a socket's. cls and attrs go on the diamond.
 * @typedef {{ key?: string, mouse?: string, clicks?: number, label: string, prefix?: string, action?: string }} LegendItem
 *   mouse: legend/mouse-<mouse>.png, key: key cap text; with both, "mouse / key". clicks: a "2x" badge on the
 *   mouse icon (it only applies to the mouse, so it isn't a prefix). prefix: "[Hold]"-style
 *   text before the label. action: render as a <button data-action>.
 * @typedef {{ node: number, icon: string, color: string, enabled: boolean, researched: boolean, equipped: boolean,
 *   selected?: boolean, fading?: boolean, cls?: string, attrs?: string }} MutationNodeView
 *   A mutation in the Mutations panel at its node (mcMutation<node>), as gamePieces.mutationNode draws it.
 *   fading: a cascade just took it, so its researched disc fades out (ui/cascade.js).
 * @typedef {{ color: string, stage: string, selected?: boolean, attrs?: string }} MasterNodeView
 *   Strengthened Synapses: the orb's colour frame and its stage numeral ("" at stage 0: the lock instead).
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
      TAB_HIT + pieces.tab(t.id, t.open, t.count), ` class="${classes("gtab", t.open && "open", t.found && "found")}"${t.attrs || ""}`)).join("");
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
      + SOCKET_HIT + pieces.treeNode({ ...n, color, selected: true }) + mark(n) + CASCADE_MASK + `</g>`).join("");
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
   * With `mutation`, the panel can switch to the game's mutation layout (mcSlotsMutation): the groups
   * move apart, the dividers and ornament go, and the mutation sockets and the orb (mutationOrb) take
   * the centre. Both layouts draw the same parts in the same order, each placed by a CSS transform, so
   * a redraw in place (dom.js, patchHtml) slides every part to its new place (styles.css, .gmove,
   * .gslots-mut). The game switches at once (ModuleSkillsSocketsDupe.mutationMode): the movement is ours.
   * @param {{ groups: GroupView[], mutation?: MutationSlotsView }} o
   */
  function mutagenPanel({ groups, mutation = null }) {
    const S = art.layout("screen"), M = art.layout("mutagen-panel");
    const N = art.layout("mutagen-slots"), X = art.layout("mutagen-slots-mutation");
    const on = !!mutation && mutation.on;
    // A part's placement in the module: its layout's container times its own, in the current layout.
    const at = name => on ? compose(M.mcSlotsMutation.matrix, X[name].matrix) : compose(M.mcSlotsNormal.matrix, N[name].matrix);
    // `cls` joins "gmove" in one class attribute (a second one would be dropped by the parser).
    // `nx`: the stacked layout's sideways shift (styles.css, .gmove), in the module's units.
    // `n`: the part's group, whose half (gside) the stacked layout moves away from the orb's description.
    const moved = (name, inner, cls = "", attrs = "", nx = 0, n = 0) => `<g class="${classes("gmove", cls)}" `
      + `style="transform:${cssMatrix(at(name))}${nx ? `;--nx:${fmt(nx)}px` : ""}${gside(n)}"${attrs}>${inner}</g>`;
    let wires = "", parts = "", labels = "";
    // Where the stacked layout puts the bonus labels (bonusLabel): beside the divider, above the top groups'
    // first sockets and below the bottom groups' last ones, in the current layout.
    const divider = at2(M.mcSlotsNormal.matrix, ornamentCentre(N))[0];
    const stackAt = n => ({ x: divider, y: n > 2 ? at(`gr${n}_socket3`)[5] + SOCKET : at(`gr${n}_socket1`)[5] });
    // The stacked layout crops the slots to the tree's width around the divider (styles.css), which cuts off
    // the mutation layout's diamonds. There a group draws in until its diamond's frame is STACK_EDGE inside
    // the crop: the diamond the whole way, the rest of the group half of it, so the gaps shrink evenly.
    // Planner-only. Nothing moves when the diamonds fit (the normal layout).
    const [fw, fh] = art.size(DIAMOND_FRAME), [fx, fy] = art.origin(DIAMOND_FRAME);
    const nudge = n => {
      const xs = [[-fx, -fy], [fw - fx, -fy], [-fx, fh - fy], [fw - fx, fh - fy]].map(p => at2(at(`gr${n}_mutagen`), p)[0]);
      const reach = VIEWS.tree[2] / 2 - STACK_EDGE;
      return n % 2 ? Math.max(0, divider - reach - Math.min(...xs)) : Math.min(0, divider + reach - Math.max(...xs));
    };
    groups.forEach((g, gi) => {
      const n = gi + 1, nx = nudge(n);
      const match = g.sockets.map(s => !!s.icon && s.color === g.mutagen);
      wires += moved(`groupConnector${n}`, pieces.connector("line", match.some(Boolean) && g.mutagen), "", "", nx / 2, n);
      g.sockets.forEach((s, si) => {
        wires += moved(`connector_g${n}_s${si + 1}`, pieces.connector(si === 1 ? "line" : "corner", match[si] && g.mutagen), "", "", nx / 2, n);
        parts += moved(`gr${n}_socket${si + 1}`,
          SOCKET_HIT + pieces.socket({ ...s, selected: true }) + mark(s),
          classes("gsock", s.selected && "selected", s.icon && "full", s.cls), s.attrs || "", nx / 2, n);
      });
      parts += moved(`gr${n}_mutagen`, SOCKET_HIT + pieces.diamond({ color: g.mutagen, size: g.size, locked: g.locked, selected: true }) + mark(g),
        classes("gdiamond", g.selected && "selected", g.mutagen && "full", g.cls), g.attrs || "", nx, n);
      if (g.mutagen && g.bonus != null) labels += bonusLabel(n, g.mutagen, g.bonus, on, stackAt(n));
    });
    // The mutation sockets stay where the mutation layout puts them; they fade in and out with it.
    const msocks = mutation ? `<g class="gmsocks">${mutation.sockets.map((s, i) =>
      placed({ matrix: compose(M.mcSlotsMutation.matrix, X[`bonusSocket${i + 1}`].matrix) },
        SOCKET_HIT + pieces.socket({ ...s, selected: true }) + mark(s),
        ` class="${classes("gmove gsock", s.selected && "selected", s.icon && "full", s.cls)}" style="${gside(i < mutation.sockets.length / 2 ? 1 : 3).slice(1)}"${s.attrs || ""}`)).join("")}</g>` : "";
    return placed(S.moduleSkillSlot, labels + placed(M.mcSlotsNormal, `<g class="gdividers">${ornament(N)}</g>`) + wires + parts + msocks,
      ` class="${classes("gslots", on && "gslots-mut")}"`)
      + (mutation ? mutationOrb(mutation.orb, on ? null : at2(compose(S.moduleSkillSlot.matrix, M.mcSlotsNormal.matrix), ornamentCentre(N)), {
        // The stacked layout's crop (its inner edges) and the bottom groups' top, in screen units.
        x0: at2(S.moduleSkillSlot.matrix, [divider, 0])[0] - VIEWS.tree[2] / 2 + STACK_EDGE,
        x1: at2(S.moduleSkillSlot.matrix, [divider, 0])[0] + VIEWS.tree[2] / 2 - STACK_EDGE,
        bottom: at2(S.moduleSkillSlot.matrix, [0, Math.min(at("gr3_socket1")[5], at("gr4_socket1")[5])])[1]
      }) : "");
  }
  // A part's half for the stacked layout's gap round the orb's description (styles.css, .gmove): -1 above, 1 below.
  const gside = n => n ? `;--gside:${n > 2 ? 1 : -1}` : "";

  /**
   * The orb in the slot panel's centre in mutation mode (EquippedMutationItemRef at root.mcMasterMutation,
   * screen units): the orb, a ring for the hold (styles.css, .gorb-ring), the key cap on it, and the
   * active mutation's name (tfState, right-aligned towards the orb) and description (tfMutationDescription)
   * beside it, both centred on the orb's middle. The texts wrap like the game's text fields,
   * so they are HTML in a foreignObject.
   * The stacked layout crops the description off, so there it shows under the orb across the crop
   * (`stack`, screen units: the crop's inner edges x0 and x1 and the bottom groups' top), and the rows
   * move apart evenly to make room for it (orbTextGap). The name keeps inside the crop.
   * @param {OrbView} o
   * @param {{ x0: number, x1: number, bottom: number }} [stack]
   */
  function mutationOrb({ color, name = "", description = "", key = "", attrs = "", cls = "" }, rest = null, stack = null) {
    const S = art.layout("screen"), E = art.layout("equipped-mutation");
    const [cx, cy] = orbCentre(), [, , , , ax, ay] = E.mcMutationAnimation.matrix;
    // Without mutations the orb rests with its art centred on `rest` (the normal layout's ornament);
    // with them it is where the game puts it. Like the slots, the move animates (styles.css, .gmove).
    const at = rest ? [1, 0, 0, 1, rest[0] - ax - cx, rest[1] - ay - cy] : S.mcMasterMutation.matrix;
    const field = (child, html, cls, style = "") => {
      const [, , , , x, y] = child.matrix, [x0, , x1] = child.text.box;
      return `<foreignObject x="${fmt(x + x0)}" y="${fmt(y - ORB_TEXT_ROOM / 2)}" width="${fmt(x1 - x0)}" height="${ORB_TEXT_ROOM}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" class="${cls}" style="font-size:${child.text.size}px${style}"><span class="gorb-box">${html}</span></div></foreignObject>`;
    };
    const nameAt = { ...E.tfState, matrix: [1, 0, 0, 1, E.tfState.matrix[4], 0] };
    // The crop's inner edges from the orb's origin.
    const [sx0, sx1] = stack ? [stack.x0 - at[4], stack.x1 - at[4]] : [0, 0];
    // The stacked layout's copy of the description, ORB_DESC_GAP under the hold ring, across the crop. Laid out
    // (hidden) in every layout, so its height is known for the gap: the rows move apart by how far it would
    // reach past the bottom groups' top (data-gap plus its height).
    const wide = () => {
      const top = ORB_RING_R + ORB_DESC_GAP, gap = top + ORB_DESC_GAP - (stack.bottom - at[5] - ay - cy);
      return `<foreignObject class="gorb-wide" data-gap="${fmt(gap)}" x="${fmt(sx0)}" y="${fmt(top)}" width="${fmt(sx1 - sx0)}" height="${ORB_WIDE_ROOM}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" class="gorb-desc-wide" style="font-size:${E.tfMutationDescription.text.size}px"><span class="gorb-box">${esc(description)}</span></div></foreignObject>`;
    };
    // Both texts at the game's x, centred on the orb's middle (the planner's choice: the game's fields sit higher).
    const texts = name ? `<g class="gorb-texts" data-patch-key="orb-texts" transform="translate(0 ${fmt(ay + cy)})">`
      + field(nameAt, esc(name), "gorb-name", stack ? `;--stack-room:${fmt(nameAt.matrix[4] + nameAt.text.box[2] - sx0)}px` : "")
      + field({ ...E.tfMutationDescription, matrix: [1, 0, 0, 1, E.tfMutationDescription.matrix[4], 0] }, esc(description), "gorb-desc")
      + (stack && description ? wide() : "") + `</g>` : "";
    // The key cap on the orb's centre, as the legend draws it (styles.css, .gkey), one game px a unit.
    const cap = key ? `<foreignObject class="gorb-key" data-patch-key="orb-key" x="${fmt(cx - ORB_KEY_BOX / 2)}" y="${fmt(cy - ORB_KEY_BOX / 2)}" width="${ORB_KEY_BOX}" height="${ORB_KEY_BOX}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" class="gorb-keycap"><span class="gkey">${esc(key)}</span></div></foreignObject>` : "";
    // The ghost (no mutations yet) sits between the normal layout's groups: a smaller circle keeps it off their sockets.
    const reach = cls.split(" ").includes("ghost") ? ORB_GHOST_R : ORB_R;
    const circle = (c, r, more = "") => `<circle class="${c}" r="${r}"${more}/>`;
    return `<g class="${classes("gmove gorb", cls)}" style="transform:${cssMatrix(at)}${gside(1)}"${attrs}>`
      + texts + placed(E.mcMutationAnimation, `<g transform="translate(${fmt(cx)} ${fmt(cy)})">${circle("gorb-hit", reach)}</g>`
        + `<g class="gorb-art">${pieces.orb(color)}</g>`
        + `<g transform="translate(${fmt(cx)} ${fmt(cy)})">${circle("gorb-ghost", ORB_GHOST_R)}${circle("gorb-ring", reach === ORB_R ? ORB_RING_R : reach, ` pathLength="1"`)}</g>` + cap)
      + `</g>`;
  }
  // The centre of the orb's art from its origin: the animation's offset (-62.5, -65.5), the
  // background's placement and the middle of the colour frame's art (all frames share its box).
  function orbCentre() {
    const [, , , , bx, by] = art.layout("mutation-orb").background.matrix;
    const [, , , , fx, fy] = art.fill("mutations/orb-default.png"), [w, h] = art.size("mutations/orb-default.png");
    return [-62.5 + bx + fx + w / 2, -65.5 + by + fy + h / 2];
  }
  // The orb's reach (the art is about 125 px across), by eye; the ghost's stays clear of the normal
  // layout's nearest sockets (their corners are about 61 px from the orb's centre).
  const ORB_R = 66, ORB_GHOST_R = 48;
  // The hold ring goes round the orb, just outside its black rim (r 80 to 87 in the colour frame's art).
  const ORB_RING_R = 91;
  // Room the texts may take, centred on their line (they hold a few lines at most).
  const ORB_TEXT_ROOM = 200;
  // The stacked layout's description: room between it and the hold ring or the bottom groups (by eye), and the most it may take.
  const ORB_DESC_GAP = 12, ORB_WIDE_ROOM = 400;

  /**
   * Measures the stacked layout's description under the orb (mutationOrb) and sets on `root` how far the
   * slot rows move apart for it (--orb-gap, screen units; styles.css splits it above and below the orb),
   * 0 without one. Its height is known only once drawn, like the points row's width.
   * @param {HTMLElement} root  the slot panel
   */
  function orbTextGap(root) {
    const wide = root.querySelector(".gorb-wide"), box = wide && wide.querySelector(".gorb-box");
    const gap = box ? Math.max(0, +wide.dataset.gap + box.offsetHeight) : 0;
    root.style.setProperty("--orb-gap", fmt(gap));
  }
  // Room for the key cap, centred on the orb (in-game the button sits on its middle).
  const ORB_KEY_BOX = 60;

  /**
   * The Mutations panel (MutationPanelRef) in screen units, in `layout` (ui/mutationLayouts.js): the
   * connectors (colours from `connectorColor(name)`, by layout name), the mutations and Strengthened
   * Synapses, and a header at the top of the layout's view (planner-only: the title and the points left,
   * which research spends). Nodes carry their selection frame for CSS (.gmnode.selected). The background
   * is not drawn here: the panel puts it behind the whole area (styles.css, .gbackdrop).
   * @param {{ layout: import("./mutationLayouts.js").MutationLayout, nodes: MutationNodeView[], master: MasterNodeView,
   *   connectorColor: (name: string) => string, title: string, points: number }} o
   */
  function mutationPanel({ layout, nodes, master, connectorColor, title, points }) {
    const MM = art.layout("mutation-master");
    const lines = layout.links.map(k => placed(layout.linkAt(k), pieces.mutationConnector(connectorColor(k)))).join("");
    const cells = nodes.map(n => placed(layout.nodeAt(n.node), `<circle class="ghit" r="${MUTATION_HIT}" fill="transparent"/>` + pieces.mutationNode(n),
      ` class="${classes("gmnode", n.selected && "selected", n.cls)}"${n.attrs || ""}`)).join("");
    // The numeral and the lock sit in the middle of the icon backing: the game's field and lock sprite
    // offsets assume its own font and lock art, which land off centre here.
    const [, , , , bx, by] = MM.mcStateBackground.matrix;
    const tf = MM.tfAdditionalState, [x0, , x1] = tf.text.box;
    const numeral = { ...tf, matrix: [...tf.matrix.slice(0, 4), bx - (x0 + x1) / 2, tf.matrix[5]] };
    const stage = master.stage
      ? pieces.text(numeral, master.stage, "", { middle: by })
      : pieces.imgAt("slots/lock.svg", bx, by);
    const centre = placed(layout.nodeAt(MASTER_NODE), `<circle class="ghit" r="${MUTATION_HIT}" fill="transparent"/>`
      + placed(MM.mcMutationAnimation, pieces.orb(master.color))
      + placed(MM.mcStateBackground, pieces.img("mutations/icon-bg-gray.png", 0, 0, 1, ` transform="${matrixOf("mutations/icon-bg-gray.png")}"`))
      + stage
      + placed(MM.mcStateSelectedActive, `<g transform="translate(0.85 -3.65)">${pieces.img("mutations/master-selected.png", 0, 0, 1, ` transform="${matrixOf("mutations/master-selected.png")}"`)}</g>`, ` class="gsel"`),
      ` class="${classes("gmnode gmmaster", master.selected && "selected")}"${master.attrs || ""}`);
    return lines + cells + centre + mutationHeader(layout.view, title, points);
  }
  // The Mutations panel's header, centred at the top of `view`.
  function mutationHeader([vx, vy, vw], title, points) {
    const mid = fmt(vx + vw / 2), y = vy + MUTATION_TITLE_Y;
    return `<text class="gmut-title" x="${mid}" y="${fmt(y)}" text-anchor="middle" font-size="34">${esc(title.toUpperCase())}</text>`
      + `<text class="gmut-points" x="${mid}" y="${fmt(y + 34)}" text-anchor="middle" font-size="22">`
      + `<tspan class="gmut-points-label">${points < 0 ? "POINTS NEEDED" : "POINTS AVAILABLE"}</tspan>`
      + `<tspan dx="12" class="${classes("gpoints-value", points < 0 && "over")}">${Math.abs(points)}</tspan></text>`;
  }
  // The Mutations panel's layouts (ui/mutationLayouts.js), made once.
  let layouts = null;
  function mutationLayouts() {
    const P = art.layout("mutation-panel");
    return layouts = layouts || {
      game: gameLayout(P, SCREEN),
      stacked: stackedLayout(P, art.size("mutations/connector-gray.png")[0])
    };
  }
  // A node's reach (MutationItemsList.updateConnectors: mut_radius).
  const MUTATION_HIT = 66.5;
  // The header's baseline from the view's top (planner-only, by eye: above the top nodes, clear of the screen's edge).
  const MUTATION_TITLE_Y = 70;
  const matrixOf = file => `matrix(${art.fill(file).map(fmt).join(" ")})`;

  /**
   * A group's bonus label in mutagen-panel units (mc_bonus_bkg_new): the bar at alpha 0.8 with the
   * stat glyph on a shield, the stat name and `value`, both centred on the bar. Right-side groups
   * are mirrored. In the mutation layout (`mutation`) it moves as the game moves it
   * (BONUS_MUTATION_SHIFT), by a CSS transform so the move animates.
   * Phones crop the slots to the tree's width around the divider (styles.css, stacked layout), which cuts the
   * labels off, so there they move to `stack` (mutagen-panel units, planner-only): the left groups' end
   * BONUS_STACK_GAP before the divider (`stack.x`) and the right groups' start that far after it; the top
   * groups' sit BONUS_STACK_DROP above `stack.y`, the bottom groups' that far below it. Without `stack` they stay.
   */
  function bonusLabel(n, color, value, mutation = false, stack = null) {
    const M = art.layout("mutagen-panel"), at = M[`groupBonusBkg${n}_1`];
    const { glyph, stat } = MUTAGEN_ART[color];
    const [bx, by, bw, bh] = BONUS_BAR, [gx, gy] = BONUS_GLYPH_AT[glyph];
    const bkg = pieces.box(`bonus/bar-${color}.png`, bx, by, bw, bh, ` opacity="0.8"`)
      + pieces.img("bonus/shield.png", 5, 8) + pieces.img(`bonus/glyph-${glyph}.png`, gx, gy);
    const [a, , , d, tx, ty] = at.matrix;
    const middle = ty + d * (by + bh / 2);
    const [dx, dy] = mutation ? BONUS_MUTATION_SHIFT[n] : [0, 0];
    // The bar's top-left as placed (the right groups' are mirrored), then the shift that takes it to `stack`.
    const left = a > 0 ? tx + a * bx : tx + a * (bx + bw), top = ty + d * by;
    const [sx, sy] = stack ? [
      (n % 2 ? stack.x - BONUS_STACK_GAP - bw : stack.x + BONUS_STACK_GAP) - left,
      (n > 2 ? stack.y + BONUS_STACK_DROP : stack.y - BONUS_STACK_DROP - bh) - top
    ] : [dx, dy];
    // Keyed: it shows only with a mutagen, so a redraw must not match it by position (dom.js, patchHtml).
    // The shifts are CSS variables: styles.css (.gbonus) picks the game's or the stacked one.
    return `<g class="gmove gbonus" data-patch-key="bonus${n}" style="--dx:${fmt(dx)}px;--dy:${fmt(dy)}px;--sx:${fmt(sx)}px;--sy:${fmt(sy)}px${gside(n)}">` + placed(at, bkg)
      + pieces.text(M[`txtBonus${n}_1`], stat, "", { middle })
      + pieces.text(M[`txtBonus${n}_1p`], value, "", { middle }) + `</g>`;
  }

  // Room between a stacked bonus label and the divider, and between it and its group's sockets (by eye).
  const BONUS_STACK_GAP = 8, BONUS_STACK_DROP = 14;
  // Room between a stacked diamond's frame and the crop's edge (by eye).
  const STACK_EDGE = 6;

  // The middle between the groups, where the ornament sits, in the layout's units.
  function ornamentCentre(G) {
    const top = G.gr1_socket3.matrix, right = G.gr2_socket3.matrix, bottom = G.gr3_socket1.matrix;
    return [(top[4] + SOCKET + right[4]) / 2, (top[5] + SOCKET + bottom[5]) / 2];
  }

  // Centre ornament between the groups and the four divider lines (placed as in the game).
  function ornament(G) {
    const [cx, cy] = ornamentCentre(G);
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
  // Not the game's: when the locked slot holding the item opens (ui/tooltip.js), red like the points needed.
  const lockLine = text => text ? `<p class="gtip-lock">${esc(text)}</p>` : "";

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
   * wrapping between them, and the header growing to fit (styles.css, .gtip-sets). `lock`: the
   * locked slot line under the text (lockLine).
   * @param {{ name: string, type?: string, level?: string, req?: string, sets?: string[], current?: TipLine[],
   *   next?: TipLine[], all?: TipLine[], lock?: string, note?: string }} o
   */
  function tooltip({ name, type = "", level = "", req = "", sets = [], current, next, all, lock = "", note = "" }) {
    const block = (cls, label, lines) => lines && lines.length
      ? `<div class="${cls}">${label ? `<span class="gtip-label">${label}</span>` : ""}${lines.map(tipLine).join("")}</div>` : "";
    // The comma stays with the set before it, so a line never starts with one.
    const setList = sets.length ? `<span class="gtip-sets">${sets.map((s, i) =>
      span("gtip-set", i < sets.length - 1 ? `${s},` : s)).join(" ")}</span>` : "";
    return tipFrame(
      span("gtip-name", name.toUpperCase()) + span("gtip-type", type) + span("gtip-level", level) + span("gtip-req", req) + setList,
      (all ? block("gtip-cur gtip-all", "", all)
        : block("gtip-cur", "Current level:", current) + block("gtip-next", "Next level:", next)) + lockLine(lock), note, " gtip-skill");
  }

  /**
   * Item tooltip (HTML, TooltipInventory): the header with the name and the upper-case item type
   * under it, the stat list (value, then label), the description lines straight under it in the
   * stat label's style, and the rarity line. The game's weight and price row is left out. `lock`:
   * the locked slot line, as in tooltip().
   * @param {{ name: string, type?: string, stats?: { value: string, label: string }[], body?: string[],
   *   rarity?: string, lock?: string, note?: string }} o
   */
  function itemTooltip({ name, type = "", stats = [], body = [], rarity = "", lock = "", note = "" }) {
    const statList = stats.length
      ? `<div class="gtip-stats">${stats.map(s => `<span>${span("gtip-value", s.value)} ${span("gtip-stat", s.label)}</span>`).join("")}</div>` : "";
    return tipFrame(
      span("gtip-name", name.toUpperCase()) + span("gtip-itemtype", type.toUpperCase()),
      statList + (body.length ? `<div class="gtip-desc">${body.map(l => `<span>${esc(l)}</span>`).join("")}</div>` : "") + (rarity ? `<p class="gtip-rarity">${esc(rarity)}</p>` : "") + lockLine(lock),
      note, " gtip-item");
  }

  /**
   * Mutation tooltip (HTML, MutationTooltip): the header with the name, the description, then
   * "ALLOWS USE OF:" with each tree the mutation's slots take, underlined in its colour (the game's
   * colour list); while it can be researched, what that costs; while it can't, the mutations it needs
   * under "REQUIREMENTS". Strengthened Synapses passes `lines` (its stage text) instead of the lists.
   * @param {{ name: string, text: string, allowsLabel?: string, allows?: { label: string, color: string }[],
   *   cost?: { value: string, label: string }[], requirementsLabel?: string, requirements?: string[],
   *   lines?: string[], note?: string, noteOk?: boolean }} o
   */
  function mutationTooltip({ name, text, allowsLabel = "", allows = [], cost = [], requirementsLabel = "", requirements = [], lines = [], note = "", noteOk = false }) {
    const allowList = allows.length ? `<div class="gtip-mut"><span class="gtip-label">${esc(allowsLabel.toUpperCase())}</span>`
      + `<span class="gtip-allows">${allows.map(a => `<span class="gtip-allow" data-color="${esc(a.color)}">${esc(a.label)}</span>`).join("")}</span></div>` : "";
    const costList = cost.length
      ? `<div class="gtip-stats">${cost.map(s => `<span>${span("gtip-value", s.value)} ${span("gtip-stat", s.label)}</span>`).join("")}</div>` : "";
    const reqList = requirements.length ? `<div class="gtip-mut"><span class="gtip-label">${esc(requirementsLabel.toUpperCase())}</span>`
      + requirements.map(r => `<span class="gtip-req-item">${esc(r)}</span>`).join("") + `</div>` : "";
    const extra = lines.length ? `<div class="gtip-cur">${lines.map(l => `<span>${esc(l)}</span>`).join("")}</div>` : "";
    return tipFrame(span("gtip-name", name.toUpperCase()),
      `<div class="gtip-cur gtip-all"><span>${esc(text)}</span></div>` + extra + allowList + costList + reqList, note, " gtip-skill gtip-mutation", noteOk);
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

  return { svg, treePanel, treePanelLift, skillGrid, inventory, pointsRow, centerPointsRow, mutagenPanel, mutationOrb, orbTextGap, mutationPanel, mutationLayouts, bonusLabel, legend, tooltip, itemTooltip, mutationTooltip, hintTooltip, popup };
}
