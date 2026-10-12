// The Mutations panel's layouts: where each node and connector sits and which screen region the panel
// shows, in screen units. gamePanels.mutationPanel draws whichever layout it is given; ui/mutationsPanel.js
// picks one for the window. A new layout is a new object of the same shape.
// Nodes go by their number in the game's panel (mcMutation1-12, MUTATION_NODES), 13 being Strengthened
// Synapses; connectors by their layout name (mcMutConnectorA_B, mcMasterMutationConnectorN).
import { MUTATION_NODES, MUTATION_PANEL_AT } from "./gameArt.js";

/**
 * @typedef {{ matrix: number[] }} Placement  An SVG matrix [a, b, c, d, tx, ty] in screen units.
 * @typedef {object} MutationLayout
 * @property {string} name
 * @property {number[]} view  The screen region shown, as an SVG viewBox [x, y, w, h]; the header sits at its top.
 * @property {(node: number) => Placement} nodeAt
 * @property {(connector: string) => Placement} linkAt
 * @property {string[]} links  The connectors' layout names.
 */

// The master's node number.
export const MASTER_NODE = 13;
// The node each of the master's connectors leads to.
const MASTER_LINKS = { 1: 2, 2: 3, 3: 4 };
const LINK = /^mc(MutConnector\d+_\d+|MasterMutationConnector\d)$/;
// Every node's number, the master's last.
export const NODE_NUMBERS = [...Object.keys(MUTATION_NODES).map(Number), MASTER_NODE];

/** The two nodes a connector joins, by its layout name. */
export function linkEnds(name) {
  const master = name.match(/^mcMasterMutationConnector(\d)$/);
  return master ? [MASTER_NODE, MASTER_LINKS[master[1]]] : name.match(/(\d+)_(\d+)$/).slice(1).map(Number);
}

// Where a connector stops short of a node's centre (measured from the game's layout): a mutation's disc, the master's orb.
export const nodeRim = n => n === MASTER_NODE ? 93 : 44;

/**
 * A connector between two node centres as the game draws them: the line art (`width` px long, centred on
 * its origin) stretched over the gap between the nodes' rims (`ra`, `rb`) and centred in it. The game's
 * own connectors fit these rims within a few px.
 */
export function connectorBetween([ax, ay], [bx, by], ra, rb, width) {
  const d = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / d, uy = (by - ay) / d;
  const len = d - ra - rb, s = len / width, along = ra + len / 2;
  return { matrix: [ux * s, uy * s, -uy, ux, ax + ux * along, ay + uy * along] };
}

/**
 * The game's layout (MutationPanelRef where MenuCharacterDupe puts it), showing the whole screen.
 * @param {Record<string, { matrix: number[] }>} panel  layout/mutation-panel.json's children
 * @param {{ w: number, h: number }} screen
 * @returns {MutationLayout}
 */
export function gameLayout(panel, screen) {
  const [px, py] = MUTATION_PANEL_AT;
  const shift = ({ matrix: [a, b, c, d, tx, ty] }) => ({ matrix: [a, b, c, d, tx + px, ty + py] });
  return {
    name: "game",
    view: [0, 0, screen.w, screen.h],
    nodeAt: n => shift(panel[`mcMutation${n}`]),
    linkAt: name => shift(panel[name]),
    links: Object.keys(panel).filter(k => LINK.test(k))
  };
}

// The stacked layout's nodes (planner-only, by eye): the same nodes and links in a tall shape growing up
// from the master, mirrored about x 0. The left half and the centre line; the right half mirrors the left.
const STACK_LEFT = { 2: [-150, -210], 1: [-270, -390], 6: [-150, -550], 7: [-150, -830], 11: [-110, -1040] };
const STACK_MIRROR = { 2: 4, 1: 5, 6: 10, 7: 9, 11: 12 };
const STACK_CENTRE = { [MASTER_NODE]: [0, 0], 3: [0, -440], 8: [0, -700] };
export const STACK = {
  ...STACK_CENTRE, ...STACK_LEFT,
  ...Object.fromEntries(Object.entries(STACK_MIRROR).map(([l, r]) => [r, [-STACK_LEFT[l][0], STACK_LEFT[l][1]]]))
};

// A node's reach round its centre (by eye): a mutation's hit circle and the icon backing under it, the
// master's sideways and up, and below (its stage badge).
const NODE_REACH = 72, MASTER_REACH = [96, 125];
// The stacked view's room above the nodes for the header (gamePanels.mutationPanel) and below them. Its
// sides have none: the space to the window's edge is styles.css's (.gmut-view), which scales with the window.
const HEADER_ROOM = 120, BOTTOM_ROOM = 8;

/**
 * The stacked layout (phones and portrait screens): STACK's nodes, the game's connectors stretched
 * between them, and a view cropped to the nodes' reach.
 * @param {Record<string, { matrix: number[] }>} panel  layout/mutation-panel.json's children
 * @param {number} connectorWidth  the connector art's length
 * @returns {MutationLayout}
 */
export function stackedLayout(panel, connectorWidth) {
  const nodeAt = n => ({ matrix: [1, 0, 0, 1, ...STACK[n]] });
  return {
    name: "stacked",
    view: reachBox(nodeAt),
    nodeAt,
    linkAt: name => {
      const [a, b] = linkEnds(name);
      return connectorBetween(STACK[a], STACK[b], nodeRim(a), nodeRim(b), connectorWidth);
    },
    links: Object.keys(panel).filter(k => LINK.test(k))
  };
}

// The box round every node's reach, with the header's room above, as a viewBox.
function reachBox(nodeAt) {
  const boxes = NODE_NUMBERS.map(n => {
    const [, , , , x, y] = nodeAt(n).matrix, [r, below] = n === MASTER_NODE ? MASTER_REACH : [NODE_REACH, NODE_REACH];
    return [x - r, y - r, x + r, y + below];
  });
  const x0 = Math.min(...boxes.map(b => b[0])), x1 = Math.max(...boxes.map(b => b[2]));
  const y0 = Math.min(...boxes.map(b => b[1])) - HEADER_ROOM, y1 = Math.max(...boxes.map(b => b[3])) + BOTTOM_ROOM;
  return [x0, y0, x1 - x0, y1 - y0];
}
