export const POSTCARD_SOURCE = "/unseen-horizons-birthday/keepsakes/unknown-horizons-2026.png";
export const POSTCARD_FILENAME = "未知风光-2026-11-13.png";

export async function loadPostcard(fetcher = fetch, signal) {
  const response = await fetcher(POSTCARD_SOURCE, { signal });
  if (!response.ok) throw new Error("Postcard unavailable");
  const blob = await response.blob();
  const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length < 24 || signature.some((byte, index) => byte !== header[index])) {
    throw new Error("Invalid postcard image");
  }
  return new Blob([blob], { type: "image/png" });
}
