// Live reload for `npm run dev`: watches the served files and tells open tabs to refresh.
// CSS is swapped in place, anything else reloads. Tabs also reload when they reconnect,
// which covers server restarts under `node --watch`.
import fs from "node:fs";
import path from "node:path";

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
    let timer = null, kind = null;
    fs.watch(dir, { recursive: true }, (event, name) => {
      const ext = path.extname(String(name || "")).toLowerCase();
      if (!mime[ext]) return;
      // Batch the burst of events one save produces; a CSS-only batch doesn't need a full reload.
      kind = ext === ".css" && kind !== "reload" ? "css" : "reload";
      clearTimeout(timer);
      timer = setTimeout(() => { clients.forEach(c => c.write(`data: ${kind}\n\n`)); kind = null; }, 100);
    });
  }

  return { injectScript, handleStream, watch, clientCount: () => clients.size };
}
