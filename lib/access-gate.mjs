export const ACCESS_KEY_SHA256 = "016ba93af7acb780f5a8b3d19002cacd4ee25dfc7f16d355894a50aa655ec264";

const ACCESS_FRAGMENT_PATTERN = /^#\/open\/([A-Za-z0-9_-]{32})$/;

export function parseAccessKey(hash) {
  if (typeof hash !== "string") return null;
  return ACCESS_FRAGMENT_PATTERN.exec(hash)?.[1] ?? null;
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;

  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable");
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyAccessHash(hash) {
  const key = parseAccessKey(hash);
  if (key === null) return false;

  const candidateDigest = await sha256Hex(key);
  return constantTimeEqual(candidateDigest, ACCESS_KEY_SHA256);
}
