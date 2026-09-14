export function isPreviewVisit(search) {
  return new URLSearchParams(search).get("preview") === "1";
}
