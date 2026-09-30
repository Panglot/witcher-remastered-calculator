export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Sets an input's value unless the user is typing in it.
export function syncInput(el, value) {
  if (document.activeElement !== el) el.value = value;
}
