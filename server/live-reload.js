// Live reload for `npm run dev`: watches the served files and tells open tabs to refresh.
// CSS is swapped in place, anything else reloads. Tabs also reload when they reconnect,
// which covers server restarts (server/dev.js).
import path from "node:path";
import { watchChanges } from "./watch.js";

const ext = name => path.extname(name).toLowerCase();

const CLIENT_SCRIPT = `<script>
(function () {
  let connected = false;
  const es = new EventSource("/__live");
  es.onopen = () => { if (connected) location.reload(); connected = true; };
  es.onmessage = e => {
    if (e.data !== "css") return location.reload();
    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
      const href = l.getAttribute("href");
      if (!/^https?:/.test(href)) l.href = href.replace(/\\?.*$/, "") + "?v=" + Date.now();
    });
  };
})();
</script>
`;

/** @param {{ dir: string, mime: Record<string, string> }} opts */
export function createLiveReload({ dir, mime }) {
  const clients = new Set();

  function injectScript(html) {
    return html.replace("</body>", CLIENT_SCRIPT + "</body>");
  }

  // Server-sent events stream at /__live.
  function handleStream(req, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write("retry: 500\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
  }

  function watch() {
    watchChanges(dir, {
      filter: name => !!mime[ext(name)],
      onChange: names => {
        // A CSS-only change doesn't need a full reload.
        const kind = names.every(n => ext(n) === ".css") ? "css" : "reload";
        clients.forEach(c => c.write(`data: ${kind}\n\n`));
      }
    });
  }

  return { injectScript, handleStream, watch, clientCount: () => clients.size };
}
