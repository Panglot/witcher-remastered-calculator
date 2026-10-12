// SVG builders for the Character-screen pieces: tree node, slot socket, mutagen diamond,
// connector, tab and layout text. Each returns markup in the piece's own game units (a socket is
// 64x64), so the caller places it with a layout matrix or a translate().
//
// Stacking order and offsets follow docs/game-assets.md. Values marked "by eye" are not in the
// game files we read; they were matched to the screenshots in docs/reference/.
import { esc } from "./dom.js";
import { artUrl, mutagenIcon, BACKDROP_FILL, DIVIDER, DROP_TARGET, EQUIPPED_TINT, INVENTORY, LOCKED_BORDER_ALPHA, MUTAGEN_ART, MUTATION_NODE, dropdownArrow, dropdownArrowMask, OVER_GLOW, SCREEN, SKILL_FILL, SOCKET } from "./gameArt.js";

export const fmt = n => +n.toFixed(2);
export const matrix = m => `matrix(${m.map(fmt).join(" ")})`;
/** Wraps markup in a layout child's placement. `attrs` go on the wrapping group. */
export const placed = (child, inner, attrs = "") => `<g transform="${matrix(child.matrix)}"${attrs}>${inner}</g>`;

// Icon alpha per tree node state (by eye).
const ICON_ALPHA = { locked: 0.3, open: 1, learned: 1 };
// Skill icons sit inside the 64px border.
const ICON_INSET = 4;
// mcStateSelectedActive differs by holder. Tree nodes place sprite 465: node/selected.png filling a
// 76px square at (-38, -38), a quarter of its size. Sockets and diamonds place sprite 513: the vector
// slots/selected.svg (shape 511, 73.4 x 69.15), which their layout matrices stretch to a square.
const NODE_SELECTED_SCALE = 0.25;
const SLOT_SELECTED = "slots/selected.svg";
export const DIAMOND_FRAME = "mutagens/diamond-frame.svg";
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
// Fills a shape with one colour, kept to its alpha: the lock warning's lock (lockWarn). The colour
// is set in styles.css (.glock-tint), so it follows --bad.
const LOCK_TINT_ID = "glock-tint";
// Touch buttons on a skill's sides (planner-only, stepButton): the side panels' toggle
// (ui/sidePanel.js, toggleArt) drawn 24 px wide. On a phone the tree is drawn at about 0.6 px a
// unit, so the tap area is larger than the button: the skill's full height, and from `in` px inside
// the skill to `out` px beyond its edge, half the 46 px gap to its neighbour (gameArt.js, GAP_X).
const STEP = { size: 24, hit: { in: 16, out: 23, half: SOCKET / 2 }, ink: "#f8f8f8", rim: "#100808" };
// On an open (unlearned) skill the button looks like that skill: the rings in the grey border's
// tone (node/border-grey.png, brightened: thin rings read darker), and the fill darkened by the
// same vignette (OPEN_VIGNETTE times node/equipped-overlay.png's mean cover, 0.66) and shade.
const STEP_OPEN = { rim: "#d4d2d4", shade: 1 - (1 - OPEN_VIGNETTE * 0.66) * (1 - OPEN_SHADE) };
const STEP_ARROW_ID = "gstep-arrow";
const STEP_TURN = { add: 180, remove: 0 };

/** The touch buttons' arrow mask, to put once in an always-rendered <svg> on the page. */
export const stepDefs = () => dropdownArrowMask(STEP_ARROW_ID);

/**
 * The hover glow filters, to put once in an always-rendered <svg> on the page. Each draws only the
 * glow (GlowFilter without the source): the alpha blurred, filled with the colour, times the strength.
 * With them, the lock warning's tint (LOCK_TINT_ID).
 */
export function glowFilters() {
  const { color, strength, sigma } = OVER_GLOW;
  return Object.entries(GLOW_ID).map(([kind, id]) =>
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceAlpha" stdDeviation="${sigma[kind]}" result="blur"/>`
    + `<feFlood flood-color="${color}"/><feComposite in2="blur" operator="in"/>`
    + `<feComponentTransfer><feFuncA type="linear" slope="${strength}"/></feComponentTransfer></filter>`).join("")
    + `<filter id="${LOCK_TINT_ID}" color-interpolation-filters="sRGB"><feFlood class="glock-tint"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
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
  // `inner` is the frame art: the tree node's bitmap by default, or the slots' vector (slotSelection).
  const selectedFrame = (at, inner = imgAt("node/selected.png", 0, 0, NODE_SELECTED_SCALE)) => placed(at, inner, ` class="gsel"`);
  const slotSelection = () => piece(SLOT_SELECTED);
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
  function treeNode({ icon: file, color, state, rank = 0, core = false, selected = false, fading = false }) {
    const L = art.layout("tree-node");
    const learned = state === "learned";
    const edge = learned ? color : "grey";
    const edgeAlpha = state === "locked" ? ` opacity="${LOCKED_BORDER_ALPHA}"` : "";
    return NODE_FILL[state](color)
      // Planner-only: a skill a cascade just took keeps a ghost of its learned fill, fading out (ui/cascade.js).
      + (fading ? `<g class="gfade">${NODE_FILL.learned(color)}</g>` : "")
      + icon(file, ICON_ALPHA[state])
      + (state === "locked" ? "" : BUY_BLOCK)
      + img(core ? coreBorder(edge) : `node/border-${edge}.png`, 0, 0, 0.5, edgeAlpha)
      + (learned ? pips(L.mcSkillPoints, rank, color) : "")
      + (selected ? selectedFrame(L.mcStateSelectedActive) : "");
  }

  // A full holder in a locked slot (soft mode, or a loaded build in hard mode; core/slotLocks.js):
  // not the game's. A dark mask over the item (a SOCKET square placed by `maskAt`), so the lock
  // reads over a bright icon, a red edge on the holder's frame (`box`: [x, y, w, h] in piece
  // units) and the lock in the edge's red (LOCK_TINT_ID), pulsing together (styles.css, .glock-warn).
  const lockWarn = ([x, y, w, h], lockAt, maskAt) => `<g class="glock-warn">`
    + placed(maskAt, `<rect class="glock-mask" width="${SOCKET}" height="${SOCKET}"/>`)
    + `<rect class="glock-edge" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="none" vector-effect="non-scaling-stroke"/>`
    + `${placed(lockAt, img("slots/lock.svg", 0, 0, 1, ` filter="url(#${LOCK_TINT_ID})"`))}</g>`;
  const AT_ORIGIN = { matrix: [1, 0, 0, 1, 0, 0] };

  /**
   * A slot socket. No icon = empty. A full one carries the hold block, like a tree node. An
   * unlocked one carries the drop target frame, around its frame and under the skill like the game's.
   * A locked one shows the lock; with a skill in it, the skill under the lock warning (lockWarn).
   * `allowed` (e.g. "red-green") marks a slot that takes only those skill colours and shows the
   * edge glow `slots/glow-<allowed>`: SlotSkillSocket shows mcColorBorder only for data.colorBorder,
   * never for a skill matching its group's mutagen (that only lights the connectors). The glow's
   * lines run along the socket's bottom edge; `flip` puts them along the top (the game's _Top
   * frames: the same art, flipped).
   * @param {{ icon?: string, color?: string, rank?: number, locked?: boolean, allowed?: string, flip?: boolean, selected?: boolean }} o
   */
  function socket({ icon: file, color, rank = 0, locked = false, allowed = "", flip = false, selected = false }) {
    const L = art.layout("mutagen-socket");
    let out = placed(L.frame, img("slots/frame.svg", 0, 0));
    if (allowed) out += placed(L.mcColorBorder, imgAt(`slots/glow-${allowed}.png`, 0, 0, 1, flip ? ` transform="scale(1 -1)"` : ""));
    if (locked && !file) out += placed(L.iconLock, img("slots/lock.svg", 0, 0));
    else out += dropFrame(L.mcStateDropTarget);
    if (file) {
      out += img(`node/equipped-${color}.png`, 0, 0, 0.5) + icon(file) + BUY_BLOCK
        + img(`node/border-${color}.png`, 0, 0, 0.5) + pips(L.mcSkillPoints, rank, color);
      if (locked) {
        const [a, , , d, x, y] = L.frame.matrix, [w, h] = art.size("slots/frame.svg");
        out += lockWarn([x, y, w * a, h * d], L.iconLock, AT_ORIGIN);
      }
    }
    if (selected) out += selectedFrame(L.mcStateSelectedActive, slotSelection());
    return out;
  }

  /**
   * A mutagen diamond, unrotated: the layout matrix turns it 45°. The fill fits inside the frame
   * through the layout's background matrix on a 64px square (square size by eye). The selection
   * frame is the sockets' sprite, turned with the diamond. An unlocked one carries the drop target
   * frame inside its frame, under the mutagen (the game loads the icon over it). A locked one shows
   * the lock; with a mutagen in it, the mutagen under the lock warning (lockWarn).
   * @param {{ color?: string, size?: "lesser" | "normal" | "greater", locked?: boolean, selected?: boolean }} o
   */
  function diamond({ color = "", size = "greater", locked = false, selected = false }) {
    const L = art.layout("mutagen-diamond");
    const [w, h] = art.size(DIAMOND_FRAME), [ox, oy] = art.origin(DIAMOND_FRAME);
    return piece(DIAMOND_FRAME)
      + placed(L.background, `<rect width="${SOCKET}" height="${SOCKET}" fill="${MUTAGEN_ART[color].fill}"/>`)
      + (locked && !color ? "" : dropFrame(L.mcStateDropTarget))
      + (color ? glowable(imgAt(mutagenIcon(color, size), SOCKET / 2, SOCKET / 2, 0.9)) : "")
      + (locked && !color ? placed(L.iconLock, img("slots/lock.svg", 0, 0)) : "")
      + (locked && color ? lockWarn([-ox, -oy, w, h], L.iconLock, L.background) : "")
      + (selected ? selectedFrame(diamondSelection(L.mcStateSelectedActive), slotSelection()) : "");
  }
  // The layout's selection placement sits about 2px off the frame's centre and leaves one diagonal
  // 3% longer, which shows against the frame: keep its mean size as a square, centred on the frame.
  function diamondSelection({ matrix: [a, , , d] }) {
    const [w, h] = art.size(DIAMOND_FRAME), [ox, oy] = art.origin(DIAMOND_FRAME);
    const [sw, sh] = art.size(SLOT_SELECTED), side = (a * sw + d * sh) / 2;
    return { matrix: [side / sw, 0, 0, side / sh, w / 2 - ox, h / 2 - oy] };
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
      + (selected ? selectedFrame({ matrix: [1, 0, 0, 1, c / 2, c / 2] }, imgAt("node/selected.png", 0, 0, c / art.size("node/selected.png")[0])) : "");
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
      + `<g class="gtab-icon">${open ? placed(T.mcOpened, filled(`tabs/${tree}-selected.png`))
        : `<g class="ico">${filled(`tabs/${tree}.png`)}</g><g class="hov">${filled(`tabs/${tree}-hover.png`)}</g>`}</g>`
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

  /**
   * A touch button centred on (0, 0), a skill's edge, on the skill's background colour (SKILL_FILL):
   * an up arrow adds a point, a down arrow removes one. On an open skill it takes that skill's look
   * (STEP_OPEN). Class "gstep": styles.css shows it only on touch screens. Its arrow needs stepDefs
   * on the page.
   * @param {"add" | "remove"} step
   * @param {string} color tree colour
   * @param {"open" | "learned"} state the skill's state (treeNode)
   * @param {-1 | 1} out the side the skill's edge faces: -1 left, 1 right
   */
  function stepButton(step, color, state, out, attrs = "") {
    const { in: inside, out: outside, half } = STEP.hit;
    const x0 = out > 0 ? -inside : -outside;
    const open = state === "open", rim = open ? STEP_OPEN.rim : STEP.rim;
    return `<g class="gstep"${attrs}><rect x="${x0}" y="${-half}" width="${inside + outside}" height="${2 * half}" fill="transparent"/>`
      + `<g transform="scale(${fmt(STEP.size / 28)})">`
      + `<circle class="gstep-disc" r="13.5" fill="${SKILL_FILL[color]}"/>`
      + (open ? `<circle r="13.5" fill="#000" opacity="${fmt(STEP_OPEN.shade)}"/>` : "")
      + `<circle r="13.5" fill="none" stroke="${rim}" stroke-width="1"/>`
      + `<circle r="11.25" fill="none" stroke="${rim}" stroke-width="1.5"/>`
      + `<g fill="${STEP.ink}" transform="rotate(${STEP_TURN[step]})">${dropdownArrow(STEP_ARROW_ID)}</g></g></g>`;
  }

  // A layout child's colour transform as a filter (tintDefs draws it).
  const tintOf = cx => cx ? ` filter="url(#${tintId(cx.mult, cx.add)})"` : "";

  /**
   * The Mutations orb (MasterMutationItem_mutationAnimation) at its origin, as both the equipped
   * mutation display and Strengthened Synapses draw it: the colour frame's background with its faint,
   * larger copy behind (mcColor), and the cells. With no active mutation ("default") the cells are
   * grey and still; otherwise they are tinted and drift (styles.css, .gcell). The orb bobs (.gorb-bob).
   * @param {"default" | "red" | "green" | "blue" | "yellow"} color
   */
  function orb(color) {
    const O = art.layout("mutation-orb");
    const cells = color === "default" ? cellsOf(art.layout("mutation-orb-default"), false)
      : `<g transform="translate(33.05 54.95)">${cellsOf(art.layout("mutation-cells"), true)}</g>`;
    const frame = inner => filled(`mutations/orb-${color}.png`) + inner;
    return `<g transform="translate(-62.5 -65.5)"><g class="gorb-bob">`
      + placed(O.mcColor, frame(""), ` opacity="${fmt(O.mcColor.cxform.mult[3])}"`)
      + placed(O.background, frame(cells)) + `</g></g>`;
  }
  // The orb's cells: cell1 to cell4 of a cells layout with their tints; cell4 is the bigger art.
  // Drifting ones get class "gcell gcell<n>".
  const cellsOf = (L, drift) => ["cell1", "cell2", "cell3", "cell4"].map((k, i) =>
    placed(L[k], filled(i === 3 ? "mutations/cell-big.png" : "mutations/cell.png"),
      (drift ? ` class="gcell gcell${i + 1}"` : "") + tintOf(L[k].cxform))).join("");

  /**
   * A mutation in the Mutations panel (MutationItemRef) at its centre: its colour disc, the disc's
   * turning copy once researched, the ring and icon backing while it is the active one, the icon on
   * its backing disc, the hold ring (planner-only, styles.css .gmhold) and the selection frame (shown
   * by CSS on .gmnode.selected). Grey while its requirements aren't researched; dimmed until
   * researched (MUTATION_NODE).
   * @param {{ icon: string, color: string, enabled: boolean, researched: boolean, equipped: boolean }} o
   *   color: its art colour (gameArt.js, mutationArtColor)
   */
  function mutationNode({ icon: file, color, enabled, researched, equipped, fading = false }) {
    const L = art.layout("mutation-node");
    const disc = enabled ? color : "gray";
    const discArt = filled(`mutations/node-${disc}.png`);
    const scale = equipped ? ` transform="scale(${MUTATION_NODE.equippedScale})"` : "";
    const [iw, ih] = art.size(file), [, , , , bx, by] = L.mcIconBackground.matrix;
    // Back to front as the game stacks them (MutationItemRef depths): the active ring (1), the disc (9),
    // its turning copy (11), the selection frame (13), the icon backing (15), then the icon on top
    // (MutationItemRenderer.handleIconLoaded); the hold ring and the cascade mask are planner-only.
    // MutationItem_equippedIndicator (0.8, -3.8) and its ring sprite (0.2, 4.4) sit inside mcEquippedIndicator.
    return (equipped ? placed(L.mcEquippedIndicator, `<g transform="translate(1 0.6)" filter="url(#${equippedTintId(color)})">${filled("mutations/equipped.png")}</g>`) : "")
      // Planner-only: an opaque base under the disc, whose art is see-through (alpha 0.55 to 0.77, less while
      // dimmed), so the connectors' tips that reach under it don't show through.
      + placed(L.mcMutagenColor, `<circle r="${fmt(MUTATION_NODE.baseR * (equipped ? MUTATION_NODE.equippedScale : 1))}" fill="#000"/>`)
      + placed(L.mcMutagenColor, `<g${scale}>${discArt}</g>`, researched ? "" : ` opacity="${MUTATION_NODE.discAlpha}"`)
      + (researched ? placed(L.mcMutagenColorAnim, `<g class="gmspin">${discArt}</g>`, ` opacity="${fmt(L.mcMutagenColorAnim.cxform.mult[3])}"`) : "")
      // Planner-only: a mutation a cascade just took keeps a ghost of its researched disc, fading out (ui/cascade.js).
      + (fading ? placed(L.mcMutagenColor, `<g class="gfade">${filled(`mutations/node-${color}.png`)}</g>`) : "")
      + selectedFrame(L.mcStateSelectedActive, `<g transform="translate(0.85 -3.65)">${filled("mutations/selected.png")}</g>`)
      + placed(L.mcIconBackground, filled(`mutations/icon-bg-${disc}.png`) + (equipped ? `<g transform="translate(-0.1 -0.15)">${filled("mutations/icon-equipped.png")}</g>` : ""))
      + glowable(box(file, bx - iw / 2, by - ih / 2, iw, ih, researched && enabled ? "" : ` opacity="${MUTATION_NODE.iconAlpha}"`))
      + placed(L.mcMutagenColor, `<circle class="gmhold" r="${MUTATION_NODE.holdR}" pathLength="1"/>`) + `<circle class="gcascade-mask" r="70"/>`;
  }

  /** A connector between two mutations (mc_connector) in a colour frame, centred on its origin. */
  const mutationConnector = color => filled(`mutations/connector-${color}.png`);

  /**
   * The colour transform filters the mutation art needs (the orb's cells, the active mutation's
   * ring), to put once in an always-rendered <svg> on the page once the art has loaded.
   */
  function tintDefs() {
    const cells = [art.layout("mutation-orb-default"), art.layout("mutation-cells")]
      .flatMap(L => Object.values(L).map(c => c.cxform).filter(Boolean));
    const m = EQUIPPED_TINT.mult;
    const rings = Object.values(EQUIPPED_TINT.add).map(add => ({ mult: [m, m, m, 1], add: [...add, 0] }));
    const seen = new Set();
    return [...cells, ...rings].map(cx => {
      const id = tintId(cx.mult, cx.add);
      if (seen.has(id)) return "";
      seen.add(id);
      const [r, g, b] = cx.mult, [ar, ag, ab] = cx.add.map(v => fmt(v / 255));
      return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${r} 0 0 0 ${ar} 0 ${g} 0 0 ${ag} 0 0 ${b} 0 ${ab} 0 0 0 1 0"/></filter>`;
    }).join("");
  }
  // The active mutation's ring tint for its art colour.
  function equippedTintId(color) {
    const m = EQUIPPED_TINT.mult;
    return tintId([m, m, m, 1], [...(EQUIPPED_TINT.add[color] || EQUIPPED_TINT.add.yellow), 0]);
  }

  return { box, img, imgAt, piece, treeNode, stepButton, socket, diamond, item, divider, connector, tab, backdrop, text,
    orb, mutationNode, mutationConnector, tintDefs };
}

// A colour transform's filter id: the same numbers give the same id.
const tintId = (mult, add) => `gtint-${[...mult.slice(0, 3).map(v => Math.round(v * 1000)), ...add.slice(0, 3)].join("-")}`;
