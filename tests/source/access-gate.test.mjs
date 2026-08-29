import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACCESS_KEY_SHA256,
  constantTimeEqual,
  parseAccessKey,
  sha256Hex,
  verifyAccessHash,
} from "../../lib/access-gate.mjs";

test("accepts only the exact fragment route shape", () => {
  const key = "A".repeat(32);
  assert.equal(parseAccessKey(`#/open/${key}`), key);
  assert.equal(parseAccessKey(`#/open/${key}/extra`), null);
  assert.equal(parseAccessKey(`?key=${key}`), null);
  assert.equal(parseAccessKey("#/open/short"), null);
});

test("computes SHA-256 with Web Crypto", async () => {
  assert.equal(
    await sha256Hex("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

test("rejects missing and incorrect keys", async () => {
  assert.match(ACCESS_KEY_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(await verifyAccessHash(""), false);
  assert.equal(await verifyAccessHash(`#/open/${"A".repeat(32)}`), false);
});

test("compares digests without an early length return", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "ab"), false);
});

test("shows a neutral loading shell until access verification finishes", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /function EntranceLoading\(\)/);
  assert.match(page, /if \(gateState === "checking"\) return <EntranceLoading \/>/);
  assert.match(page, /if \(gateState === "denied"\) return <NeutralEntrance \/>/);
  assert.match(page, /<Suspense fallback=\{<EntranceLoading \/>\}>/);
  assert.match(page, /正在展开这份小手记/);
  assert.doesNotMatch(page, /NeutralEntrance checking/);
});
