// The shared tempo. One transport runs the 16th-note grid; the sequencer and the metronome are
// "parts" that ride it. The transport runs while any part is armed, so starting the metronome
// alone just clicks, starting the pattern alone just plays, and both stay locked to one BPM.
// Lookahead scheduling (25 ms timer, 120 ms window) comes from the Returnity beat engine.
import { audio } from './audio.js';

const BPM_KEY = 'beatroom.bpm';
const t = { bpm: loadBpm(), running: false, step: 0, next: 0, timer: 0 };
const parts = new Map();          // name -> { armed, schedule(step, time, stepDur, abs) }
const stepFns = new Set();        // UI: fn(step | -1, abs) at the moment a step sounds
const bpmFns = new Set();
const runFns = new Set();

function loadBpm() {
  try { const v = parseInt(localStorage.getItem(BPM_KEY), 10); return v >= 40 && v <= 220 ? v : 92; } catch { return 92; }
}

export const getBpm = () => t.bpm;
export const isRunning = () => t.running;
export const isArmed = (name) => !!parts.get(name)?.armed;
export const onStep = (fn) => (stepFns.add(fn), () => stepFns.delete(fn));
export const onBpm = (fn) => (bpmFns.add(fn), () => bpmFns.delete(fn));
export const onRun = (fn) => (runFns.add(fn), () => runFns.delete(fn));

export function setBpm(bpm) {
  t.bpm = Math.max(40, Math.min(220, Math.round(bpm)));
  try { localStorage.setItem(BPM_KEY, String(t.bpm)); } catch { /* storage off */ }
  bpmFns.forEach((fn) => fn(t.bpm));
}

/** Register a part. schedule(step, time, stepDur, abs) is called ahead of time for every 16th.
 *  step is 0..15 (one bar); abs counts up from 0 since the transport started, so longer
 *  patterns (32 steps) can take abs % length. */
export function definePart(name, schedule) {
  const p = parts.get(name) || { armed: false };
  p.schedule = schedule; parts.set(name, p);
}

export function arm(name, on) {
  const p = parts.get(name); if (!p) return;
  p.armed = on;
  const any = [...parts.values()].some((x) => x.armed);
  if (any && !t.running) start();
  if (!any && t.running) stop();
  runFns.forEach((fn) => fn(t.running));
}

function start() {
  const ac = audio(); if (!ac) return;
  t.running = true; t.step = 0; t.next = ac.currentTime + 0.06;
  clearInterval(t.timer); t.timer = setInterval(tick, 25); tick();
}
function stop() {
  clearInterval(t.timer); t.timer = 0; t.running = false;
  stepFns.forEach((fn) => fn(-1));
}
function tick() {
  const ac = audio();
  while (t.next < ac.currentTime + 0.12) {
    const i = t.step % 16, abs = t.step, time = t.next, dur = 60 / t.bpm / 4;
    for (const p of parts.values()) if (p.armed) p.schedule?.(i, time, dur, abs);
    const delay = Math.max(0, (time - ac.currentTime) * 1000);
    setTimeout(() => { if (t.running) stepFns.forEach((fn) => fn(i, abs, time, dur)); }, delay);
    t.next += dur; t.step++;
  }
}
