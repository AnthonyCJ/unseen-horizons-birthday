import { createReadStream, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { ACCESS_KEY_SHA256 } from "../lib/access-gate.mjs";

const root = resolve(process.argv[2] ?? "out");
const basePath = "/unseen-horizons-birthday";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const testEntrance = process.argv.includes("--test-key");
const reducedMotion = testEntrance && process.argv.includes("--reduced-motion");
const testKey = "birthday_review_2026_local_test0";
const testDigest = createHash("sha256").update(testKey).digest("hex");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".ttf", "font/ttf"],
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
  // A synthetic entrance is available only in explicitly requested loopback
  // review responses. Never rewrite the build or expose a production key.
  const extension = extname(result.file).toLowerCase();
  if (testEntrance && result.status === 200 && [".html", ".js", ".css"].includes(extension)) {
    let body = readFileSync(result.file, "utf8");
    if (extension === ".js") body = body.replaceAll(ACCESS_KEY_SHA256, testDigest);
    if (reducedMotion) {
      if (extension === ".css") body = body.replace(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/g, "@media all");
      if (extension === ".html") body = body.replace("<head>", '<head><script>const originalMatchMedia=window.matchMedia.bind(window);window.matchMedia=(q)=>{const m=originalMatchMedia(q);return q.includes("prefers-reduced-motion")?{matches:true,media:q,addEventListener:m.addEventListener.bind(m),removeEventListener:m.removeEventListener.bind(m)}:m;};</script>');
    }
    response.writeHead(200, { ...headers, "Content-Length": Buffer.byteLength(body) });
    response.end(request.method === "HEAD" ? undefined : body);
    return;
  }
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
  console.log(`Static preview${testEntrance ? " (synthetic entrance)" : ""}: http://127.0.0.1:${port}${basePath}/${testEntrance ? `?preview=1#/open/${testKey}` : ""}`);
});
