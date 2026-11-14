// The synth drum kit from the Returnity beat pad, rewired so each hit goes to a channel
// (destination) instead of straight to the master, plus a sample player for library clips.
let noiseBuf = null;
function noise(ac) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
}

export const VOICES = {
  kick(ac, dest, t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.6); },
  clap(ac, dest, t) { const s = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; g.gain.setValueAtTime(0.0001, t); [0, 0.012, 0.024].forEach((d) => { g.gain.setValueAtTime(0.65, t + d); g.gain.exponentialRampToValueAtTime(0.08, t + d + 0.01); }); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 0.25); },
  hat(ac, dest, t) { const s = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(0.17, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 0.08); },
  open(ac, dest, t) { const s = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 6500; g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 0.28); },
  bass(ac, dest, t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 55; g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.5); },
  rim(ac, dest, t) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 1700; f.type = 'bandpass'; f.frequency.value = 2200; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.connect(f).connect(g).connect(dest); o.start(t); o.stop(t + 0.05); },
};
// Extra kit: more drums to swap onto any row.
const tone = (ac, dest, t, { type = 'sine', f0, f1, len, gain = 0.6 }) => {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.7);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.02);
};
const hiss = (ac, dest, t, { type = 'highpass', f, q = 0.7, len, gain = 0.3 }) => {
  const s = noise(ac), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(fl).connect(g).connect(dest); s.start(t); s.stop(t + Math.min(len + 0.02, 0.5));
};
Object.assign(VOICES, {
  snare(ac, dest, t) { tone(ac, dest, t, { type: 'triangle', f0: 220, f1: 160, len: 0.12, gain: 0.5 }); hiss(ac, dest, t, { type: 'highpass', f: 1800, len: 0.2, gain: 0.45 }); },
  boom(ac, dest, t) { tone(ac, dest, t, { f0: 70, f1: 40, len: 1.1, gain: 0.95 }); tone(ac, dest, t, { type: 'square', f0: 900, len: 0.008, gain: 0.25 }); },
  tomLo(ac, dest, t) { tone(ac, dest, t, { f0: 140, f1: 85, len: 0.4, gain: 0.7 }); },
  tomMid(ac, dest, t) { tone(ac, dest, t, { f0: 200, f1: 130, len: 0.34, gain: 0.65 }); },
  tomHi(ac, dest, t) { tone(ac, dest, t, { f0: 290, f1: 190, len: 0.28, gain: 0.6 }); },
  conga(ac, dest, t) { tone(ac, dest, t, { f0: 380, f1: 330, len: 0.2, gain: 0.55 }); },
  cowbell(ac, dest, t) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2; f.connect(dest); tone(ac, f, t, { type: 'square', f0: 562, len: 0.3, gain: 0.5 }); tone(ac, f, t, { type: 'square', f0: 845, len: 0.3, gain: 0.5 }); },
  shaker(ac, dest, t) { hiss(ac, dest, t, { type: 'bandpass', f: 6000, q: 1.2, len: 0.09, gain: 0.35 }); },
  snap(ac, dest, t) { hiss(ac, dest, t, { type: 'bandpass', f: 2600, q: 3, len: 0.07, gain: 0.8 }); },
  crash(ac, dest, t) { const s = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(); s.loop = true; f.type = 'highpass'; f.frequency.value = 5000; g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4); s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 1.45); },
  zap(ac, dest, t) { tone(ac, dest, t, { type: 'sawtooth', f0: 1600, f1: 90, len: 0.18, gain: 0.3 }); },
});

export const VOICE_NAMES = { kick: 'Kick', clap: 'Clap', hat: 'Hat', open: 'Open hat', bass: 'Bass', rim: 'Rim' };
export const EXTRA_NAMES = { snare: 'Snare', boom: '808 Boom', tomLo: 'Low tom', tomMid: 'Mid tom', tomHi: 'High tom', conga: 'Conga', cowbell: 'Cowbell', shaker: 'Shaker', snap: 'Snap', crash: 'Crash', zap: 'Zap' };
export const ALL_VOICE_NAMES = { ...VOICE_NAMES, ...EXTRA_NAMES };

/** One-shot of a library clip. Returns the source so callers can stop it. */
export function playSample(ac, dest, buffer, t, { rate = 1, gain = 1, maxLen } = {}) {
  const s = ac.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest);
  s.start(t);
  if (maxLen) { g.gain.setValueAtTime(gain, t + maxLen - 0.01); g.gain.linearRampToValueAtTime(0, t + maxLen); s.stop(t + maxLen + 0.02); }
  return s;
}
