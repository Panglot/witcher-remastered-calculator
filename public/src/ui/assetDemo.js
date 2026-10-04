// Asset demo page: the extracted game art put together the way the game draws the Character
// screen, as a preview of where the planner's look is heading. Shows a made-up build, not yours.
// The art loads the first time the page is opened.
import { $, esc } from "./dom.js";
import { artUrl, loadArt, DEFAULT_REGION, GAME_TABS, MUTAGEN_ART, SCREEN, SOCKET, TREE_ART } from "./gameArt.js";
import { createPieces, matrix } from "./gamePieces.js";
import { createPanels } from "./gamePanels.js";

// A made-up tree in game grid units (gridColumn, gridRow) that shows every node state and line
// colour. Row 0 skills are roots. Links are [main, required skill] by index.
const DEMO_NODES = [
  { col: 0, row: 0, rank: 3 }, { col: 3, row: 0, rank: 1 }, { col: 6, row: 0, rank: 2 }, { col: 9, row: 0 }, { col: 12, row: 0 },
  { col: 0, row: 3, rank: 1 }, { col: 3, row: 3 }, { col: 6, row: 3, rank: 1 }, { col: 9, row: 3 }, { col: 12, row: 3 },
  { col: 6, row: 6 },
  { col: 3, row: 9 }, { col: 9, row: 9 },
  { col: 3, row: 12 }, { col: 9, row: 12 },
  { col: 6, row: 15 },
  { col: 3, row: 18 }, { col: 9, row: 18 },
  { col: 6, row: 21 }
];
// [skill, the skill above it that opens it]
const DEMO_LINKS = [[5, 0], [6, 1], [7, 2], [8, 3], [9, 4], [10, 6], [10, 8], [11, 5], [11, 10], [12, 9], [12, 10],
  [13, 11], [14, 12], [15, 13], [15, 14], [16, 15], [17, 15], [18, 16], [18, 17]];
const DEMO_SELECTED = 2;
const DEMO_POINTS = 10;

// Slot groups 1-4 (left top, right top, left bottom, right bottom). Bonus values are placeholders.
const DEMO_GROUPS = [
  { mutagen: "red", bonus: "+15%", sockets: [{ color: "red", rank: 1 }, { color: "red", rank: 2, selected: true }, { color: "blue", rank: 3 }] },
  { mutagen: "blue", bonus: "+20%", sockets: [{ color: "blue", rank: 3 }, { color: "blue", rank: 2 }, { color: "blue", rank: 1 }] },
  { mutagen: "green", bonus: "+5%", sockets: [null, null, { color: "green", rank: 1 }] },
  { mutagen: "", locked: true, sockets: [null, null, null] }
];

// Key legend, left to right.
const LEGEND = [
  { key: "R", label: "Reset abilities" },
  { mouse: "left", key: "E", label: "Acquire ability", prefix: "[Hold]" }
];

// Game text styles: CSS token (styles.css), size, weight, sample, where the game uses it.
const TYPE = [
  ["--game-text", 34, 700, "SIGNS", "Tree title"],
  ["--game-points", 32, 400, "POINTS AVAILABLE", "Points label"],
  ["--game-count", 21, 400, "2/22", "Tab count"],
  ["--game-text", 24, 400, "DELUSION", "Tooltip skill name"],
  ["--game-level", 25, 400, "LEVEL", "Tooltip level"],
  ["--game-next", 23, 400, "Next level: Target does not notice the casting.", "Tooltip next level"],
  ["--game-req", 23, 400, "Required points spent: 8", "Tooltip requirement"],
  ["--game-key", 28, 400, "R", "Key letter"],
  ["--game-label", 22, 400, "Reset abilities", "Key legend label"],
  ["--game-hold", 22, 400, "[Hold]", "Hold prefix"]
];

const SKILL_SAMPLES = 10;
const titleCase = s => s.replace(/(^|-)(\w)/g, (_, d, c) => (d ? " " : "") + c.toUpperCase());

export function mountAssetDemo(app) {
  const { catalog } = app;
  const el = $("pageDemo");
  // tab: the open game tab; tree: the last planner tree, used where Mutations has no art.
  const view = { tab: "signs", tree: "signs", region: DEFAULT_REGION };
  let status = "idle", art = null, pieces = null, panels = null;

  el.addEventListener("click", e => {
    const b = e.target.closest("[data-demo-tab]"); if (!b) return;
    view.tab = b.dataset.demoTab;
    if (TREE_ART[view.tab]) view.tree = view.tab;
    update();
  });
  el.addEventListener("change", e => {
    if (e.target.id !== "demoRegion") return;
    view.region = e.target.value; update();
  });

  // Loads the art the first time the page is shown; after that nothing depends on the build.
  function render() {
    if (el.hidden || status !== "idle") return;
    status = "loading";
    el.innerHTML = `<section class="card"><p class="meta">Loading game art…</p></section>`;
    loadArt().then(a => {
      art = a; pieces = createPieces(a); panels = createPanels(a, pieces); status = "ready"; draw();
    }).catch(err => {
      status = "idle";
      el.innerHTML = `<section class="card"><p class="bad-msg">Could not load the game art: ${esc(err.message)}</p></section>`;
    });
  }

  // Icons for skills of a game colour, in skills.json order.
  function iconsFor(color) {
    const t = Object.keys(TREE_ART).find(k => TREE_ART[k].color === color);
    return art.skillIcons(TREE_ART[t].skills);
  }

  // ---- Character screen (1920x1080, screen.json coordinates) ----

  function screen() {
    const name = view.tab === "mutations" ? "Mutations" : catalog.trees[view.tab].name;
    return `<svg class="gscreen" viewBox="0 0 ${SCREEN.w} ${SCREEN.h}" role="img" aria-label="Character screen preview, ${esc(name)} tab">
      ${pieces.backdrop(view.region)}
      ${treePanel(name)}
      ${panels.pointsRow(panels.pointsValue(DEMO_POINTS), { n: DEMO_POINTS })}
      ${panels.mutagenPanel({ groups: demoGroups(), bonusSockets: true })}
      <foreignObject x="0" y="996" width="${SCREEN.w}" height="56">${panels.legend(LEGEND)}</foreignObject>
    </svg>`;
  }

  function treePanel(name) {
    const tree = TREE_ART[view.tab];
    const spent = DEMO_NODES.reduce((n, d) => n + (d.rank || 0), 0);
    const tabs = GAME_TABS.map(t => {
      const open = t === view.tab;
      return { id: t, open, count: open && tree ? spent : 0, attrs: ` data-demo-tab="${t}"` };
    });
    return panels.treePanel({ bg: view.tab, title: name, tabs, grid: tree && demoGrid(tree) });
  }

  // The made-up tree as a grid view: node states follow the planner's rule (a root, or linked
  // from a learned skill), lines are lit between learned skills and white from a learned one.
  function demoGrid({ color, skills }) {
    const icons = art.skillIcons(skills);
    const from = DEMO_NODES.map(() => []);
    DEMO_LINKS.forEach(([to, req]) => from[to].push(req));
    const learned = i => (DEMO_NODES[i].rank || 0) > 0;
    const state = i => learned(i) ? "learned" : DEMO_NODES[i].row === 0 || from[i].some(learned) ? "open" : "locked";
    const nodes = DEMO_NODES.map((d, i) => ({
      col: d.col, row: d.row, icon: icons[i % icons.length], state: state(i), rank: d.rank, selected: i === DEMO_SELECTED
    }));
    const links = DEMO_LINKS.map(([b, a]) => ({
      a, b, state: learned(a) && learned(b) ? "lit" : learned(a) ? "open" : "closed"
    }));
    return { color, nodes, links };
  }

  // DEMO_GROUPS with an icon per equipped socket; no two sockets show the same skill.
  function demoGroups() {
    const used = {};
    const nextIcon = color => iconsFor(color)[used[color] = (used[color] || 0) + 1];
    return DEMO_GROUPS.map(g => ({
      ...g, sockets: g.sockets.map(s => s ? { ...s, icon: nextIcon(s.color) } : {})
    }));
  }

  // ---- Single pieces, at their own size ----

  // One piece in a small SVG. `pad` is room around a 64px socket for frames that stick out.
  const tile = (inner, label, pad = 16) =>
    `<figure class="gtile"><svg viewBox="${-pad} ${-pad} ${SOCKET + 2 * pad} ${SOCKET + 2 * pad}" width="${SOCKET + 2 * pad}" height="${SOCKET + 2 * pad}" aria-hidden="true">${inner}</svg><figcaption>${label}</figcaption></figure>`;

  // The diamond turned like gr1_mutagen, centred on the tile. The turned frame is wider than a
  // socket, so the padding comes from the frame's corners under that matrix.
  function diamondTile(o, label) {
    const [a, b, c, d] = art.layout("mutagen-slots").gr1_mutagen.matrix;
    const h = SOCKET / 2;
    const m = [a, b, c, d, h - (a + c) * h, h - (b + d) * h];
    const FRAME = "mutagens/diamond-frame.svg";
    const [w, fh] = art.size(FRAME), [ox, oy] = art.origin(FRAME);
    // How far each turned corner lands outside the 0..SOCKET square.
    const overflow = [[-ox, -oy], [w - ox, -oy], [-ox, fh - oy], [w - ox, fh - oy]].flatMap(([x, y]) => {
      const tx = a * x + c * y + m[4], ty = b * x + d * y + m[5];
      return [-tx, tx - SOCKET, -ty, ty - SOCKET];
    });
    return tile(`<g transform="${matrix(m)}">${pieces.diamond(o)}</g>`, label, Math.ceil(Math.max(...overflow)) + 2);
  }

  function states() {
    const { color, skills } = TREE_ART[view.tree];
    const [icon, icon2] = art.skillIcons(skills);
    const [core] = art.skillIcons(skills, true);
    const node = (o, label) => tile(pieces.treeNode({ icon, color, ...o }), label);
    return `<h3 class="subhead">Tree nodes</h3>
      <div class="gtiles">
        ${node({ state: "locked" }, "Locked")}
        ${node({ state: "open" }, "Available")}
        ${node({ state: "learned", rank: 1 }, "Learned 1/3")}
        ${node({ state: "learned", rank: 3 }, "Learned 3/3")}
        ${node({ state: "learned", rank: 2, selected: true }, "Selected")}
        ${core ? tile(pieces.treeNode({ icon: core, color, state: "learned", rank: 1, core: true }), "Core skill") : ""}
      </div>
      <h3 class="subhead">Slot sockets</h3>
      <div class="gtiles">
        ${tile(pieces.socket({ locked: true }), "Locked")}
        ${tile(pieces.socket({}), "Empty")}
        ${tile(pieces.socket({ icon: icon2, color, rank: 2 }), "Equipped")}
        ${tile(pieces.socket({ icon: icon2, color, rank: 2, allowed: color }), "Colour-restricted")}
        ${tile(pieces.socket({ icon: icon2, color, rank: 2, selected: true }), "Selected")}
      </div>`;
  }

  function tooltip() {
    const skill = catalog.skillsIn(view.tree)[0];
    return panels.tooltip({
      name: skill.name, level: "1/3", req: "Required points spent: 8",
      current: [skill.text], next: ["Rank 2 values aren't published yet."]
    });
  }

  function mutagens() {
    const colors = Object.keys(MUTAGEN_ART).filter(Boolean);
    // A left-side label in its own SVG: group 1's bar and texts, cropped to the bar.
    const [, , , , bx, by] = art.layout("mutagen-panel").groupBonusBkg1_1.matrix;
    const label = c => `<svg class="gbonus" viewBox="${bx - 4} ${by} 284 72" aria-label="${MUTAGEN_ART[c].stat} bonus">${panels.bonusLabel(1, c, "+15%")}</svg>`;
    return `<h3 class="subhead">Diamonds</h3>
      <div class="gtiles">
        ${colors.map(c => diamondTile({ color: c }, titleCase(c))).join("")}
        ${diamondTile({}, "No mutagen")}
        ${diamondTile({ locked: true }, "Locked")}
      </div>
      <h3 class="subhead">Mutagen items <span class="meta">lesser, normal, greater</span></h3>
      <div class="gtiles">${colors.map(c => ["lesser", "normal", "greater"].map(s =>
        `<img src="${artUrl(`mutagens/item-${c}-${s}.png`)}" alt="${c} ${s} mutagen" title="${c} ${s}" width="64" height="64">`).join("")).join("")}</div>
      <h3 class="subhead">Bonus labels</h3>
      <div class="gbonuses">${colors.map(label).join("")}</div>`;
  }

  function skillIcons() {
    return catalog.order.map(t => {
      const { skills } = TREE_ART[t];
      const all = art.skillIcons(skills, true).concat(art.skillIcons(skills));
      return `<div class="giconrow"><span class="treetag" style="--tc:${catalog.trees[t].color}">${esc(catalog.trees[t].name)} <span class="meta">${all.length}</span></span>
        <div class="gicons">${all.slice(0, SKILL_SAMPLES).map(f =>
          `<img src="${artUrl(f)}" alt="" title="${esc(f.split("/").pop().replace(".png", ""))}" width="48" height="48" loading="lazy">`).join("")}</div></div>`;
    }).join("");
  }

  function type() {
    return `<div class="gtype">${TYPE.map(([token, size, weight, sample, use]) =>
      `<div class="gtype-row"><span class="gtype-sample" style="color:var(${token});font-size:${size}px;font-weight:${weight}">${esc(sample)}</span>
        <span class="meta">${esc(use)} · ${size}px${weight === 700 ? " bold" : ""} · <code>${token}</code></span></div>`).join("")}</div>`;
  }

  function regionOptions() {
    return art.files("backdrop/panorama-").map(f => {
      const id = f.replace("backdrop/panorama-", "").replace(/\.\w+$/, "");
      return `<option value="${id}"${id === view.region ? " selected" : ""}>${titleCase(id)}</option>`;
    }).join("");
  }

  function draw() {
    el.innerHTML = `
      <section class="card">
        <h2>Asset demo</h2>
        <p class="meta" style="margin:0">The art extracted from the game, put together the way the game draws the Character screen. It shows a made-up build, not yours, and the planner doesn't use this art yet. Positions come from the game's layout data; a few details (node states, fog, dividers) are matched by eye to in-game screenshots.</p>
      </section>
      <section class="card">
        <h2>Character screen</h2>
        <div class="gcontrols">
          <div class="chips" id="demoTabs"></div>
          <label class="field gregion" for="demoRegion">Backdrop <select id="demoRegion">${regionOptions()}</select></label>
        </div>
        <div class="gscreenwrap" id="demoScreen"></div>
        <p class="meta" style="margin:0">Click a tab in the picture or above to switch trees. Hover a tab for its hover art.</p>
      </section>
      <div class="gpair">
        <section class="card"><h2>Skill states</h2><div id="demoStates"></div></section>
        <section class="card"><h2>Tooltip</h2><div id="demoTooltip"></div></section>
      </div>
      <section class="card"><h2>Mutagens and bonuses</h2>${mutagens()}</section>
      <section class="card"><h2>Key legend</h2><div class="glegend-wrap">${panels.legend(LEGEND)}</div></section>
      <section class="card"><h2>Skill icons</h2><p class="meta" style="margin:0">The first ${SKILL_SAMPLES} of each tree, core skills first. Hover for the game id.</p>${skillIcons()}</section>
      <section class="card"><h2>Type</h2><p class="meta" style="margin:0">D-DIN Condensed (SIL OFL) stands in for the game's PF DIN Text Cond Pro. Sizes and colours are the game's.</p>${type()}</section>`;
    update();
  }

  // Redraws the parts that follow the chosen tab and backdrop.
  function update() {
    if (status !== "ready") return;
    $("demoTabs").innerHTML = GAME_TABS.map(t => {
      const name = t === "mutations" ? "Mutations" : catalog.trees[t].name;
      return `<button class="chip" type="button" data-demo-tab="${t}" aria-pressed="${t === view.tab}">${esc(name)}</button>`;
    }).join("");
    $("demoScreen").innerHTML = screen();
    $("demoStates").innerHTML = states();
    $("demoTooltip").innerHTML = tooltip();
  }

  return { render };
}
