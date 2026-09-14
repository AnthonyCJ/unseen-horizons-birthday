import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const outRoot = new URL("../../out/", import.meta.url);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...await walk(child));
    else files.push(child);
  }

  return files;
}

test("exports a neutral static shell and neutral 404 page", async () => {
  const index = await readFile(new URL("index.html", outRoot), "utf8");
  const notFound = await readFile(new URL("404.html", outRoot), "utf8");

  for (const html of [index, notFound]) {
    assert.match(html, /<meta name="robots" content="[^"]*noindex[^"]*nofollow[^"]*"/);
    assert.doesNotMatch(html, /生日快乐|Charlotte|11·13|XCJ|sky-castle-ocarina|healing-00[348]/);
  }

  assert.match(index, /Field Notes/);
  assert.match(index, /正在展开这份小手记/);
  assert.doesNotMatch(index, /入口暂不可用/);
  assert.match(notFound, /页面不存在/);
  await stat(new URL(".nojekyll", outRoot));
  await stat(new URL("robots.txt", outRoot));
});

test("contains only static files and no production source maps", async () => {
  const files = await walk(outRoot);
  const paths = files.map((file) => decodeURIComponent(file.pathname.replace(outRoot.pathname, "")));

  assert.equal(paths.some((path) => path.endsWith(".map")), false);
  assert.equal(paths.some((path) => /(^|\/)(server|worker)(\/|$)/i.test(path)), false);
  assert.equal(paths.some((path) => /hosting\.json|\.env|handoff|PROJECT_STATE/i.test(path)), false);
  assert.ok(paths.includes("assets/sky-castle-ocarina.mp3"));
  assert.equal(paths.some((path) => /inspiration-config|cloud-sync|\.sqlite/i.test(path)), false);
  for (const file of files.filter((file) => file.pathname.endsWith(".js"))) {
    const script = await readFile(file, "utf8");
    assert.doesNotMatch(script, /inspiration-config\.json|共享保存|用当前草稿替换/);
  }
});
