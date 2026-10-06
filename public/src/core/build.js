// Build format: what gets packed into share codes and export files.
// Build data: { p: { skillId: rank }, s: slot ids (null = empty), m: mutagen id per group ("" = none), b: point budget,
//   g?: progress { l: level, w: places of power, o: other points, ng?: 1 in NG+, c?: 1 for a custom total }, n?: name }
// Codes without g were made when the budget was only typed in: they load as a custom total (core/budget.js).
// A code is CODE_PREFIX + base64(UTF-8 JSON). Codes made before names were added are plain ASCII
// JSON, so they decode the same way. A share link is the page's address with the code in the
// SHARE_PARAM query parameter; anything that takes a code also takes a link.

export const CODE_PREFIX = "W3R1.";
export const MAX_NAME_LENGTH = 60;
export const SHARE_PARAM = "build";
const EXPORT_TITLE = "Wild Hunt Skill Planner build";

// Minimal shape check; applyBuildData() cleans up the details.
export function isBuildData(d) {
  return !!d && typeof d === "object" && !!d.p && typeof d.p === "object";
}

/** True when the build holds nothing worth asking about before it is replaced: no points, mutagens or name. */
export function isEmptyBuild(state) {
  return !Object.keys(state.pts || {}).length && !(state.mut || []).some(Boolean) && !state.name;
}

export function toBuildData(state) {
  const { level, places, other, ngPlus, custom } = state.progress;
  const g = { l: level, w: places, o: other };
  if (ngPlus) g.ng = 1;
  if (custom) g.c = 1;
  const d = { p: state.pts, s: state.slots, m: state.mut, b: state.budget, g };
  if (state.name) d.n = state.name;
  return d;
}

// Copies build data into state, dropping unknown skills, out-of-range ranks and invalid slots.
// Returns false (and leaves state alone) when d isn't build data.
export function applyBuildData(catalog, state, d) {
  if (!isBuildData(d)) return false;
  const { nodes, maxRank, slots, mutagenId } = catalog;
  const p = {};
  Object.keys(d.p).forEach(k => { const v = Math.max(0, Math.min(maxRank, d.p[k] | 0)); if (nodes[k] && v) p[k] = v; });
  state.pts = p;
  state.slots = Array.isArray(d.s) && d.s.length === slots.total ? d.s.map(x => (x && nodes[x] && p[x]) ? x : null) : Array(slots.total).fill(null);
  state.mut = Array.isArray(d.m) && d.m.length === slots.groups ? d.m.map(mutagenId) : Array(slots.groups).fill("");
  const typed = typeof d.b === "number" && d.b >= 0 ? Math.floor(d.b) : state.budget;
  const g = d.g && typeof d.g === "object" ? d.g : null;
  state.progress = catalog.budget.normalize(g && { level: g.l, places: g.w, other: g.o, ngPlus: !!g.ng, custom: !!g.c }, typed);
  state.budget = catalog.budget.budgetOf(state.progress, typed);
  state.name = typeof d.n === "string" ? d.n.slice(0, MAX_NAME_LENGTH) : "";
  return true;
}

const toBase64 = text => btoa(Array.from(new TextEncoder().encode(text), b => String.fromCharCode(b)).join(""));
const fromBase64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export function encodeBuildCode(state) {
  return CODE_PREFIX + toBase64(JSON.stringify(toBuildData(state)));
}

// Finds a build code anywhere in text (a pasted code or link, or an export file) and returns its build
// data, or null if there isn't a valid one. Whitespace is ignored, so a code wrapped across lines still loads.
export function decodeBuildCode(text) {
  const compact = unescapeLink(String(text || "")).replace(/\s+/g, "");
  // Last match: an export file's header may contain the prefix inside the build name.
  const at = compact.lastIndexOf(CODE_PREFIX);
  if (at < 0) return null;
  const b64 = compact.slice(at + CODE_PREFIX.length).match(/^[A-Za-z0-9+/]+=*/);
  if (!b64) return null;
  try {
    const d = JSON.parse(fromBase64(b64[0]));
    return isBuildData(d) ? d : null;
  } catch (e) { return null; }
}

// A link carries the code percent-encoded (+, / and = are). Base64 has no %, so a plain code is unchanged.
function unescapeLink(text) {
  try { return decodeURIComponent(text); } catch (e) { return text; }
}

/** The page address `pageUrl` with the build's code in it; opening it loads the build. */
export function shareLink(pageUrl, state) {
  const url = new URL(pageUrl);
  url.searchParams.set(SHARE_PARAM, encodeBuildCode(state));
  url.hash = "";
  return url.href;
}

/** The code a share link carries ("" for none), and the same address without it. */
export function readShareLink(pageUrl) {
  const url = new URL(pageUrl);
  const code = url.searchParams.get(SHARE_PARAM) || "";
  url.searchParams.delete(SHARE_PARAM);
  return { code, rest: url.href };
}

// File name for an exported build: letters (any alphabet), digits, dash, underscore.
export function exportFileName(name) {
  const slug = String(name || "").normalize("NFC").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, MAX_NAME_LENGTH).toLowerCase();
  return (slug || "witcher-build") + ".txt";
}

// Export file: a readable header plus the code. Import only looks for the code, so people can
// also paste a code into any text file and import that.
export function exportFile(state) {
  const title = state.name ? `${EXPORT_TITLE}: ${state.name}` : EXPORT_TITLE;
  return { name: exportFileName(state.name), text: `${title}\n${encodeBuildCode(state)}\n` };
}
