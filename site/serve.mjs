// Serves site/dist for a local look: `node site/serve.mjs [port]` (default 4321). No dependencies.
// Sends the right content types, the 404 page, and answers Range requests like an ordinary static
// host. (Cloudflare Pages does not, which is why lesson.js downloads a video whole.)
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.argv[2] ?? 4321);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

createServer(async (req, res) => {
  let url;
  try {
    url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return res.writeHead(400).end();
  }
  let file = path.join(dist, url);
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = path.join(file, "index.html");
    info = await stat(file).catch(() => null);
  }
  if (!info) {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    return createReadStream(path.join(dist, "404.html")).pipe(res);
  }
  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end) return res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": info.size });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`site/dist at http://localhost:${port}/`));
