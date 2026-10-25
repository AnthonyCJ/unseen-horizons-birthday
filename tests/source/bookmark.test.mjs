import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadBookmark } from "../../lib/bookmark.mjs";

test("the bookmark download preserves the accepted complete 1080 by 2880 PNG", async () => {
  const original = await readFile(new URL("../../public/keepsakes/iris-bookmark-2026.png", import.meta.url));
  assert.equal(createHash("sha256").update(original).digest("hex"), "81f4365c27e06814d8961176154b624740af63ebe522bbd73b73aba19cf0490c");
  const signal = new AbortController().signal;
  const blob = await loadBookmark(async (url, options) => {
    assert.equal(url, "/unseen-horizons-birthday/keepsakes/iris-bookmark-2026.png");
    assert.equal(options.signal, signal);
    return new Response(original);
  }, signal);
  assert.equal(blob.type, "image/png");
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), original);
});

test("bookmark failures and substituted HTML or wrong-size images never become downloads", async () => {
  await assert.rejects(loadBookmark(async () => new Response("Not found", { status: 404 })));
  await assert.rejects(loadBookmark(async () => new Response("<!doctype html><p>Error</p>")));
  const wrong = Buffer.from(await readFile(new URL("../../public/keepsakes/iris-bookmark-2026.png", import.meta.url)));
  wrong.writeUInt32BE(1, 16);
  await assert.rejects(loadBookmark(async () => new Response(wrong)));
});
