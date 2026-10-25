import assert from "node:assert/strict";
import test from "node:test";
import { fadeMediaVolume } from "../../lib/audio-volume.mjs";

function controlledScheduler() {
  let now = 0;
  let nextId = 0;
  const frames = new Map();
  const timers = new Map();
  return {
    performance: { now: () => now },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advanceTo(time, render = false) {
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= time).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      now = time;
      if (render) {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(now));
      }
    },
    delayedTimer(time) {
      now = time;
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach(timer => timer.callback());
    },
    callbacks: () => [...frames.values(), ...[...timers.values()].map(timer => timer.callback)],
    pending: () => frames.size + timers.size,
  };
}

test("loop fade reaches the scene volume without any animation frames", () => {
  const scheduler = controlledScheduler();
  const audio = { volume: 0 };
  let completed = 0;
  fadeMediaVolume(audio, 0.6, 1800, () => completed++, scheduler);
  scheduler.advanceTo(900);
  assert.equal(audio.volume, 0.3);
  scheduler.advanceTo(1800);
  assert.equal(audio.volume, 0.6);
  assert.equal(completed, 1);
  assert.equal(scheduler.pending(), 0);
});

test("a delayed background timer catches up to elapsed time instead of extending silence", () => {
  const scheduler = controlledScheduler();
  const audio = { volume: 0 };
  fadeMediaVolume(audio, 0.6, 1800, undefined, scheduler);
  scheduler.delayedTimer(5000);
  assert.equal(audio.volume, 0.6);
  assert.equal(scheduler.pending(), 0);
});

test("foreground frames keep the same linear fade and completion runs once", () => {
  const scheduler = controlledScheduler();
  const audio = { volume: 0.6 };
  let completed = 0;
  fadeMediaVolume(audio, 0, 650, () => completed++, scheduler);
  scheduler.advanceTo(325, true);
  assert.equal(audio.volume, 0.3);
  const stale = scheduler.callbacks();
  scheduler.advanceTo(650, true);
  stale.forEach(callback => callback(700));
  assert.equal(audio.volume, 0);
  assert.equal(completed, 1);
  assert.equal(scheduler.pending(), 0);
});

test("cancelled fades cannot change a later mix or run an obsolete pause/reset callback", () => {
  const scheduler = controlledScheduler();
  const audio = { volume: 0.6 };
  let obsoletePause = 0;
  const cancel = fadeMediaVolume(audio, 0, 650, () => obsoletePause++, scheduler);
  scheduler.advanceTo(200);
  const stale = scheduler.callbacks();
  cancel();
  fadeMediaVolume(audio, 0.841, 1200, undefined, scheduler);
  stale.forEach(callback => callback(10000));
  scheduler.advanceTo(1400);
  assert.equal(audio.volume, 0.841);
  assert.equal(obsoletePause, 0);
  assert.equal(scheduler.pending(), 0);
});

test("unmount/error cleanup removes both clocks and ignores callbacks already queued", () => {
  const scheduler = controlledScheduler();
  const audio = { volume: 0.4 };
  let completed = 0;
  const cancel = fadeMediaVolume(audio, 1, 5200, () => completed++, scheduler);
  const stale = scheduler.callbacks();
  cancel();
  cancel();
  scheduler.advanceTo(10000);
  stale.forEach(callback => callback(10000));
  assert.equal(audio.volume, 0.4);
  assert.equal(completed, 0);
  assert.equal(scheduler.pending(), 0);
});
