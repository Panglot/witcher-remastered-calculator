// Local dev server for the planner. The live site is GitHub Pages, which serves public/ as static files;
// this server does the same locally, because browsers won't load ES modules from file://.
//   npm start      serve public/ and open the browser
//   npm run dev    same, plus live reload; the server restarts when server code changes
import http from "node:http";
import { exec } from "node:child_process";
import { PUBLIC_DIR, HOST, FIRST_PORT, PORT_TRIES, FLAGS, MIME } from "./config.js";
import { createStaticHandler } from "./static.js";
import { createLiveReload } from "./live-reload.js";

const live = FLAGS.live ? createLiveReload({ dir: PUBLIC_DIR, mime: MIME }) : null;
const serveStatic = createStaticHandler({ dir: PUBLIC_DIR, mime: MIME, transformHtml: live && live.injectScript });

const server = http.createServer((req, res) => {
  try {
    const urlPath = new URL(req.url, "http://localhost").pathname;
    if (live && urlPath === "/__live") return live.handleStream(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    serveStatic(req, res, urlPath);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end(); }
  }
});

function openBrowser(url) {
  if (FLAGS.noOpen) return;
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function start(port) {
  server.once("error", err => {
    if (err.code !== "EADDRINUSE" || port >= FIRST_PORT + PORT_TRIES) { console.error("Couldn't start the server: " + err.message); process.exit(1); }
    start(port + 1);
  });
  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log(`\n  Wild Hunt Skill Planner (local) is running at ${url}\n`);
    if (!live) return openBrowser(url);
    console.log("  Live reload is on: open tabs refresh when you save a file.");
    live.watch();
    // After a restart, open tabs reconnect within a second; only open a new tab if none did.
    setTimeout(() => { if (!live.clientCount()) openBrowser(url); }, 1500);
  });
}
start(FIRST_PORT);
