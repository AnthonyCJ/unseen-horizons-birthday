export const BOOKMARK_SOURCE = "/unseen-horizons-birthday/keepsakes/iris-bookmark-2026.png";
export const BOOKMARK_FILENAME = "未知风光-鸢尾书签-2026.png";

export async function loadBookmark(fetcher = fetch, signal) {
  const response = await fetcher(BOOKMARK_SOURCE, { signal });
  if (!response.ok) throw new Error("Bookmark unavailable");
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((byte, index) => byte !== bytes[index])) throw new Error("Invalid bookmark PNG");
  const header = new DataView(bytes.buffer);
  if (header.getUint32(16) !== 1080 || header.getUint32(20) !== 2880) throw new Error("Unexpected bookmark dimensions");
  return new Blob([blob], { type: "image/png" });
}
