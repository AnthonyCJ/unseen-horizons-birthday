import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { createServer } from "node:http";

const root = resolve(process.argv[2] ?? "out");
const basePath = "/unseen-horizons-birthday";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveRequestPath(pathname) {
  if (pathname === basePath) return { redirect: `${basePath}/` };
  if (!pathname.startsWith(`${basePath}/`)) return { file: resolve(root, "404.html"), status: 404 };

  const relative = decodeURIComponent(pathname.slice(basePath.length)).replace(/^\/+/, "");
  let candidate = resolve(root, relative || "index.html");

  if (!candidate.startsWith(root + sep) && candidate !== root) {
    return { file: resolve(root, "404.html"), status: 404 };
  }

  try {
    if (statSync(candidate).isDirectory()) candidate = resolve(candidate, "index.html");
    if (!statSync(candidate).isFile()) throw new Error("Not a file");
    return { file: candidate, status: 200 };
  } catch {
    return { file: resolve(root, "404.html"), status: 404 };
  }
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const result = resolveRequestPath(pathname);
  if ("redirect" in result) {
    response.writeHead(308, { Location: result.redirect }).end();
    return;
  }

  let fileSize;
  try {
    fileSize = statSync(result.file).size;
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }

  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": contentTypes.get(extname(result.file).toLowerCase()) ?? "application/octet-stream",
  };
  const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");

  if (rangeMatch) {
    const start = rangeMatch[1] === "" ? 0 : Number.parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] === "" ? fileSize - 1 : Number.parseInt(rangeMatch[2], 10);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= fileSize) {
      response.writeHead(416, { "Content-Range": `bytes */${fileSize}` }).end();
      return;
    }

    response.writeHead(206, {
      ...headers,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(result.file, { start, end }).pipe(response);
    return;
  }

  response.writeHead(result.status, { ...headers, "Content-Length": fileSize });
  if (request.method === "HEAD") response.end();
  else createReadStream(result.file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static preview: http://127.0.0.1:${port}${basePath}/`);
});
