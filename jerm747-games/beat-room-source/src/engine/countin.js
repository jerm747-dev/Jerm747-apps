// Count-in: a bar (or two) of clicks before a recording starts, with a big countdown on screen.
// The clicks go to the monitor path, so the tape never records them. Returns the audio time of
// the downbeat, so whatever starts after the count (the transport, a tape take) lands on it exactly.
import { audio, monitorOut, getSettings } from './audio.js';
import { getBpm } from './clock.js';

let state = { n: 0, label: '' };   // n = beats left (0 = no countdown showing)
const subs = new Set();
const timers = [];
let running = false; // a clicked count-in is in progress
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => state;
const set = (s) => { state = s; subs.forEach((fn) => fn(state)); };

function click(ac, time, accent) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(accent ? 0.24 : 0.15, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  o.connect(g).connect(monitorOut()); o.start(time); o.stop(time + 0.06);
}

/** Beats of count-in from Settings (0, 4 or 8). */
export const beats = () => Math.max(0, Math.min(2, getSettings().countIn | 0)) * 4;

/** Is a count-in running right now? */
export const active = () => running;

/** Cancel a running count-in (the countdown disappears; clicks already booked still sound). */
export function cancel() { timers.splice(0).forEach(clearTimeout); running = false; set({ n: 0, label: '' }); }

/**
 * Start a count-in now. label shows under the number ("Tape", "Pads", "Synth").
 * Returns the downbeat's audio time (now + a hair when the count-in is off).
 */
export function run(label = '') {
  const ac = audio(); if (!ac) return 0;
  cancel();
  const n = beats(), beat = 60 / getBpm(), t0 = ac.currentTime + 0.08;
  if (!n) return t0;
  running = true;
  for (let i = 0; i < n; i++) {
    const time = t0 + i * beat;
    click(ac, time, i % 4 === 0);
    timers.push(setTimeout(() => set({ n: n - i, label }), Math.max(0, (time - ac.currentTime) * 1000)));
  }
  const down = t0 + n * beat;
  timers.push(setTimeout(() => { running = false; set({ n: 0, label: '' }); }, Math.max(0, (down - ac.currentTime) * 1000)));
  return down;
}

/** Show a countdown without clicks (used while waiting for the top of a playing loop). */
export function show(n, label = '') { if (n !== state.n || label !== state.label) set({ n, label }); }
