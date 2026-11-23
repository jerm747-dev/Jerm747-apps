// Drumway: the MIDI Lane drum synth. Eight 909-flavored voices, all synthesized (no samples),
// each with a few shaping knobs. General MIDI drum notes map onto them, so drum parts from any
// MIDI file (channel 10) play straight away. Closed hat chokes the open hat, like the hardware.
import { noise, mtof } from './audio.js';

export const VOICES = {
  kick: { name: 'Kick', note: 36, knobs: { tune: 0.45, decay: 0.45, punch: 0.6, drive: 0.25, level: 0.9 } },
  snare: { name: 'Snare', note: 38, knobs: { tune: 0.5, decay: 0.4, tone: 0.55, snap: 0.6, level: 0.75 } },
  tom: { name: 'Tom', note: 45, knobs: { tune: 0.45, decay: 0.45, level: 0.7 } },
  ch: { name: 'Closed hat', note: 42, knobs: { tune: 0.5, decay: 0.3, tone: 0.6, level: 0.55 } },
  oh: { name: 'Open hat', note: 46, knobs: { tune: 0.5, decay: 0.45, tone: 0.6, level: 0.5 } },
  ride: { name: 'Ride', note: 51, knobs: { tune: 0.5, decay: 0.55, tone: 0.5, level: 0.4 } },
  crash: { name: 'Crash', note: 49, knobs: { tune: 0.5, decay: 0.55, tone: 0.5, level: 0.45 } },
  bell: { name: 'Cowbell', note: 56, knobs: { tune: 0.5, decay: 0.35, level: 0.45 } },
};
export const KNOB_NAMES = { tune: 'Tune', decay: 'Decay', punch: 'Punch', drive: 'Drive', tone: 'Tone', snap: 'Snap', level: 'Level' };
// Rhythm Lane rows, top to bottom (two toms: high and low)
export const KIT_ROWS = [49, 51, 56, 46, 42, 50, 45, 38, 36];
const GM = { 35: 'kick', 36: 'kick', 37: 'snare', 38: 'snare', 39: 'snare', 40: 'snare', 41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom',
  42: 'ch', 44: 'ch', 46: 'oh', 49: 'crash', 52: 'crash', 55: 'crash', 57: 'crash', 51: 'ride', 53: 'ride', 59: 'ride', 56: 'bell' };
export const GM_NAMES = { 35: 'Kick 2', 36: 'Kick', 37: 'Rim', 38: 'Snare', 39: 'Clap', 40: 'Snare 2', 41: 'Floor tom', 42: 'Closed hat', 43: 'Floor tom 2',
  44: 'Pedal hat', 45: 'Low tom', 46: 'Open hat', 47: 'Mid tom', 48: 'Hi-mid tom', 49: 'Crash', 50: 'High tom', 51: 'Ride', 52: 'China',
  53: 'Ride bell', 54: 'Tambourine', 55: 'Splash', 56: 'Cowbell', 57: 'Crash 2', 59: 'Ride 2' };
export const voiceFor = (n) => GM[n] || (n < 45 ? 'tom' : n < 60 ? 'bell' : 'tom');
export const drumName = (n) => GM_NAMES[n] || `Note ${n}`;

const kit = (name, over = {}) => {
  const voices = {};
  for (const [k, v] of Object.entries(VOICES)) voices[k] = { ...v.knobs, ...(over[k] || {}) };
  return { name, tune: 0.5, decay: 0.5, voices, vol: 0.85 };
};
export const KITS = [
  kit('Runway 909'),
  kit('Tight', { kick: { decay: 0.3, punch: 0.8 }, snare: { decay: 0.25, snap: 0.8 }, ch: { decay: 0.15 }, oh: { decay: 0.3 } }),
  kit('Boom', { kick: { tune: 0.25, decay: 0.85, punch: 0.4, drive: 0.4 }, tom: { tune: 0.3, decay: 0.7 }, snare: { tune: 0.35, decay: 0.55 } }),
  kit('Lo-fi', { kick: { drive: 0.7 }, snare: { tone: 0.25 }, ch: { tone: 0.2 }, oh: { tone: 0.2 }, ride: { tone: 0.2 }, crash: { tone: 0.25 } }),
];
export const defaultKit = () => JSON.parse(JSON.stringify(KITS[0]));

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]; // six square oscillators, the classic metal stack

export class Drumway {
  constructor(c, dest) { this.c = c; this.dest = dest; this.p = defaultKit(); this.open = null; this.live = new Set(); }
  setPatch(p) { this.p = p; }
  play(n, vel, t) {
    const key = voiceFor(n), k = this.p.voices[key] || VOICES[key].knobs;
    const v = (vel / 127) * k.level * 1.1;
    const tune = (k.tune - 0.5) + (this.p.tune - 0.5);           // -1..1 → about ±1 octave
    const dec = (x) => x * (0.5 + this.p.decay);                  // kit-wide decay scale
    const out = this.c.createGain(); out.connect(this.dest);
    const tomShift = key === 'tom' ? ({ 41: -7, 43: -5, 45: 0, 47: 3, 48: 5, 50: 7 }[n] ?? 0) : 0;
    const len = this[key](t, k, v, Math.pow(2, tune), dec, out, tomShift);
    const end = t + len + 0.05;
    const h = { out, end }; this.live.add(h);
    setTimeoutAt(this.c, end, () => { this.live.delete(h); try { out.disconnect(); } catch { /* gone */ } });
  }
  stopAll() { const t = this.c.currentTime; this.live.forEach((h) => h.out.gain.setTargetAtTime(0, t, 0.01)); this.live.clear(); }

  env(g, t, peak, len) { g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len); }
  kick(t, k, v, ratio, dec, out) {
    const c = this.c, base = 38 * ratio * (0.8 + k.tune * 0.6), len = dec(0.12 + k.decay * 1.0);
    const o = c.createOscillator(), g = c.createGain(), sh = c.createWaveShaper();
    const kk = 1 + k.drive * 6, n = 1024, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cv[i] = Math.tanh(kk * x) / Math.tanh(kk); }
    sh.curve = cv;
    o.frequency.setValueAtTime(base * 6, t); o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.014);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.09);
    this.env(g, t, v, len); o.connect(sh).connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
    if (k.punch > 0.02) { // click
      const s = noise(c), f = c.createBiquadFilter(), cg = c.createGain(); f.type = 'highpass'; f.frequency.value = 1200;
      this.env(cg, t, v * k.punch * 0.7, 0.012); s.connect(f).connect(cg).connect(out); s.start(t); s.stop(t + 0.03);
    }
    return len;
  }
  snare(t, k, v, ratio, dec, out) {
    const c = this.c, f1 = 165 * ratio, body = dec(0.05 + k.decay * 0.14), len = dec(0.1 + k.decay * 0.4);
    [f1, f1 * 1.85].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
      this.env(g, t, v * (i ? 0.35 : 0.6), body); o.connect(g).connect(out); o.start(t); o.stop(t + body + 0.02);
    });
    const s = noise(c), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 700 + k.tone * 3500; lp.type = 'lowpass'; lp.frequency.value = 5000 + k.tone * 9000;
    this.env(g, t, v * k.snap * 0.8, len); s.connect(hp).connect(lp).connect(g).connect(out); s.start(t); s.stop(t + len + 0.02);
    return len;
  }
  tom(t, k, v, ratio, dec, out, shift) {
    const c = this.c, f = 95 * ratio * Math.pow(2, shift / 12), len = dec(0.15 + k.decay * 0.7);
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f * 1.7, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    this.env(g, t, v * 0.85, len); o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
    const s = noise(c), bp = c.createBiquadFilter(), ng = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 1;
    this.env(ng, t, v * 0.18, 0.05); s.connect(bp).connect(ng).connect(out); s.start(t); s.stop(t + 0.08);
    return len;
  }
  metal(t, scale, len, out, peak, bpF, hpF) {
    const c = this.c, mix = c.createGain(); mix.gain.value = 0.18;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bpF; bp.Q.value = 0.9;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpF;
    const g = c.createGain();
    METAL.forEach((f) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * scale; o.connect(mix); o.start(t); o.stop(t + len + 0.03); });
    mix.connect(bp).connect(hp).connect(g).connect(out);
    this.env(g, t, peak, len);
    return g;
  }
  ch(t, k, v, ratio, dec, out) {
    const len = dec(0.025 + k.decay * 0.12);
    if (this.open && this.open.t < t) { this.open.g.gain.cancelScheduledValues(t); this.open.g.gain.setTargetAtTime(0, t, 0.006); this.open = null; } // choke
    this.metal(t, 1.6 * ratio, len, out, v * 0.9, 10000, 5500 + k.tone * 3500);
    return len;
  }
  oh(t, k, v, ratio, dec, out) {
    const len = dec(0.12 + k.decay * 0.9);
    const g = this.metal(t, 1.6 * ratio, len, out, v * 0.8, 10000, 5500 + k.tone * 3500);
    this.open = { g, t };
    return len;
  }
  ride(t, k, v, ratio, dec, out) {
    const len = dec(0.4 + k.decay * 2.2);
    this.metal(t, 2.4 * ratio, len, out, v * 0.55, 7500 + k.tone * 3000, 3500 + k.tone * 2500);
    return len;
  }
  crash(t, k, v, ratio, dec, out) {
    const c = this.c, len = dec(0.6 + k.decay * 2.4);
    this.metal(t, 2 * ratio, len * 0.6, out, v * 0.4, 8000, 4000 + k.tone * 3000);
    const s = noise(c), hp = c.createBiquadFilter(), g = c.createGain(); s.loop = true;
    hp.type = 'highpass'; hp.frequency.value = 3500 + k.tone * 4500;
    this.env(g, t, v * 0.5, len); s.connect(hp).connect(g).connect(out); s.start(t); s.stop(t + len + 0.03);
    return len;
  }
  bell(t, k, v, ratio, dec, out) {
    const c = this.c, len = dec(0.08 + k.decay * 0.6), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2640 * ratio; bp.Q.value = 1.5;
    [540, 800].forEach((f) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * ratio; o.connect(bp); o.start(t); o.stop(t + len + 0.03); });
    g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(v * 0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    bp.connect(g).connect(out);
    return len;
  }
}

// cleanup timer that also works in an OfflineAudioContext (skip there: it's thrown away whole)
function setTimeoutAt(c, end, fn) {
  if (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext) return;
  setTimeout(fn, Math.max(0, (end - c.currentTime) * 1000) + 100);
}
export { mtof };
