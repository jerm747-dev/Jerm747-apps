// Avionyx: the MIDI Lane keys synth. Three oscillators from the Beat Room synth (wave, coarse,
// fine, level), but any of them can turn into an FM operator:
//   Mix      1 + 2 + 3 all heard
//   2→1      osc 2 modulates osc 1, osc 3 heard beside it
//   3→2→1    a chain: 3 bends 2, 2 bends 1
//   2+3→1    2 and 3 both bend 1
// then a resonant low-pass with its own envelope amount, and the amp ADSR.
import { mtof } from './audio.js';

export const WAVES = ['sawtooth', 'square', 'sine', 'triangle'];
export const WAVE_NAMES = { sawtooth: 'Saw', square: 'Square', sine: 'Sine', triangle: 'Tri' };
export const ALGOS = { mix: 'Mix', fm21: '2→1', fm321: '3→2→1', fm231: '2+3→1' };
export const envSec = (v, max) => 0.002 + v * v * max;

const osc = (wave, coarse = 0, fine = 0, level = 0.6, on = true) => ({ on, wave, coarse, fine, level });
const P = (name, algo, oscs, env, filt = {}, fm = {}) => ({
  name, algo, osc: oscs, env,
  filter: { cut: 0.85, res: 0.1, env: 0.2, ...filt },
  fm: { depth: 0.4, decay: 0.4, sus: 0.3, ...fm }, vol: 0.8,
});
export const PRESETS = [
  P('Init', 'mix', [osc('sawtooth', 0, 0, 0.7), osc('square', -12, 0, 0.4, false), osc('sine', 12, 0, 0.3, false)], { a: 0.05, d: 0.35, s: 0.7, r: 0.3 }),
  P('FM Keys', 'fm21', [osc('sine', 0, 0, 0.8), osc('sine', 0, 2, 0.55), osc('sine', 12, 0, 0.18)], { a: 0.02, d: 0.55, s: 0.35, r: 0.35 }, { cut: 0.92, env: 0 }, { depth: 0.38, decay: 0.32, sus: 0.18 }),
  P('Glass Bell', 'fm21', [osc('sine', 0, 0, 0.8), osc('sine', 19, 0, 0.7), osc('sine', 24, 0, 0.1, false)], { a: 0.01, d: 0.8, s: 0, r: 0.65 }, { cut: 1, env: 0 }, { depth: 0.55, decay: 0.55, sus: 0.1 }),
  P('Saw Lead', 'mix', [osc('sawtooth', 0, -7, 0.6), osc('sawtooth', 0, 7, 0.6), osc('square', 12, 0, 0.22)], { a: 0.04, d: 0.4, s: 0.75, r: 0.3 }, { cut: 0.72, res: 0.25, env: 0.3 }),
  P('Square Bass', 'mix', [osc('square', -12, 0, 0.7), osc('sawtooth', -12, 5, 0.4), osc('sine', -24, 0, 0.6)], { a: 0.02, d: 0.3, s: 0.5, r: 0.2 }, { cut: 0.55, res: 0.3, env: 0.45 }),
  P('FM Bass', 'fm321', [osc('sine', -12, 0, 0.9), osc('sine', -12, 0, 0.5), osc('sine', 0, 0, 0.3)], { a: 0.01, d: 0.4, s: 0.55, r: 0.15 }, { cut: 0.8, env: 0.1 }, { depth: 0.5, decay: 0.25, sus: 0.25 }),
  P('Sine Pad', 'mix', [osc('sine', 0, 0, 0.6), osc('sine', 12, 4, 0.35), osc('sawtooth', 0, -9, 0.16)], { a: 0.55, d: 0.6, s: 0.8, r: 0.65 }, { cut: 0.7, env: 0.1 }),
  P('Square Organ', 'mix', [osc('square', 0, 0, 0.35), osc('sine', 12, 0, 0.5), osc('sine', 19, 0, 0.35)], { a: 0.03, d: 0.2, s: 0.9, r: 0.15 }, { cut: 0.8 }),
  P('Pluck', 'mix', [osc('sawtooth', 0, 0, 0.65), osc('square', 0, 3, 0.3), osc('sine', -12, 0, 0.45)], { a: 0.02, d: 0.42, s: 0, r: 0.3 }, { cut: 0.5, res: 0.2, env: 0.6 }),
];
export const defaultPatch = () => JSON.parse(JSON.stringify(PRESETS[1]));

const PEAK = 0.24, MAX_VOICES = 28;

export class Avionyx {
  constructor(c, dest) { this.c = c; this.dest = dest; this.p = defaultPatch(); this.ends = []; this.live = new Set(); }
  setPatch(p) { this.p = p; }
  /** Schedule one note at audio time t for dur seconds. vel 1..127. */
  play(n, vel, t, dur) {
    const c = this.c, p = this.p;
    this.ends = this.ends.filter((e) => e > t);
    if (this.ends.length >= MAX_VOICES) return;
    const A = envSec(p.env.a, 3), D = envSec(p.env.d, 3), R = envSec(p.env.r, 5), S = p.env.s;
    const v = vel / 127, peak = PEAK * (0.35 + 0.65 * v);
    const f = mtof(n), end = t + dur + R * 1.3 + 0.05;
    this.ends.push(end);
    const amp = c.createGain(); amp.gain.value = 0;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass';
    const base = 60 * Math.pow(2, p.filter.cut * 8.4), top = Math.min(20000, base * Math.pow(2, p.filter.env * 6));
    filt.Q.value = 0.5 + p.filter.res * 16;
    filt.frequency.setValueAtTime(base, t);
    if (p.filter.env > 0.001) {
      filt.frequency.linearRampToValueAtTime(top, t + A);
      filt.frequency.setTargetAtTime(base + (top - base) * S, t + A, D / 3);
    }
    filt.connect(amp).connect(this.dest);
    const oscs = p.osc.map((o) => {
      const x = c.createOscillator(); x.type = o.wave;
      x.frequency.value = f; x.detune.value = o.coarse * 100 + o.fine;
      x.start(t); x.stop(end);
      return x;
    });
    const hz = (i) => f * Math.pow(2, (p.osc[i].coarse * 100 + p.osc[i].fine) / 1200);
    const mod = (from, to) => {
      const o = p.osc[from]; if (!o.on) return;
      const g = c.createGain(), dev = o.level * p.fm.depth * 9 * hz(from) * (0.5 + 0.5 * v);
      const md = envSec(p.fm.decay, 2.5);
      g.gain.setValueAtTime(dev, t); g.gain.setTargetAtTime(dev * p.fm.sus, t + 0.005, md / 3);
      oscs[from].connect(g).connect(oscs[to].frequency);
    };
    const hear = (i) => { const o = p.osc[i]; if (!o.on) return; const g = c.createGain(); g.gain.value = o.level; oscs[i].connect(g).connect(filt); };
    if (p.algo === 'fm21') { mod(1, 0); hear(0); hear(2); }
    else if (p.algo === 'fm321') { mod(2, 1); mod(1, 0); hear(0); }
    else if (p.algo === 'fm231') { mod(1, 0); mod(2, 0); hear(0); }
    else { hear(0); hear(1); hear(2); }
    const g = amp.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + A);
    g.setTargetAtTime(peak * S, t + A, D / 3);
    const off = t + Math.max(0.03, dur);
    g.setTargetAtTime(0, Math.max(off, t + 0.005), R / 4);
    const voice = { amp, oscs, end };
    this.live.add(voice);
    oscs[0].onended = () => { this.live.delete(voice); try { amp.disconnect(); } catch { /* gone */ } };
    return { release: () => { // let go of a held key (live input)
      const now = this.c.currentTime;
      try { amp.gain.cancelScheduledValues(now); amp.gain.setValueAtTime(amp.gain.value, now); amp.gain.setTargetAtTime(0, now, R / 4); oscs.forEach((o) => o.stop(now + R * 1.3 + 0.05)); } catch { /* ended */ }
    } };
  }
  /** Cut everything now (stop button). */
  stopAll() {
    const t = this.c.currentTime;
    this.live.forEach((vc) => { try { vc.amp.gain.cancelScheduledValues(t); vc.amp.gain.setTargetAtTime(0, t, 0.01); vc.oscs.forEach((o) => o.stop(t + 0.08)); } catch { /* gone */ } });
    this.live.clear(); this.ends = [];
  }
}
