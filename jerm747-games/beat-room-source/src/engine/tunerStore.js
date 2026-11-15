// Tuner state that lives outside the pop-up, so it keeps listening while the pop-up is closed and
// the top-bar button can show the note. Reads the mic about 20 times a second.
import { audio } from './audio.js';
import { micAnalyser, micError, releaseMic } from './mic.js';
import { detectPitch, noteFor } from './pitch.js';

let st = { on: false, read: null, err: '' }; // read: { name, octave, cents, hz }
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => st;
const set = (c) => { st = { ...st, ...c }; subs.forEach((fn) => fn(st)); };

let an = null, buf = null, timer = 0, hist = [];
function tick() {
  if (!an) return;
  an.getFloatTimeDomainData(buf);
  const hz = detectPitch(buf, audio().sampleRate);
  if (!hz) { hist = []; return; }
  hist = [...hist, hz].slice(-5);
  const med = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
  set({ read: { ...noteFor(med), hz: med } });
}

export async function start() {
  if (st.on) return;
  set({ err: '' });
  try {
    an = await micAnalyser('tuner'); buf = new Float32Array(an.fftSize);
    clearInterval(timer); timer = setInterval(tick, 50);
    set({ on: true, read: null });
  } catch (e) { set({ err: micError(e) }); }
}
export function stop() {
  clearInterval(timer); timer = 0; an = null; hist = [];
  releaseMic('tuner');
  set({ on: false, read: null });
}
export const toggle = () => (st.on ? stop() : start());
