// Asset demo page: the extracted game art put together the way the game draws the Character
// screen, as a preview of where the planner's look is heading. Shows a made-up build, not yours.
// The art loads the first time the page is opened.
import { $, esc } from "./dom.js";
import { artUrl, gridPos, doubleLine, lineEnds, loadArt, GAME_TABS, LINE_COLORS, MUTAGEN_ART, SOCKET, TREE_ART } from "./gameArt.js";
import { createPieces, matrix, placed } from "./gamePieces.js";

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
  { mouse: "middle", label: "Description size" },
  { key: "E", label: "Acquire ability", hold: true }
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
  const view = { tab: "signs", tree: "signs", region: "velen" };
  let status = "idle", art = null, pieces = null;

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
      art = a; pieces = createPieces(a); status = "ready"; draw();
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
    const S = art.layout("screen");
    const name = view.tab === "mutations" ? "Mutations" : catalog.trees[view.tab].name;
    return `<svg class="gscreen" viewBox="0 0 1920 1080" role="img" aria-label="Character screen preview, ${esc(name)} tab">
      ${backdrop(S)}
      ${placed(S.mcDupeTabModule, treePanel(name))}
      ${pointsRow(S)}
      ${placed(S.moduleSkillSlot, mutagenPanel())}
      <foreignObject x="0" y="996" width="1920" height="56">${legend()}</foreignObject>
    </svg>`;
  }

  // #040404, the region panorama at 22%, two fog layers, the DNA image. Fog placement is unverified.
  function backdrop(S) {
    return `<rect width="1920" height="1080" fill="#040404"/>
      ${pieces.img(`backdrop/panorama-${view.region}.jpg`, -23, -2, 1, ` opacity="0.22"`)}
      ${pieces.box("backdrop/fog.png", 0, 0, 1500, 778, ` opacity="0.7"`)}
      ${pieces.box("backdrop/fog.png", 420, 302, 1500, 778, ` opacity="0.6"`)}
      ${placed(S.mcBackgroundImage, pieces.img("backdrop/dna.png", 0, 0))}`;
  }

  function treePanel(name) {
    const P = art.layout("tree-panel");
    const tree = TREE_ART[view.tab];
    const spent = DEMO_NODES.reduce((n, d) => n + (d.rank || 0), 0);
    const tabs = GAME_TABS.map((t, i) =>
      `<g class="gtab" data-demo-tab="${t}" transform="${matrix(P[`mcTabListItem${i + 1}`].matrix)}">${pieces.tab(t, t === view.tab, t === view.tab && tree ? spent : 0)}</g>`
    ).join("");
    return placed(P.mcNewTabBackground, pieces.img(`tree/bg-${view.tab}.png`, 0, 0) + pieces.img("tree/frame.png", 0, 0))
      + tabs
      + pieces.text(P.txtTitle, name.toUpperCase(), ` font-weight="700"`)
      + (tree ? placed(P.mcSkillModule, skillGrid(tree)) : "");
  }

  function skillGrid({ color, skills }) {
    const icons = art.skillIcons(skills);
    const nb = DEMO_NODES.map(() => []);
    DEMO_LINKS.forEach(([a, b]) => { nb[a].push(b); nb[b].push(a); });
    const learned = i => (DEMO_NODES[i].rank || 0) > 0;
    const state = i => learned(i) ? "learned" : DEMO_NODES[i].row === 0 || nb[i].some(learned) ? "open" : "locked";
    const pos = DEMO_NODES.map(d => gridPos(d.col, d.row));

    const lines = DEMO_LINKS.map(([m, d]) => {
      const lit = learned(m) && learned(d);
      const stroke = lit ? LINE_COLORS[color] : state(d) === "locked" ? LINE_COLORS.closed : LINE_COLORS.open;
      const [a, b] = lineEnds(pos[m], pos[d]);
      return doubleLine(a, b).map(([p, q]) =>
        `<line class="gline${lit ? " lit" : ""}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${stroke}"/>`).join("");
    }).join("");
    const nodes = DEMO_NODES.map((d, i) =>
      `<g transform="translate(${pos[i].x} ${pos[i].y})">${pieces.treeNode({ icon: icons[i % icons.length], color, state: state(i), rank: d.rank, selected: i === DEMO_SELECTED })}</g>`
    ).join("");
    return lines + nodes;
  }

  function pointsRow(S) {
    return placed(S.mcPointsBorder, pieces.img("tree/separator.png", 0, 0, 0.5))
      + pieces.text(S.txfAvailablePoints, "POINTS AVAILABLE")
      + pieces.text(S.txfPointsValue, String(DEMO_POINTS))
      + placed(S.mcPointIcon, pieces.imgAt("points/diamond.png", 0, 0, 0.5));
  }

  // Groups with their connectors, diamonds and bonus labels, in mutagen-panel.json coordinates.
  function mutagenPanel() {
    const M = art.layout("mutagen-panel"), G = art.layout("mutagen-slots");
    let wires = "", parts = "", labels = "";
    // Next icon per colour, so no two sockets show the same skill.
    const used = {};
    const nextIcon = color => iconsFor(color)[used[color] = (used[color] || 0) + 1];
    DEMO_GROUPS.forEach((g, gi) => {
      const n = gi + 1;
      const match = g.sockets.map(s => !g.locked && !!s && s.color === g.mutagen);
      wires += placed(G[`groupConnector${n}`], pieces.connector("line", match.some(Boolean) && g.mutagen));
      g.sockets.forEach((s, si) => {
        wires += placed(G[`connector_g${n}_s${si + 1}`], pieces.connector(si === 1 ? "line" : "corner", match[si] && g.mutagen));
        const icon = s ? nextIcon(s.color) : undefined;
        parts += placed(G[`gr${n}_socket${si + 1}`], pieces.socket({ ...s, icon, locked: g.locked, match: match[si] }));
      });
      parts += placed(G[`gr${n}_mutagen`], pieces.diamond({ color: g.mutagen, locked: g.locked }));
      if (g.mutagen) labels += bonusLabel(M, n, g.mutagen, g.bonus);
    });
    for (let i = 1; i <= 4; i++) parts += placed(G[`bonusSocket${i}`], pieces.socket({ locked: true }));
    return labels + placed(M.mcSlotsNormal, ornament(G) + wires + parts);
  }

  // mc_bonus_bkg_new: bar at alpha 0.8 with the stat glyph on a shield; right-side labels are mirrored.
  function bonusLabel(M, n, color, value) {
    const { glyph, stat } = MUTAGEN_ART[color];
    const bkg = pieces.box(`bonus/bar-${color}.png`, -4, 4, 280, 64, ` opacity="0.8"`)
      + pieces.img("bonus/shield.png", 5, 8) + pieces.img(`bonus/glyph-${glyph}.png`, 5.5, 5);
    return placed(M[`groupBonusBkg${n}_1`], bkg)
      + pieces.text(M[`txtBonus${n}_1`], stat) + pieces.text(M[`txtBonus${n}_1p`], value);
  }

  // Centre ornament between the groups, with four divider lines placed by eye.
  function ornament(G) {
    const top = G.gr1_socket3.matrix, right = G.gr2_socket3.matrix, bottom = G.gr3_socket1.matrix;
    const cx = (top[4] + SOCKET + right[4]) / 2, cy = (top[5] + SOCKET + bottom[5]) / 2;
    const line = (dx, dy, rot) => `<g transform="translate(${cx + dx} ${cy + dy}) rotate(${rot})">${pieces.piece("slots/divider.svg")}</g>`;
    return line(0, -150, 0) + line(0, 150, 0) + line(-150, 0, 90) + line(150, 0, 90)
      + pieces.imgAt("slots/divider-ornament.png", cx, cy, 0.5);
  }

  function legend() {
    return `<div class="glegend">${LEGEND.map(b => {
      const [w, h] = b.mouse ? art.size(`legend/mouse-${b.mouse}.png`) : [];
      const cap = b.key ? `<span class="gkey">${esc(b.key)}</span>`
        : `<img src="${artUrl(`legend/mouse-${b.mouse}.png`)}" alt="" width="${w}" height="${h}">`;
      return `<span class="gbtn">${cap}<span class="glabel">${b.hold ? `<span class="ghold">[Hold]</span> ` : ""}${esc(b.label)}</span></span>`;
    }).join("")}</div>`;
  }

  // ---- Single pieces, at their own size ----

  // One piece in a small SVG. `pad` is room around a 64px socket for frames that stick out.
  const tile = (inner, label, pad = 16) =>
    `<figure class="gtile"><svg viewBox="${-pad} ${-pad} ${SOCKET + 2 * pad} ${SOCKET + 2 * pad}" width="${SOCKET + 2 * pad}" height="${SOCKET + 2 * pad}" aria-hidden="true">${inner}</svg><figcaption>${label}</figcaption></figure>`;

  // The diamond turned like gr1_mutagen, centred on the tile.
  function diamondTile(o, label) {
    const [a, b, c, d] = art.layout("mutagen-slots").gr1_mutagen.matrix;
    const h = SOCKET / 2;
    const m = [a, b, c, d, h - (a + c) * h, h - (b + d) * h];
    return tile(`<g transform="${matrix(m)}">${pieces.diamond(o)}</g>`, label);
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
        ${tile(pieces.socket({ icon: icon2, color, rank: 2, match: true }), "Mutagen match")}
        ${tile(pieces.socket({ icon: icon2, color, rank: 2, selected: true }), "Selected")}
      </div>`;
  }

  function tooltip() {
    const T = catalog.trees[view.tree];
    const skill = catalog.skillsIn(view.tree)[0];
    return `<div class="gtip">
      <div class="gtip-head">
        <img src="${artUrl("tooltip/header.png")}" alt="">
        <img src="${artUrl("tooltip/header-frame.png")}" alt="">
        <span class="gtip-name">${esc(skill.name.toUpperCase())}</span>
        <span class="gtip-type">${esc(T.name)}</span>
        <span class="gtip-level">LEVEL <b>1/3</b></span>
        <span class="gtip-req">Required points spent: 8</span>
      </div>
      <p class="gtip-cur">${esc(skill.text)}</p>
      <p class="gtip-next">Next level: rank 2 values aren't published yet.</p>
    </div>`;
  }

  function mutagens() {
    const colors = Object.keys(MUTAGEN_ART).filter(Boolean);
    const M = art.layout("mutagen-panel");
    // A left-side label in its own SVG: group 1's bar and texts, cropped to the bar.
    const [, , , , bx, by] = M.groupBonusBkg1_1.matrix;
    const label = c => `<svg class="gbonus" viewBox="${bx - 4} ${by} 284 72" aria-label="${MUTAGEN_ART[c].stat} bonus">${bonusLabel(M, 1, c, "+15%")}</svg>`;
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
        <p class="meta" style="margin:0">The art extracted from the game, put together the way the game draws the Character screen. It shows a made-up build, not yours, and the planner doesn't use this art yet. Positions come from the game's layout data; a few details (node states, pips, fog, dividers) are matched by eye to in-game screenshots.</p>
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
      <section class="card"><h2>Key legend</h2><div class="glegend-wrap">${legend()}</div></section>
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
