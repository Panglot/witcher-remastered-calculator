import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The only folder served to the browser (and what GitHub Pages publishes).
export const PUBLIC_DIR = path.join(ROOT, "public");

export const HOST = "127.0.0.1";
export const FIRST_PORT = 4717;
// If FIRST_PORT is taken by something else, try this many ports after it.
export const PORT_TRIES = 10;

export const FLAGS = {
  noOpen: process.argv.includes("--no-open"),
  live: process.argv.includes("--live")
};

export const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2"
};
