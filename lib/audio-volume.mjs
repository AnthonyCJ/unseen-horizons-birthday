// Keep the foreground fade smooth, but never make audible playback depend on
// animation frames: browsers suspend them while a tab is in the background.
export function fadeMediaVolume(audio, target, duration, onDone, scheduler = window) {
  const startVolume = audio.volume;
  const startedAt = scheduler.performance.now();
  let active = true;
  let frame = null;
  let timer = null;

  const cancel = () => {
    active = false;
    if (frame !== null) scheduler.cancelAnimationFrame(frame);
    if (timer !== null) scheduler.clearTimeout(timer);
    frame = null;
    timer = null;
  };

  const update = () => {
    if (!active) return false;
    const progress = Math.min(1, Math.max(0, (scheduler.performance.now() - startedAt) / duration));
    audio.volume = Math.max(0, Math.min(1, startVolume + (target - startVolume) * progress));
    if (progress < 1) return true;
    cancel();
    onDone?.();
    return false;
  };

  const onFrame = () => {
    if (!active) return;
    frame = null;
    if (update()) frame = scheduler.requestAnimationFrame(onFrame);
  };
  const onTimer = () => {
    if (!active) return;
    timer = null;
    if (update()) timer = scheduler.setTimeout(onTimer, 100);
  };

  frame = scheduler.requestAnimationFrame(onFrame);
  timer = scheduler.setTimeout(onTimer, 100);
  return cancel;
}
