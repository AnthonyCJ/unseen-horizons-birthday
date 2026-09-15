import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

test("local preview serves exact media ranges, including suffixes and open ends", async t => {
  const root = await mkdtemp(join(tmpdir(), "gift-range-test-"));
  const bytes = Buffer.from(Array.from({ length: 1024 }, (_, i) => i % 251));
  await writeFile(join(root, "fixture.mp3"), bytes);
  const server = spawn(process.execPath, [fileURLToPath(new URL("../../scripts/serve-static.mjs", import.meta.url)), root], {
    env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  try {
    const [log] = await once(server.stdout, "data");
    const port = /127\.0\.0\.1:(\d+)/.exec(log.toString())?.[1];
    assert.ok(port && port !== "0", "server reports its actual ephemeral port");
    const url = `http://127.0.0.1:${port}/unseen-horizons-birthday/fixture.mp3`;
    for (const [range, start, end] of [
      ["bytes=0-1", 0, 1], ["bytes=500-", 500, 1023], ["bytes=-128", 896, 1023],
      ["bytes=1000-2000", 1000, 1023], ["bytes=-2048", 0, 1023],
    ]) await t.test(range, async () => {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/1024`);
      assert.equal(response.headers.get("content-type"), "audio/mpeg");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    });
    for (const range of ["bytes=1024-", "bytes=-0", "bytes=10-5"]) await t.test(range, async () => {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 416);
      assert.equal(response.headers.get("content-range"), "bytes */1024");
      await response.arrayBuffer();
    });
    await t.test("HEAD ignores Range and reports the whole representation", async () => {
      const response = await fetch(url, { method: "HEAD", headers: { Range: "bytes=0-1" } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-length"), "1024");
      assert.equal((await response.arrayBuffer()).byteLength, 0);
    });
  } finally {
    server.kill();
    await once(server, "close");
    await unlink(join(root, "fixture.mp3"));
    await rmdir(root);
  }
});
