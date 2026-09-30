(function () {
  // Game data lives in data/*.js (loaded before this file by index.html).
  const DATA = window.W3R_DATA;
  const RULES = DATA.rules;
  const TREES = DATA.trees;
  const ORDER = RULES.treeOrder;
  const ARCH = DATA.archetypes;
  const MUT = RULES.mutagens;
  const MAX_RANK = RULES.maxRank;
  const GROUPS = RULES.slotGroups, PER_GROUP = RULES.slotsPerGroup, SLOTS = GROUPS * PER_GROUP;
  const W = 96, H = 72, PAD = 14;

  // Flatten every tree's skills into one lookup and wire neighbours from the links.
  const NODES = {};
  const EDGES = [];
  ORDER.forEach(t => {
    if (!TREES[t]) { console.error(`Tree "${t}" is listed in rules.treeOrder but data/trees/${t}.js didn't load.`); return; }
    TREES[t].skills.forEach(s => {
      if (NODES[s.id]) console.error(`Duplicate skill id "${s.id}" in ${t} (already used in ${NODES[s.id].tree}).`);
      NODES[s.id] = Object.assign({ root: false, verified: false, note: "" }, s, { tree: t, nb: [] });
    });
  });
  ORDER.forEach(t => (TREES[t] ? TREES[t].links : []).forEach(link => {
    const [a, b] = link.split("-");
    if (!NODES[a] || !NODES[b]) { console.error(`Link "${link}" in ${t} points to an unknown skill.`); return; }
    if (NODES[a].tree !== t || NODES[b].tree !== t) { console.error(`Link "${link}" in ${t} crosses into another tree.`); return; }
    EDGES.push([a, b]);
    NODES[a].nb.push(b); NODES[b].nb.push(a);
  }));
  ARCH.forEach(a => a.ids.forEach(id => { if (!NODES[id]) console.error(`Archetype "${a.id}" lists unknown skill "${id}".`); }));

  const STORE = "w3r-skill-planner-v1";

  function defaults() {
    return { pts: {}, budget: 4, tab: ORDER[0], sel: null, slots: Array(SLOTS).fill(null), mut: ["green"].concat(Array(GROUPS - 1).fill("")), arch: [], name: "", loadedId: null, savedSnap: null };
  }
  let S = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && saved.pts) S = Object.assign(defaults(), saved);
  } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }

  const $ = id => document.getElementById(id);
  const pts = id => S.pts[id] || 0;
  const available = id => NODES[id].root || NODES[id].nb.some(n => pts(n) > 0);
  const spentIn = t => Object.keys(S.pts).reduce((s, id) => s + (NODES[id] && NODES[id].tree === t ? S.pts[id] : 0), 0);
  const spentAll = () => ORDER.reduce((s, t) => s + spentIn(t), 0);
  let lastMsg = "";

  function orphansIfRemoved(id) {
    const t = NODES[id].tree;
    const inv = Object.keys(S.pts).filter(k => k !== id && pts(k) > 0 && NODES[k].tree === t);
    const set = new Set(inv), seen = new Set();
    const queue = inv.filter(k => NODES[k].root);
    queue.forEach(k => seen.add(k));
    while (queue.length) {
      const k = queue.shift();
      NODES[k].nb.forEach(n => { if (set.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); } });
    }
    return inv.filter(k => !seen.has(k));
  }

  function add(id) {
    lastMsg = "";
    if (pts(id) >= MAX_RANK) { lastMsg = NODES[id].name + " is already at rank " + MAX_RANK + "."; return false; }
    if (!available(id)) { lastMsg = "Locked. Put a point in a connected skill first: " + NODES[id].nb.map(n => NODES[n].name).join(", ") + "."; return false; }
    S.pts[id] = pts(id) + 1; return true;
  }
  function remove(id) {
    lastMsg = "";
    if (pts(id) === 0) return false;
    if (pts(id) === 1) {
      const o = orphansIfRemoved(id);
      if (o.length) { lastMsg = "Can't remove the last point: " + o.map(k => NODES[k].name).join(", ") + " would lose its connection. Remove those first."; return false; }
      delete S.pts[id];
      S.slots = S.slots.map(s => s === id ? null : s);
      return true;
    }
    S.pts[id] = pts(id) - 1; return true;
  }
  function toggleSlot(id) {
    const at = S.slots.indexOf(id);
    if (at >= 0) { S.slots[at] = null; return; }
    if (pts(id) === 0) { lastMsg = "Put at least one point in a skill before slotting it."; return; }
    const free = S.slots.indexOf(null);
    if (free < 0) { lastMsg = "All " + SLOTS + " slots are full. Clear one first."; return; }
    S.slots[free] = id;
  }

  function wrap(name) {
    const words = name.split(" "), lines = [];
    let cur = "";
    words.forEach(w => {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= 12) cur += " " + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- render ----------
  function renderSummary() {
    const spent = spentAll();
    $("spent").textContent = spent;
    const left = S.budget - spent;
    $("left").textContent = left;
    $("left").classList.toggle("over", left < 0);
    $("passives").innerHTML = ORDER.map(t => {
      const p = TREES[t].passive, n = spentIn(t);
      const v = Math.round(n * p.per * 10) / 10;
      return `<span style="--tc:${TREES[t].color}">${p.label} <b class="num">+${v}${p.unit}</b></span>`;
    }).join("");
  }

  function renderTabs() {
    $("tabs").innerHTML = ORDER.map(t => `<button class="tab" role="tab" type="button" data-tab="${t}" aria-selected="${S.tab === t}" style="--tc:${TREES[t].color}">${TREES[t].name}<span class="n num">${spentIn(t)}</span></button>`).join("");
  }

  function hlSet() {
    const s = new Set();
    S.arch.forEach(a => { const A = ARCH.find(x => x.id === a); if (A) A.ids.forEach(i => s.add(i)); });
    return s;
  }

  function renderTree() {
    const T = TREES[S.tab];
    const nodes = Object.values(NODES).filter(n => n.tree === S.tab);
    const { colW, rowH } = T.layout;
    const maxC = Math.max(...nodes.map(n => n.col)), maxR = Math.max(...nodes.map(n => n.row));
    const vw = PAD * 2 + maxC * colW + W, vh = PAD * 2 + maxR * rowH + H;
    const cx = n => PAD + n.col * colW + W / 2, cy = n => PAD + n.row * rowH + H / 2;
    const hl = hlSet();
    let out = `<svg viewBox="0 0 ${vw} ${vh}" role="group" aria-label="${T.name} skill tree" style="--tc:${T.color};--tcd:${T.dark}">`;
    EDGES.forEach(([a, b]) => {
      const A = NODES[a], B = NODES[b];
      if (A.tree !== S.tab) return;
      const pa = pts(a) > 0, pb = pts(b) > 0;
      const cls = pa && pb ? "lit" : (pa || pb ? "open" : "");
      out += `<line class="edge ${cls}" x1="${cx(A)}" y1="${cy(A)}" x2="${cx(B)}" y2="${cy(B)}"/>`;
    });
    nodes.forEach(n => {
      const x = PAD + n.col * colW, y = PAD + n.row * rowH, p = pts(n.id);
      const cls = ["node", p > 0 ? "inv" : (available(n.id) ? "avail" : "locked"),
        S.sel === n.id ? "selected" : "", hl.has(n.id) ? "hlon" : "", S.slots.includes(n.id) ? "slotted" : ""].join(" ");
      const lines = wrap(n.name);
      const ty = y + 30 - (lines.length - 1) * 7;
      out += `<g class="${cls}" data-id="${n.id}" tabindex="0" role="button" aria-label="${n.name}, rank ${p} of ${MAX_RANK}${available(n.id) ? "" : ", locked"}">`;
      out += `<rect class="hl" x="${x - 5}" y="${y - 5}" width="${W + 10}" height="${H + 10}"/>`;
      out += `<rect class="box" x="${x}" y="${y}" width="${W}" height="${H}"/>`;
      out += `<rect class="sel" x="${x - 1.5}" y="${y - 1.5}" width="${W + 3}" height="${H + 3}"/>`;
      out += `<text x="${x + W / 2}" y="${ty}" text-anchor="middle">` + lines.map((l, i) => `<tspan x="${x + W / 2}" dy="${i ? 14 : 0}">${l}</tspan>`).join("") + `</text>`;
      const pip0 = x + W / 2 - (MAX_RANK * 13 - 5) / 2;
      for (let i = 0; i < MAX_RANK; i++) out += `<rect class="pip${i < p ? " on" : ""}" x="${pip0 + i * 13}" y="${y + H - 11}" width="8" height="5"/>`;
      out += `<rect class="slotmark" x="${x + W - 11}" y="${y + 4}" width="7" height="7" transform="rotate(45 ${x + W - 7.5} ${y + 7.5})"/>`;
      out += `</g>`;
    });
    out += `</svg>`;
    $("treewrap").innerHTML = out;
  }

  function renderDetail() {
    const n = NODES[S.sel];
    const el = $("detail");
    if (!n) { el.innerHTML = `<p class="meta">Select a skill in the tree.</p>`; return; }
    const T = TREES[n.tree], p = pts(n.id), slotted = S.slots.includes(n.id);
    const avail = available(n.id);
    el.style.setProperty("--tc", T.color);
    el.innerHTML = `
      <div class="detail-head">
        <div><div class="treetag">${T.name}${n.root ? " · starting skill" : ""}</div><h3>${n.name}</h3></div>
        <div class="rank num">${p}<small>/${MAX_RANK}</small></div>
      </div>
      <div class="stepper">
        <button class="btn" type="button" data-act="minus" ${p === 0 ? "disabled" : ""} aria-label="Remove a point">−</button>
        <button class="btn primary" type="button" data-act="plus" ${p >= MAX_RANK || !avail ? "disabled" : ""} aria-label="Add a point">+</button>
        <button class="btn" type="button" data-act="slot" ${p === 0 && !slotted ? "disabled" : ""}>${slotted ? "Unslot" : "Slot it"}</button>
      </div>
      <div class="msg">${lastMsg}</div>
      <p class="effect">${n.text}</p>
      <div class="meta">
        <span>Rank 1 text. Ranks 2 and 3 show in-game once you invest.</span>
        <span>${n.verified ? `<span class="badge ok">Checked in-game</span>` : `<span class="badge src">From Hack the Minotaur</span>`}</span>
        <span>Each point here: ${T.passive.label.toLowerCase()} +${T.passive.per}${T.passive.unit}${T.mutagen ? ` · matches ${T.mutagen} mutagens` : " · matches no mutagen"}</span>
      </div>
      ${n.note ? `<div class="note">${n.note}</div>` : ""}
      <div class="meta">${avail ? (n.root ? "Always open." : "Open.") : "Locked. Opens from any of:"}</div>
      <div class="links">${n.nb.map(k => `<button type="button" data-go="${k}" class="${pts(k) > 0 ? "inv" : ""}">${NODES[k].name}${pts(k) ? " (" + pts(k) + ")" : ""}</button>`).join("<span aria-hidden='true'>·</span>")}</div>`;
  }

  function renderSlots() {
    const sel = NODES[S.sel];
    const canPlace = sel && pts(sel.id) > 0 && !S.slots.includes(sel.id);
    let html = "";
    for (let g = 0; g < GROUPS; g++) {
      const mut = S.mut[g];
      let match = 0;
      let cells = "";
      for (let i = 0; i < PER_GROUP; i++) {
        const idx = g * PER_GROUP + i, id = S.slots[idx];
        if (id) {
          const n = NODES[id], T = TREES[n.tree];
          if (mut && T.mutagen === mut) match++;
          cells += `<div class="slot full" style="--tc:${T.color}"><button type="button" class="nm" data-go="${id}" style="background:none;border:0;padding:0;text-align:left">${n.name} <span class="num" style="color:var(--muted)">${pts(id)}/${MAX_RANK}</span></button><button type="button" class="x" data-clear="${idx}" aria-label="Clear slot">×</button></div>`;
        } else {
          cells += `<button type="button" class="slot empty${canPlace ? " target" : ""}" data-place="${idx}">${canPlace ? "Place " + sel.name : "Empty slot"}</button>`;
        }
      }
      const mult = mut ? `Mutagen bonus <b class="num">×${1 + match}</b>` : `No mutagen`;
      html += `<div class="group">
        <div class="group-head"><span>Group ${g + 1}</span>
          <select data-mut="${g}" aria-label="Mutagen for group ${g + 1}">${Object.keys(MUT).map(k => `<option value="${k}" ${k === mut ? "selected" : ""}>${MUT[k]}</option>`).join("")}</select></div>
        ${cells}
        <div class="mult">${mult}</div></div>`;
    }
    $("groups").innerHTML = html;
    const un = Object.keys(S.pts).filter(id => pts(id) > 0 && !S.slots.includes(id));
    $("unslotted").innerHTML = un.length ? `Invested but not slotted: ${un.map(id => NODES[id].name).join(", ")}.` : "";
  }

  function renderArch() {
    $("archChips").innerHTML = ARCH.map(a => {
      const inv = a.ids.filter(i => pts(i) > 0).length;
      return `<button type="button" class="chip" data-arch="${a.id}" aria-pressed="${S.arch.includes(a.id)}"><span class="dot" style="background:${TREES[a.tree].color}"></span>${a.name}<span class="cnt num">${inv}/${a.ids.length}</span></button>`;
    }).join("");
  }

  function renderCode() {
    try { $("code").value = "W3R1." + btoa(JSON.stringify(buildData())); } catch (e) {}
  }

  function render() {
    $("budget").value = S.budget;
    renderSummary(); renderTabs(); renderTree(); renderDetail(); renderSlots(); renderArch(); renderCode(); renderBuilds();
    save();
  }

  function focusNode(id) {
    const g = $("treewrap").querySelector(`[data-id="${id}"]`);
    if (g) g.focus({ preventScroll: true });
  }
  function shake(id) {
    const g = $("treewrap").querySelector(`[data-id="${id}"]`);
    if (g) { g.classList.remove("shake"); void g.getBBox(); g.classList.add("shake"); }
  }
  function select(id) { S.sel = id; S.tab = NODES[id].tree; lastMsg = ""; render(); }

  // ---------- events ----------
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    S.tab = b.dataset.tab;
    if (!S.sel || NODES[S.sel].tree !== S.tab) S.sel = Object.values(NODES).find(n => n.tree === S.tab).id;
    lastMsg = ""; render();
  });
  const tw = $("treewrap");
  tw.addEventListener("click", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    // Update the selection in place (no tree redraw) so a double-click lands on the same element.
    S.sel = g.dataset.id; lastMsg = "";
    tw.querySelectorAll(".node.selected").forEach(n => n.classList.remove("selected"));
    g.classList.add("selected");
    renderDetail(); renderSlots(); save();
  });
  tw.addEventListener("dblclick", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    S.sel = g.dataset.id; const ok = add(S.sel); render(); focusNode(S.sel); if (!ok) shake(S.sel);
  });
  tw.addEventListener("contextmenu", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    e.preventDefault(); S.sel = g.dataset.id; const ok = remove(S.sel); render(); focusNode(S.sel); if (!ok && lastMsg) shake(S.sel);
  });
  tw.addEventListener("keydown", e => {
    const g = e.target.closest("[data-id]"); if (!g) return;
    const id = g.dataset.id;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.sel = id; lastMsg = ""; render(); focusNode(id); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); S.sel = id; const ok = add(id); render(); focusNode(id); if (!ok) shake(id); }
    else if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); S.sel = id; const ok = remove(id); render(); focusNode(id); if (!ok && lastMsg) shake(id); }
  });
  $("detail").addEventListener("click", e => {
    const a = e.target.closest("[data-act]"), go = e.target.closest("[data-go]");
    if (a) {
      const id = S.sel;
      if (a.dataset.act === "plus") add(id);
      if (a.dataset.act === "minus") remove(id);
      if (a.dataset.act === "slot") { lastMsg = ""; toggleSlot(id); }
      render();
    } else if (go) select(go.dataset.go);
  });
  $("groups").addEventListener("click", e => {
    const go = e.target.closest("[data-go]"), cl = e.target.closest("[data-clear]"), pl = e.target.closest("[data-place]");
    if (cl) { S.slots[+cl.dataset.clear] = null; render(); }
    else if (go) select(go.dataset.go);
    else if (pl) {
      const n = NODES[S.sel];
      if (n && pts(n.id) > 0 && !S.slots.includes(n.id)) { S.slots[+pl.dataset.place] = n.id; lastMsg = ""; }
      else lastMsg = "Select a skill with at least one point, then click an empty slot.";
      render();
    }
  });
  $("groups").addEventListener("change", e => {
    const s = e.target.closest("[data-mut]"); if (!s) return;
    S.mut[+s.dataset.mut] = s.value; render();
  });
  $("archChips").addEventListener("click", e => {
    const c = e.target.closest("[data-arch]"); if (!c) return;
    const id = c.dataset.arch;
    S.arch = S.arch.includes(id) ? S.arch.filter(x => x !== id) : S.arch.concat(id);
    render();
  });
  $("budget").addEventListener("input", e => {
    const v = parseInt(e.target.value, 10);
    S.budget = isNaN(v) ? 0 : Math.max(0, v);
    renderSummary(); renderCode(); save();
  });
  $("resetTree").addEventListener("click", () => {
    Object.keys(S.pts).forEach(id => { if (NODES[id].tree === S.tab) delete S.pts[id]; });
    S.slots = S.slots.map(s => s && S.pts[s] ? s : null);
    lastMsg = ""; render();
  });
  $("resetAll").addEventListener("click", () => {
    S.pts = {}; S.slots = Array(SLOTS).fill(null); S.arch = []; lastMsg = ""; render();
  });
  $("copy").addEventListener("click", () => {
    const ta = $("code");
    const done = () => { $("codeMsg").textContent = "Copied."; };
    const fallback = () => { ta.focus(); ta.select(); $("codeMsg").textContent = "Selected. Press Ctrl+C to copy."; };
    try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (e) { fallback(); }
  });
  $("load").addEventListener("click", () => {
    const raw = $("code").value.trim();
    try {
      if (!raw.startsWith("W3R1.")) throw 0;
      if (!applyBuild(JSON.parse(atob(raw.slice(5))))) throw 0;
      S.name = ""; S.loadedId = null; S.savedSnap = null;
      lastMsg = ""; render();
      $("codeMsg").textContent = "Build loaded.";
    } catch (e) {
      $("codeMsg").textContent = "That code didn't load. Paste a full code starting with W3R1.";
    }
  });

  // ---------- saved builds (files in the "builds" folder, via server.js) ----------
  const API = "/api/builds";
  const onServer = location.protocol === "http:" || location.protocol === "https:";
  let builds = [];
  let pendingLoad = null, pendingDelete = null;

  function buildData() { return { p: S.pts, s: S.slots, m: S.mut, b: S.budget }; }
  function snap() { return JSON.stringify(buildData()); }
  function isDirty() {
    return S.savedSnap ? snap() !== S.savedSnap : (Object.keys(S.pts).length > 0 || S.slots.some(Boolean));
  }
  // Same rule as slugId() in server.js, so the page knows when Save will overwrite a file.
  function slugId(name) {
    let s = String(name || "").normalize("NFC").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60);
    if (!s) return null;
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = "build-" + s;
    return s.toLowerCase() + ".json";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function applyBuild(d) {
    if (!d || typeof d !== "object" || !d.p || typeof d.p !== "object") return false;
    const p = {};
    Object.keys(d.p).forEach(k => { const v = Math.max(0, Math.min(MAX_RANK, d.p[k] | 0)); if (NODES[k] && v) p[k] = v; });
    S.pts = p;
    S.slots = Array.isArray(d.s) && d.s.length === SLOTS ? d.s.map(x => (x && NODES[x] && p[x]) ? x : null) : Array(SLOTS).fill(null);
    S.mut = Array.isArray(d.m) && d.m.length === GROUPS ? d.m.map(x => MUT[x] !== undefined ? x : "") : Array(GROUPS).fill("");
    if (typeof d.b === "number" && d.b >= 0) S.budget = Math.floor(d.b);
    return true;
  }
  function setSaveMsg(text, kind) {
    const el = $("saveMsg");
    el.textContent = text || "";
    el.className = "meta" + (kind === "bad" ? " bad-msg" : kind === "ok" ? " ok-msg" : "");
  }
  function when(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "The server answered " + res.status + ".");
    return data;
  }
  const OFFLINE = "Can't reach the planner server. Check that the Wild Hunt Skill Planner window is still open, then refresh.";

  function renderBuilds() {
    const nameEl = $("buildName");
    if (document.activeElement !== nameEl) nameEl.value = S.name || "";
    const id = slugId(nameEl.value);
    const exists = !!id && builds.some(b => b.id === id);
    const btn = $("saveBuild");
    btn.textContent = exists ? "Overwrite" : "Save";
    btn.disabled = !onServer || !id;
    $("dirty").hidden = !isDirty();
    const list = $("buildList");
    if (!onServer) {
      list.innerHTML = `<li class="empty-list">Saving to files works when the planner is started with PlannerStart.bat. This tab was opened straight from the file, so builds can't be saved here.</li>`;
      return;
    }
    if (!builds.length) {
      list.innerHTML = `<li class="empty-list">No saved builds yet. Name your build and press Save.</li>`;
      return;
    }
    list.innerHTML = builds.map(b => {
      const id = esc(b.id);
      const loadLabel = pendingLoad === b.id ? "Discard changes and load" : "Load";
      const delLabel = pendingDelete === b.id ? "Confirm delete" : "Delete";
      return `<li class="build${b.id === S.loadedId ? " current" : ""}">
        <div class="binfo"><span class="bname">${esc(b.name)}</span><span class="meta num">${b.points} point${b.points === 1 ? "" : "s"}${b.savedAt ? " · " + esc(when(b.savedAt)) : ""}</span></div>
        <div class="actions">
          <button class="btn${pendingLoad === b.id ? " danger" : ""}" type="button" data-load="${id}">${loadLabel}</button>
          <button class="btn${pendingDelete === b.id ? " danger" : ""}" type="button" data-del="${id}">${delLabel}</button>
        </div></li>`;
    }).join("");
  }

  async function refreshBuilds() {
    if (!onServer) { renderBuilds(); return; }
    try { builds = await api("GET", API); if ($("saveMsg").textContent === OFFLINE) setSaveMsg(""); }
    catch (e) { builds = []; setSaveMsg(OFFLINE, "bad"); }
    renderBuilds();
  }

  async function saveBuild() {
    if (!onServer) return;
    const name = $("buildName").value.trim();
    if (!slugId(name)) { setSaveMsg("Give the build a name first.", "bad"); return; }
    pendingLoad = pendingDelete = null;
    try {
      const r = await api("POST", API, { name, build: buildData() });
      S.name = name; S.loadedId = r.id; S.savedSnap = snap();
      save();
      await refreshBuilds();
      setSaveMsg((r.overwritten ? "Overwrote " : "Saved ") + name + ".", "ok");
    } catch (e) {
      setSaveMsg(e instanceof TypeError ? OFFLINE : "Couldn't save: " + e.message, "bad");
    }
  }

  async function loadBuild(id) {
    pendingDelete = null;
    if (isDirty() && pendingLoad !== id) {
      pendingLoad = id; renderBuilds();
      setSaveMsg("Your current build has unsaved changes. Click again to discard them and load.", "bad");
      return;
    }
    pendingLoad = null;
    try {
      const f = await api("GET", API + "/" + encodeURIComponent(id));
      if (!applyBuild(f.build)) throw new Error("the file isn't a planner build.");
      S.name = String(f.name || ""); S.loadedId = id; S.savedSnap = snap();
      lastMsg = ""; render();
      setSaveMsg("Loaded " + S.name + ".", "ok");
    } catch (e) {
      setSaveMsg(e instanceof TypeError ? OFFLINE : "Couldn't load: " + e.message, "bad");
      refreshBuilds();
    }
  }

  async function deleteBuild(id) {
    pendingLoad = null;
    if (pendingDelete !== id) { pendingDelete = id; renderBuilds(); setSaveMsg(""); return; }
    pendingDelete = null;
    const b = builds.find(x => x.id === id);
    try {
      await api("DELETE", API + "/" + encodeURIComponent(id));
      if (S.loadedId === id) { S.loadedId = null; S.savedSnap = null; save(); }
      await refreshBuilds();
      setSaveMsg("Deleted " + (b ? b.name : "the build") + ".", "ok");
    } catch (e) {
      setSaveMsg(e instanceof TypeError ? OFFLINE : "Couldn't delete: " + e.message, "bad");
      refreshBuilds();
    }
  }

  $("saveBuild").addEventListener("click", saveBuild);
  $("buildName").addEventListener("input", e => { S.name = e.target.value; renderBuilds(); save(); });
  $("buildName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); saveBuild(); } });
  $("buildList").addEventListener("click", e => {
    const l = e.target.closest("[data-load]"), d = e.target.closest("[data-del]");
    if (l) loadBuild(l.dataset.load);
    else if (d) deleteBuild(d.dataset.del);
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveBuild(); }
  });
  window.addEventListener("focus", refreshBuilds);

  render();
  refreshBuilds();
})();
