// SVG builders for the Character-screen pieces: tree node, slot socket, mutagen diamond,
// connector, tab and layout text. Each returns markup in the piece's own game units (a socket is
// 64x64), so the caller places it with a layout matrix or a translate().
//
// Stacking order and offsets follow docs/game-assets.md. Values marked "by eye" are not in the
// game files we read; they were matched to the screenshots in docs/reference/.
import { esc } from "./dom.js";
import { artUrl, MUTAGEN_ART, SOCKET } from "./gameArt.js";

const fmt = n => +n.toFixed(2);
export const matrix = m => `matrix(${m.map(fmt).join(" ")})`;
/** Wraps markup in a layout child's placement. */
export const placed = (child, inner) => `<g transform="${matrix(child.matrix)}">${inner}</g>`;

// Icon alpha per tree node state (by eye).
const ICON_ALPHA = { locked: 0.3, open: 1, learned: 1 };
// Skill icons sit inside the 64px border.
const ICON_INSET = 4;
// node/selected.png is drawn at a quarter of its size, about 76px around a socket (by eye).
const SELECTED_SCALE = 0.25;
// Rank pips: square art turned 45°, 7px, 12px apart (by eye).
const PIP = { size: 7, step: 12 };

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

  const icon = (file, alpha = 1) =>
    img(file, ICON_INSET, ICON_INSET, (SOCKET - 2 * ICON_INSET) / SOCKET, alpha < 1 ? ` opacity="${alpha}"` : "");

  // Rank pips centred on the layout's mcSkillPoints. Every rank draws the empty coloured pip;
  // learned ranks add the fill on top, so the frame stays visible around it.
  function pips(at, rank, color, max = 3) {
    const [, , , , cx, cy] = at.matrix;
    const layer = file => box(file, -PIP.size / 2, -PIP.size / 2, PIP.size, PIP.size);
    let out = "";
    for (let i = 0; i < max; i++) {
      const x = cx + (i - (max - 1) / 2) * PIP.step;
      const fill = i < rank ? layer("node/pip-fill.png") : "";
      out += `<g transform="translate(${fmt(x)} ${fmt(cy)}) rotate(45)">${layer(`node/pip-${color}.png`)}${fill}</g>`;
    }
    return out;
  }

  const selectedFrame = at => placed(at, imgAt("node/selected.png", 0, 0, SELECTED_SCALE));
  // The core frame's green frame label reuses the plain green border.
  const coreBorder = color => color === "green" ? "node/border-green.png" : `node/core-border-${color}.png`;

  /**
   * A skill in the tree. The state art is read from the reference screenshots:
   * locked = dark with a dim icon, open = tree colour fill, learned = fill + coloured border + pips.
   * @param {{ icon: string, color: string, state: "locked" | "open" | "learned",
   *   rank?: number, core?: boolean, selected?: boolean }} o
   */
  function treeNode({ icon: file, color, state, rank = 0, core = false, selected = false }) {
    const L = art.layout("tree-node");
    const learned = state === "learned";
    const edge = learned ? color : "grey";
    return (state === "locked" ? img("node/equipped-overlay.png", 0, 0, 0.5) : img(`node/equipped-${color}.png`, 0, 0, 0.5))
      + icon(file, ICON_ALPHA[state])
      + img(core ? coreBorder(edge) : `node/border-${edge}.png`, 0, 0, 0.5)
      + (learned ? pips(L.mcSkillPoints, rank, color) : "")
      + (selected ? selectedFrame(L.mcStateSelectedActive) : "");
  }

  /**
   * A slot socket. No icon = empty. `match` (skill colour = group mutagen colour) shows the edge glow.
   * @param {{ icon?: string, color?: string, rank?: number, locked?: boolean, match?: boolean, selected?: boolean }} o
   */
  function socket({ icon: file, color, rank = 0, locked = false, match = false, selected = false }) {
    const L = art.layout("mutagen-socket");
    let out = imgAt("slots/frame.svg", SOCKET / 2, SOCKET / 2);
    if (match) out += placed(L.mcColorBorder, imgAt(`slots/glow-${color}.png`, 0, 0));
    if (locked) out += placed(L.iconLock, img("slots/lock.svg", 0, 0));
    else if (file) {
      out += img(`node/equipped-${color}.png`, 0, 0, 0.5) + icon(file)
        + img(`node/border-${color}.png`, 0, 0, 0.5) + pips(L.mcSkillPoints, rank, color);
    }
    if (selected) out += selectedFrame(L.mcStateSelectedActive);
    return out;
  }

  /**
   * A mutagen diamond, unrotated: the layout matrix turns it 45°. The fill fits inside the frame
   * through the layout's background matrix on a 64px square (square size by eye).
   * @param {{ color?: string, size?: "lesser" | "normal" | "greater", locked?: boolean }} o
   */
  function diamond({ color = "", size = "greater", locked = false }) {
    const L = art.layout("mutagen-diamond");
    return piece("mutagens/diamond-frame.svg")
      + placed(L.background, `<rect width="${SOCKET}" height="${SOCKET}" fill="${MUTAGEN_ART[color].fill}"/>`)
      + (color && !locked ? imgAt(`mutagens/item-${color}-${size}.png`, SOCKET / 2, SOCKET / 2, 0.9) : "")
      + (locked ? placed(L.iconLock, img("slots/lock.svg", 0, 0)) : "");
  }

  /** A connector piece in a colour; inactive connectors draw nothing. */
  const connector = (kind, color) => color ? piece(`mutagens/connectors/${kind}-${color}.svg`) : "";

  /**
   * A tree tab at its origin: icon above the colour bar, the selected glow on the open tab,
   * and the hover icon (shown by CSS on .gtab:hover). The tab shape spans about (-30, -5) to (36, 47).
   */
  function tab(tree, open, count) {
    const T = art.layout("tab");
    const cx = 3, cy = 15.5;
    return img(`tabs/${tree}-bar.png`, -30, 36, 0.5)
      + (open ? imgAt(`tabs/${tree}-selected.png`, cx, cy, T.mcOpened.matrix[0])
        : `<g class="ico">${imgAt(`tabs/${tree}.png`, cx, cy)}</g><g class="hov">${imgAt(`tabs/${tree}-hover.png`, cx, cy)}</g>`)
      + (count == null ? "" : text(T.mcText, count));
  }

  /** Text placed like a layout text field: box, size, colour and alignment from the layout. */
  function text(child, str, attrs = "") {
    const { box: [x0, , x1], size, color, align } = child.text;
    const [, , , , tx, ty] = child.matrix;
    // Flash text fields have a 2px gutter inside their box.
    const x = align === "right" ? tx + x1 - 2 : align === "center" ? tx + (x0 + x1) / 2 : tx + x0 + 2;
    const anchor = { right: "end", center: "middle" }[align] || "start";
    return `<text x="${fmt(x)}" y="${fmt(ty)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${attrs}>${esc(str)}</text>`;
  }

  return { box, img, imgAt, piece, treeNode, socket, diamond, connector, tab, text };
}
