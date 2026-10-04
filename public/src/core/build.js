// Build format: what gets packed into share codes and export files.
// Build data: { p: { skillId: rank }, s: slot ids (null = empty), m: mutagen id per group ("" = none), b: point budget, n?: name }
// A code is CODE_PREFIX + base64(UTF-8 JSON). Codes made before names were added are plain ASCII
// JSON, so they decode the same way.

export const CODE_PREFIX = "W3R1.";
export const MAX_NAME_LENGTH = 60;
const EXPORT_TITLE = "Wild Hunt Skill Planner build";

// Minimal shape check; applyBuildData() cleans up the details.
export function isBuildData(d) {
  return !!d && typeof d === "object" && !!d.p && typeof d.p === "object";
}

export function toBuildData(state) {
  const d = { p: state.pts, s: state.slots, m: state.mut, b: state.budget };
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
  if (typeof d.b === "number" && d.b >= 0) state.budget = Math.floor(d.b);
  state.name = typeof d.n === "string" ? d.n.slice(0, MAX_NAME_LENGTH) : "";
  return true;
}

const toBase64 = text => btoa(Array.from(new TextEncoder().encode(text), b => String.fromCharCode(b)).join(""));
const fromBase64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export function encodeBuildCode(state) {
  return CODE_PREFIX + toBase64(JSON.stringify(toBuildData(state)));
}

// Finds a build code anywhere in text (a pasted code, or an export file) and returns its build data,
// or null if there isn't a valid one. Whitespace is ignored, so a code wrapped across lines still loads.
export function decodeBuildCode(text) {
  const compact = String(text || "").replace(/\s+/g, "");
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
