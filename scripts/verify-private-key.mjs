import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACCESS_KEY_SHA256, sha256Hex } from "../lib/access-gate.mjs";

const recordPath = process.argv[2];

if (!recordPath) {
  console.error("Usage: npm run verify:private-key -- <private-record-path>");
  process.exitCode = 2;
} else {
  const record = await readFile(recordPath, "utf8");
  const key = /^Access key:\s*([A-Za-z0-9_-]{32})$/m.exec(record)?.[1];

  assert.ok(key, "Private record does not contain a 192-bit base64url access key");
  assert.equal(await sha256Hex(key), ACCESS_KEY_SHA256, "Private key does not match the public digest");
  console.log("Private access record matches the public SHA-256 digest.");
}
