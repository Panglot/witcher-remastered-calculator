// Watches a folder for real file changes. On Windows, fs.watch also fires when a file is only read
// (NTFS updates its last-access time if it's over an hour old), so serving a file, opening it in the
// editor or searching the folder looked like a save. Each event is checked against the file's last
// known modified time and size, and only events that changed one of them count.
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} dir
 * @param {{ filter?: (name: string) => boolean, onChange: (names: string[]) => void, delay?: number }} opts
 *   filter: which files to track, by path relative to `dir`. onChange: called with the changed paths,
 *   once per burst of events (one save fires several). Returns a function that stops watching.
 */
export function watchChanges(dir, { filter = () => true, onChange, delay = 100 }) {
  const known = new Map();
  const stamp = file => {
    try { const s = fs.statSync(file); return s.isFile() ? `${s.mtimeMs}:${s.size}` : null; } catch (e) { return null; }
  };
  (function seed(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) seed(p);
      else if (filter(path.relative(dir, p))) known.set(p, stamp(p));
    }
  })(dir);

  let timer = null;
  const changed = new Set();
  const watcher = fs.watch(dir, { recursive: true }, (event, name) => {
    if (!name || !filter(String(name))) return;
    const file = path.join(dir, String(name));
    const now = stamp(file);
    if (known.get(file) === now) return;
    if (now === null) known.delete(file); else known.set(file, now);
    changed.add(String(name));
    clearTimeout(timer);
    timer = setTimeout(() => { const names = [...changed]; changed.clear(); onChange(names); }, delay);
  });
  return () => { clearTimeout(timer); watcher.close(); };
}
