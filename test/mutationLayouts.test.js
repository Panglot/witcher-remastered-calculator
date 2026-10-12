import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gameLayout, stackedLayout, linkEnds, nodeRim, NODE_NUMBERS, MASTER_NODE, STACK } from "../public/src/ui/mutationLayouts.js";

const panel = JSON.parse(readFileSync(new URL("../public/assets/ui/layout/mutation-panel.json", import.meta.url))).children;
const CONNECTOR_W = 300;
const SCREEN = { w: 1920, h: 1080 };
const centre = (layout, n) => layout.nodeAt(n).matrix.slice(4);
// A placed connector's two ends: its art runs CONNECTOR_W along its x axis, centred on its origin.
const ends = ({ matrix: [a, b, , , tx, ty] }) => [[tx - a * CONNECTOR_W / 2, ty - b * CONNECTOR_W / 2], [tx + a * CONNECTOR_W / 2, ty + b * CONNECTOR_W / 2]];
const dist = ([ax, ay], [bx, by]) => Math.hypot(bx - ax, by - ay);

test("the game layout shows the whole screen and keeps the game's connectors", () => {
  const game = gameLayout(panel, SCREEN);
  assert.deepEqual(game.view, [0, 0, 1920, 1080]);
  assert.equal(game.links.length, 14);
  assert.deepEqual(game.linkAt("mcMutConnector2_6").matrix.slice(0, 4), panel.mcMutConnector2_6.matrix.slice(0, 4));
});

test("every connector joins two nodes", () => {
  for (const name of gameLayout(panel, SCREEN).links) {
    const [a, b] = linkEnds(name);
    assert.ok(NODE_NUMBERS.includes(a) && NODE_NUMBERS.includes(b), name);
  }
});

test("the stacked layout is mirrored about its centre line", () => {
  for (const n of NODE_NUMBERS) {
    const [x, y] = STACK[n];
    assert.ok(Object.values(STACK).some(([mx, my]) => mx === -x && my === y), `node ${n}`);
  }
});

test("the stacked layout's nodes keep clear of each other's reach", () => {
  const stacked = stackedLayout(panel, CONNECTOR_W);
  for (const a of NODE_NUMBERS) for (const b of NODE_NUMBERS) {
    if (a < b) assert.ok(dist(centre(stacked, a), centre(stacked, b)) > 2 * 66.5, `${a} and ${b}`);
  }
});

test("the stacked layout's connectors run from rim to rim", () => {
  const stacked = stackedLayout(panel, CONNECTOR_W);
  for (const name of stacked.links) {
    const [a, b] = linkEnds(name), [p, q] = ends(stacked.linkAt(name));
    assert.ok(Math.abs(dist(p, centre(stacked, a)) - nodeRim(a)) < 1e-6, `${name} at ${a}`);
    assert.ok(Math.abs(dist(q, centre(stacked, b)) - nodeRim(b)) < 1e-6, `${name} at ${b}`);
  }
});

test("the stacked view holds every node, the master at the bottom and room for the header above", () => {
  const stacked = stackedLayout(panel, CONNECTOR_W), [x, y, w, h] = stacked.view;
  for (const n of NODE_NUMBERS) {
    const [cx, cy] = centre(stacked, n);
    assert.ok(cx > x && cx < x + w && cy > y && cy < y + h, `node ${n}`);
  }
  assert.equal(Math.max(...NODE_NUMBERS.map(n => centre(stacked, n)[1])), centre(stacked, MASTER_NODE)[1]);
  assert.ok(Math.min(...NODE_NUMBERS.map(n => centre(stacked, n)[1])) - y >= 120);
  assert.ok(w < h, "taller than wide");
});
