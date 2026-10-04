// SVG builders for the Character-screen pieces: tree node, slot socket, mutagen diamond,
// connector, tab and layout text. Each returns markup in the piece's own game units (a socket is
// 64x64), so the caller places it with a layout matrix or a translate().
//
// Stacking order and offsets follow docs/game-assets.md. Values marked "by eye" are not in the
// game files we read; they were matched to the screenshots in docs/reference/.
import { esc } from "./dom.js";
import { artUrl, mutagenIcon, BACKDROP_FILL, DIVIDER, DROP_TARGET, INVENTORY, LOCKED_BORDER_ALPHA, MUTAGEN_ART, OVER_GLOW, SCREEN, SOCKET } from "./gameArt.js";

export const fmt = n => +n.toFixed(2);
export const matrix = m => `matrix(${m.map(fmt).join(" ")})`;
/** Wraps markup in a layout child's placement. `attrs` go on the wrapping group. */
export const placed = (child, inner, attrs = "") => `<g transform="${matrix(child.matrix)}"${attrs}>${inner}</g>`;

// Icon alpha per tree node state (by eye).
const ICON_ALPHA = { locked: 0.3, open: 1, learned: 1 };
// Skill icons sit inside the 64px border.
const ICON_INSET = 4;
// node/selected.png is drawn at a quarter of its size, about 76px around a socket (by eye).
const SELECTED_SCALE = 0.25;
const DIAMOND_FRAME = "mutagens/diamond-frame.svg";
// Open (available, unlearned) skills: the colour fill under node/equipped-overlay.png's vignette
// at OPEN_VIGNETTE alpha and a black shade at OPEN_SHADE alpha. Both fitted to an in-game
// screenshot of an open red skill (fill pixels within about 1 level of brightness).
const OPEN_VIGNETTE = 0.5;
const OPEN_SHADE = 0.45;
// mcHoldAnimBlock: a white square shown while a skill (in the tree or a socket) is held to acquire
// it (ui/hold.js). The game grows it from y 64 to 2 (SlotSkillGrid.startPurchaseAnimation);
// styles.css (.gbuy) animates it.
const BUY_BLOCK = `<rect class="gbuy" y="2" width="${SOCKET}" height="${SOCKET - 2}" fill="#fff"/>`;
// Connector masks [x, y, w, h] in piece units: ConnectorLineRef and SkillSlotConnectorRef clip
// their line with a rectangle (sprite 646, 14.5x13.75) scaled on the "complete" frame. It cuts the
// line's T-cap wings and the corner's end that would run into the socket frame.
const CONNECTOR_MASK = {
  line: [-3, -4, 14.5 * 0.4138, 13.75 * 2.22136],
  corner: [-3, -1, 14.5 * 6.70984, 13.75 * 1.81808]
};
// Inventory cell lift under an item (by eye: about +4 brightness on the reference).
const ITEM_FILL = "rgba(255, 255, 255, 0.025)";
// Cap height of the game font (styles.css --font-game, D-DIN Condensed: OS/2 sCapHeight 690 / 1000).
const GAME_FONT_CAP_HEIGHT = 0.69;

// Hover glow filters by piece kind, referenced by id from every game SVG.
const GLOW_ID = { skill: "gglow-skill", item: "gglow-item" };

/**
 * The hover glow filters, to put once in an always-rendered <svg> on the page. Each draws only the
 * glow (GlowFilter without the source): the alpha blurred, filled with the colour, times the strength.
 */
export function glowFilters() {
  const { color, strength, sigma } = OVER_GLOW;
  return Object.entries(GLOW_ID).map(([kind, id]) =>
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceAlpha" stdDeviation="${sigma[kind]}" result="blur"/>`
    + `<feFlood flood-color="${color}"/><feComposite in2="blur" operator="in"/>`
    + `<feComponentTransfer><feFuncA type="linear" slope="${strength}"/></feComponentTransfer></filter>`).join("");
}

/** @param {import("./gameArt.js").Art} art */
export function createPieces(art) {
  const box = (file, x, y, w, h, attrs = "") =>
    `<image href="${artUrl(file)}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" preserveAspectRatio="none"${attrs}/>`;

  // Image at its own size times `scale`, top-left at (x, y).
  function img(file, x, y, scale = 1, attrs = "") {
    const [w, h] = art.size(file);
    return box(file, x, y, w * scale, h * scale, attrs);
  }
  // Same, centred on (cx, cy).
  function imgAt(file, cx, cy, scale = 1, attrs = "") {
    const [w, h] = art.size(file);
    return img(file, cx - w * scale / 2, cy - h * scale / 2, scale, attrs);
  }
  // A vector piece with its origin at (0, 0).
  function piece(file, attrs = "") {
    const [ox, oy] = art.origin(file);
    return img(file, -ox, -oy, 1, attrs);
  }
  // An atlas slice where its game shape draws it, through the shape's bitmap fill matrix.
  const filled = file => img(file, 0, 0, 1, ` transform="${matrix(art.fill(file))}"`);

  // The game's image loader, which glows on hover: the icon over a copy of it through a glow-only
  // filter (glowFilters). Class "gglow": styles.css shows the copy on hover. The icon itself is never
  // filtered, since a filter re-rasterizes it and blurs icons at fractional positions. The copy keeps the
  // icon's alpha, so a faded icon glows faintly, as the game's loader does around its faded content.
  const glowable = (inner, kind = "skill") => `<g class="gglow" filter="url(#${GLOW_ID[kind]})">${inner}</g>${inner}`;
  const icon = (file, alpha = 1) =>
    glowable(img(file, ICON_INSET, ICON_INSET, (SOCKET - 2 * ICON_INSET) / SOCKET, alpha < 1 ? ` opacity="${alpha}"` : ""));

  // Rank pips centred on the layout's mcSkillPoints (SlotPointIndicator.setCount): one
  // SkillPointIndicatorSingle per rank (layout "pip"), spaced by its width, so their corners touch.
  // Every rank draws the empty coloured pip; learned ranks add the fill on top.
  function pips(at, rank, color, max = 3) {
    const P = art.layout("pip");
    const [, , , , cx, cy] = at.matrix;
    const [a, , c] = P.mcBackground.matrix;
    const step = art.size(`node/pip-${color}.png`)[0] * (Math.abs(a) + Math.abs(c));
    let out = "";
    for (let i = 0; i < max; i++) {
      const x = cx + (i - (max - 1) / 2) * step;
      const fill = i < rank ? placed(P.fill, imgAt("node/pip-fill.png", 0, 0)) : "";
      out += `<g transform="translate(${fmt(x)} ${fmt(cy)})">${placed(P.mcBackground, imgAt(`node/pip-${color}.png`, 0, 0))}${fill}</g>`;
    }
    return out;
  }

  // Class "gsel": styles.css pulses it, and hides it inside an unselected .gnode / .gsock / .gdiamond.
  const selectedFrame = (at, scale = SELECTED_SCALE) => placed(at, imgAt("node/selected.png", 0, 0, scale), ` class="gsel"`);
  // mcStateDropTarget (sprite 509): shape 507, a 64px square outline, centred, at DROP_TARGET's
  // colour and alpha. Drawn as a vector with a 1px non-scaling stroke: as an image the line blurs and
  // loses an edge on the diamond (0.61 scale, turned 45°), and this keeps it as thin as the sockets'.
  // Class "gdrop": styles.css fades it in on a holder with class "drop" (ui/dropTargets.js).
  const dropFrame = at => placed(at, `<rect x="-32" y="-32" width="${SOCKET}" height="${SOCKET}" fill="none" stroke="${DROP_TARGET.color}"`
    + ` stroke-opacity="${DROP_TARGET.alpha}" stroke-width="1" vector-effect="non-scaling-stroke"/>`, ` class="gdrop"`);
  // The core frame's green frame label reuses the plain green border.
  const coreBorder = color => color === "green" ? "node/border-green.png" : `node/core-border-${color}.png`;

  // Background per tree node state, under the icon.
  const NODE_FILL = {
    locked: () => "",
    open: color => img(`node/equipped-${color}.png`, 0, 0, 0.5) + img("node/equipped-overlay.png", 0, 0, 0.5, ` opacity="${OPEN_VIGNETTE}"`)
      + `<rect class="gshade" width="${SOCKET}" height="${SOCKET}" fill="#000" opacity="${OPEN_SHADE}"/>`,
    learned: color => img(`node/equipped-${color}.png`, 0, 0, 0.5)
  };

  /**
   * A skill in the tree. The state art is read from the reference screenshots:
   * locked = no fill, dim icon, faded grey border (LOCKED_BORDER_ALPHA, close to the dark lines);
   * open = darkened tree colour fill, grey border; learned = fill + coloured border + pips.
   * Open and learned skills carry the hold block, under the border (by eye).
   * @param {{ icon: string, color: string, state: "locked" | "open" | "learned",
   *   rank?: number, core?: boolean, selected?: boolean }} o
   */
  function treeNode({ icon: file, color, state, rank = 0, core = false, selected = false }) {
    const L = art.layout("tree-node");
    const learned = state === "learned";
    const edge = learned ? color : "grey";
    const edgeAlpha = state === "locked" ? ` opacity="${LOCKED_BORDER_ALPHA}"` : "";
    return NODE_FILL[state](color)
      + icon(file, ICON_ALPHA[state])
      + (state === "locked" ? "" : BUY_BLOCK)
      + img(core ? coreBorder(edge) : `node/border-${edge}.png`, 0, 0, 0.5, edgeAlpha)
      + (learned ? pips(L.mcSkillPoints, rank, color) : "")
      + (selected ? selectedFrame(L.mcStateSelectedActive) : "");
  }

  /**
   * A slot socket. No icon = empty. A full one carries the hold block, like a tree node. An
   * unlocked one carries the drop target frame, around its frame and under the skill like the game's.
   * `allowed` (e.g. "red-green") marks a slot that takes only those skill colours and shows the
   * edge glow `slots/glow-<allowed>`: SlotSkillSocket shows mcColorBorder only for data.colorBorder,
   * never for a skill matching its group's mutagen (that only lights the connectors).
   * @param {{ icon?: string, color?: string, rank?: number, locked?: boolean, allowed?: string, selected?: boolean }} o
   */
  function socket({ icon: file, color, rank = 0, locked = false, allowed = "", selected = false }) {
    const L = art.layout("mutagen-socket");
    let out = placed(L.frame, img("slots/frame.svg", 0, 0));
    if (allowed) out += placed(L.mcColorBorder, imgAt(`slots/glow-${allowed}.png`, 0, 0));
    if (locked) out += placed(L.iconLock, img("slots/lock.svg", 0, 0));
    else out += dropFrame(L.mcStateDropTarget);
    if (!locked && file) {
      out += img(`node/equipped-${color}.png`, 0, 0, 0.5) + icon(file) + BUY_BLOCK
        + img(`node/border-${color}.png`, 0, 0, 0.5) + pips(L.mcSkillPoints, rank, color);
    }
    if (selected) out += selectedFrame(L.mcStateSelectedActive);
    return out;
  }

  /**
   * A mutagen diamond, unrotated: the layout matrix turns it 45°. The fill fits inside the frame
   * through the layout's background matrix on a 64px square (square size by eye). The selection
   * frame is the sockets' sprite, turned with the diamond. An unlocked one carries the drop target
   * frame inside its frame, under the mutagen (the game loads the icon over it).
   * @param {{ color?: string, size?: "lesser" | "normal" | "greater", locked?: boolean, selected?: boolean }} o
   */
  function diamond({ color = "", size = "greater", locked = false, selected = false }) {
    const L = art.layout("mutagen-diamond");
    return piece(DIAMOND_FRAME)
      + placed(L.background, `<rect width="${SOCKET}" height="${SOCKET}" fill="${MUTAGEN_ART[color].fill}"/>`)
      + (locked ? "" : dropFrame(L.mcStateDropTarget))
      + (color && !locked ? glowable(imgAt(mutagenIcon(color, size), SOCKET / 2, SOCKET / 2, 0.9)) : "")
      + (locked ? placed(L.iconLock, img("slots/lock.svg", 0, 0)) : "")
      + (selected ? selectedFrame(diamondSelection(L.mcStateSelectedActive)) : "");
  }
  // The layout's selection placement sits about 2px off the frame's centre and stretches one
  // diagonal by 3%, which shows against the frame: keep its mean scale, centred on the frame.
  function diamondSelection({ matrix: [a, , , d] }) {
    const [w, h] = art.size(DIAMOND_FRAME), [ox, oy] = art.origin(DIAMOND_FRAME), s = (a + d) / 2;
    return { matrix: [s, 0, 0, s, w / 2 - ox, h / 2 - oy] };
  }

  /**
   * An inventory cell at its origin, INVENTORY.cell square: the item's icon on a faint lift, and
   * the selection frame like a tree node's, scaled to sit inside the cell like the game's so
   * neighbouring selections don't overlap. No icon = empty cell (the grid lines show it).
   * @param {{ icon?: string, selected?: boolean }} o
   */
  function item({ icon: file, selected = false }) {
    const c = INVENTORY.cell;
    if (!file) return "";
    return `<rect width="${c}" height="${c}" fill="${ITEM_FILL}"/>` + glowable(box(file, 0, 0, c, c), "item")
      + (selected ? selectedFrame({ matrix: [1, 0, 0, 1, c / 2, c / 2] }, c / art.size("node/selected.png")[0]) : "");
  }

  /** A mutagen divider line, centred on (0, 0) and running along y. */
  function divider() {
    const [x, y, w, h] = DIVIDER.rect;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${DIVIDER.color}"/>`;
  }

  /** A connector piece in a colour, cut to the game's mask; inactive connectors draw nothing. */
  function connector(kind, color) {
    if (!color) return "";
    const [x, y, w, h] = CONNECTOR_MASK[kind].map(fmt);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden">`
      + piece(`mutagens/connectors/${kind}-${color}.svg`) + `</svg>`;
  }

  /**
   * A tree tab at its origin: icon above the colour bar, the selected glow on the open tab (in
   * mcOpened), and the hover icon (shown by CSS on .gtab:hover). Every slice sits where its game
   * shape's bitmap fill puts it. The tab shape spans about (-30, -5) to (36, 47).
   */
  function tab(tree, open, count) {
    const T = art.layout("tab");
    return filled(`tabs/${tree}-bar.png`)
      + (open ? placed(T.mcOpened, filled(`tabs/${tree}-selected.png`))
        : `<g class="ico">${filled(`tabs/${tree}.png`)}</g><g class="hov">${filled(`tabs/${tree}-hover.png`)}</g>`)
      + (count == null ? "" : text(T.mcText, count));
  }

  /**
   * The Character screen backdrop in screen units, back to front: the fill, the region panorama
   * at 22%, two fog layers (placement unverified) and the DNA image.
   * @param {string} region  Panorama id, e.g. "velen" for backdrop/panorama-velen.jpg.
   */
  function backdrop(region) {
    const S = art.layout("screen");
    return `<rect width="${SCREEN.w}" height="${SCREEN.h}" fill="${BACKDROP_FILL}"/>`
      + img(`backdrop/panorama-${region}.jpg`, -23, -2, 1, ` opacity="0.22"`)
      + box("backdrop/fog.png", 0, 0, 1500, 778, ` opacity="0.7"`)
      + box("backdrop/fog.png", 420, 302, 1500, 778, ` opacity="0.6"`)
      + placed(S.mcBackgroundImage, img("backdrop/dna.png", 0, 0));
  }

  /**
   * Text placed like a layout text field: box, size, colour and alignment from the layout. By
   * default it hangs from the field's top; with `middle` its capitals are centred on that y instead
   * (hanging from the font's ascent leaves short text low on a bar).
   */
  function text(child, str, attrs = "", { middle } = {}) {
    const { box: [x0, , x1], size, color, align } = child.text;
    const [, , , , tx, ty] = child.matrix;
    // Flash text fields have a 2px gutter inside their box.
    const x = align === "right" ? tx + x1 - 2 : align === "center" ? tx + (x0 + x1) / 2 : tx + x0 + 2;
    const anchor = { right: "end", center: "middle" }[align] || "start";
    const y = middle == null
      ? `y="${fmt(ty)}" dominant-baseline="text-before-edge"`
      : `y="${fmt(middle + size * GAME_FONT_CAP_HEIGHT / 2)}"`;
    return `<text x="${fmt(x)}" ${y} font-size="${size}" fill="${color}" text-anchor="${anchor}"${attrs}>${esc(str)}</text>`;
  }

  return { box, img, imgAt, piece, treeNode, socket, diamond, item, divider, connector, tab, backdrop, text };
}
