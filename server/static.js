// Serves files from one folder. Anything outside it, or with an unknown extension, is a 404.
import fs from "node:fs";
import path from "node:path";

/**
 * @param {{ dir: string, mime: Record<string, string>, transformHtml?: (html: string) => string }} opts
 */
export function createStaticHandler({ dir, mime, transformHtml }) {
  return function serveStatic(req, res, urlPath) {
    const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath).replace(/^\/+/, "");
    const file = path.resolve(dir, rel);
    const ext = path.extname(file).toLowerCase();
    if (!file.startsWith(dir + path.sep) || !mime[ext] || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": mime[ext], "Cache-Control": "no-store" });
    if (transformHtml && ext === ".html") return res.end(transformHtml(fs.readFileSync(file, "utf8")));
    fs.createReadStream(file).pipe(res);
  };
}
