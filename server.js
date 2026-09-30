// Wild Hunt Skill Planner - local server.
// Serves the planner and saves builds as .json files in the "builds" folder next to this file.
// No packages needed: run with `node server.js` (PlannerStart.bat does this for you).
// While editing the planner, `npm run dev` adds live reload and restarts the server when server.js changes.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT = __dirname;
const BUILDS = path.join(ROOT, "builds");
const HOST = "127.0.0.1";
const FIRST_PORT = 4717;
const APP_ID = "wild-hunt-skill-planner";
const NO_OPEN = process.argv.includes("--no-open");
const LIVE = process.argv.includes("--live");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2"
};

fs.mkdirSync(BUILDS, { recursive: true });

// Same rule as slugId() in app.js: letters (any alphabet), digits, space, dash, underscore.
function slugId(name) {
  let s = String(name || "").normalize("NFC").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60);
  if (!s) return null;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = "build-" + s;
  return s.toLowerCase() + ".json";
}
function buildPath(id) {
  if (typeof id !== "string" || !/^[\p{L}\p{N}_-]+\.json$/u.test(id)) return null;
  const p = path.join(BUILDS, id);
  return path.dirname(p) === BUILDS ? p : null;
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > 1e6) { reject(new Error("Build is too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("Request wasn't valid JSON.")); } });
    req.on("error", reject);
  });
}
function pointsOf(build) {
  const p = build && build.p && typeof build.p === "object" ? build.p : {};
  return Object.values(p).reduce((s, v) => s + (Number(v) || 0), 0);
}

function listBuilds() {
  return fs.readdirSync(BUILDS).filter(f => f.toLowerCase().endsWith(".json")).map(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(BUILDS, f), "utf8"));
      if (!d || typeof d.build !== "object") return null;
      return { id: f, name: String(d.name || f.replace(/\.json$/i, "")), savedAt: d.savedAt || null, points: pointsOf(d.build) };
    } catch (e) { return null; }
  }).filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

async function handleApi(req, res, parts) {
  // parts: ["api", "builds", id?]
  if (parts[1] === "ping") return send(res, 200, { app: APP_ID });
  if (parts[1] === "live" && LIVE) return openLiveStream(req, res);
  if (parts[1] !== "builds" || parts.length > 3) return send(res, 404, { error: "Unknown address." });
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;

  if (!id && req.method === "GET") return send(res, 200, listBuilds());

  if (!id && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().slice(0, 60);
    const newId = slugId(name);
    if (!newId) return send(res, 400, { error: "Give the build a name with at least one letter or digit." });
    if (!body.build || typeof body.build !== "object" || typeof body.build.p !== "object") return send(res, 400, { error: "That isn't a planner build." });
    const file = buildPath(newId);
    const overwritten = fs.existsSync(file);
    const savedAt = new Date().toISOString();
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ app: APP_ID, version: 1, name, savedAt, build: body.build }, null, 2), "utf8");
    fs.renameSync(tmp, file);
    return send(res, 200, { id: newId, name, savedAt, overwritten });
  }

  const file = id && buildPath(id);
  if (!file) return send(res, 400, { error: "That build name isn't valid." });
  if (!fs.existsSync(file)) return send(res, 404, { error: "That build file no longer exists." });

  if (req.method === "GET") {
    try { return send(res, 200, JSON.parse(fs.readFileSync(file, "utf8"))); }
    catch (e) { return send(res, 422, { error: "The build file is damaged and can't be read." }); }
  }
  if (req.method === "DELETE") { fs.unlinkSync(file); return send(res, 200, { deleted: id }); }
  return send(res, 405, { error: "Not allowed." });
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath).replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel);
  const ext = path.extname(file).toLowerCase();
  const inside = file.startsWith(ROOT + path.sep) && !file.startsWith(BUILDS + path.sep);
  if (!inside || !TYPES[ext] || path.basename(file) === "server.js" || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[ext], "Cache-Control": "no-store" });
  if (LIVE && ext === ".html") return res.end(fs.readFileSync(file, "utf8").replace("</body>", LIVE_SCRIPT + "</body>"));
  fs.createReadStream(file).pipe(res);
}

// ---------- live reload (--live) ----------
// Watches the planner's files and tells open tabs to refresh: CSS is swapped in place, anything else reloads.
// Tabs also reload when they reconnect, which covers server restarts under `node --watch`.
const liveClients = new Set();
const LIVE_SCRIPT = `<script>
(function () {
  let connected = false;
  const es = new EventSource("/api/live");
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

function openLiveStream(req, res) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
  res.write("retry: 500\n\n");
  liveClients.add(res);
  req.on("close", () => liveClients.delete(res));
}

function watchFiles() {
  let timer = null, kind = null;
  fs.watch(ROOT, { recursive: true }, (event, name) => {
    const rel = String(name || "").replace(/\\/g, "/");
    if (/^(builds|node_modules|\.git)(\/|$)/.test(rel) || rel === "server.js") return;
    const ext = path.extname(rel).toLowerCase();
    if (!TYPES[ext]) return;
    // Batch the burst of events one save produces; a CSS-only batch doesn't need a full reload.
    kind = ext === ".css" && kind !== "reload" ? "css" : "reload";
    clearTimeout(timer);
    timer = setTimeout(() => { liveClients.forEach(c => c.write(`data: ${kind}\n\n`)); kind = null; }, 100);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url, "http://localhost").pathname;
    const parts = urlPath.split("/").filter(Boolean);
    if (parts[0] === "api") return await handleApi(req, res, parts);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Not allowed." });
    serveStatic(req, res, urlPath);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: e.message || "Something went wrong on the server." });
  }
});

function openBrowser(url) {
  if (NO_OPEN) return;
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

// If the planner is already running on a port, just open it instead of starting a second copy.
function alreadyRunning(port) {
  return new Promise(resolve => {
    const r = http.get({ host: HOST, port, path: "/api/ping", timeout: 800 }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d).app === APP_ID); } catch (e) { resolve(false); } });
    });
    r.on("error", () => resolve(false));
    r.on("timeout", () => { r.destroy(); resolve(false); });
  });
}

function start(port) {
  server.once("error", async err => {
    if (err.code !== "EADDRINUSE" || port > FIRST_PORT + 10) { console.error("Couldn't start the server: " + err.message); process.exit(1); }
    if (await alreadyRunning(port)) {
      const url = `http://127.0.0.1:${port}`;
      console.log("The planner is already running at " + url + ". Opening it.");
      openBrowser(url);
      setTimeout(() => process.exit(0), 1500);
    } else start(port + 1);
  });
  server.listen(port, HOST, () => {
    const url = `http://127.0.0.1:${port}`;
    console.log("");
    console.log("  Wild Hunt Skill Planner is running at " + url);
    console.log("  Builds are saved in: " + BUILDS);
    console.log("");
    console.log("  Keep this window open while you use the planner. Close it to stop.");
    if (!LIVE) return openBrowser(url);
    console.log("  Live reload is on: open tabs refresh when you save a file.");
    watchFiles();
    // After a restart, open tabs reconnect within a second; only open a new tab if none did.
    setTimeout(() => { if (!liveClients.size) openBrowser(url); }, 1500);
  });
}
start(FIRST_PORT);
