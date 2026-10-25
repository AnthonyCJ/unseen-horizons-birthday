export function fadeMediaVolume(
  audio: Pick<HTMLMediaElement, "volume">,
  target: number,
  duration: number,
  onDone?: () => void,
  scheduler?: Pick<Window, "performance" | "requestAnimationFrame" | "cancelAnimationFrame" | "setTimeout" | "clearTimeout">,
): () => void;
