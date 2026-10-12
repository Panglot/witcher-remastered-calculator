// `npm run dev`: runs the server with live reload and restarts it when server code changes.
// Replaces `node --watch`, which on Windows also restarted when a server file was only read (see watch.js).
// The old server exits before the new one starts, so the new one gets the same port back
// and open tabs reconnect to it (a different port is a different site, with its own saved build).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { watchChanges } from "./watch.js";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = [path.join(SERVER_DIR, "index.js"), "--live", ...process.argv.slice(2)];

let child = null;
function run() {
  child = spawn(process.execPath, args, { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (child.restarting) return run();
    // Crashed: wait for a fix to be saved rather than retrying in a loop.
    if (code) console.log(`\n  Server stopped (exit code ${code}). Waiting for a change in server/ to restart.\n`);
    child = null;
  });
}

watchChanges(SERVER_DIR, {
  filter: name => name.endsWith(".js"),
  onChange: names => {
    console.log(`\n  ${names.join(", ")} changed, restarting the server...`);
    if (!child) return run();
    child.restarting = true;
    child.kill();
  }
});
run();
