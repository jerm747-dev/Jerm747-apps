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
export const VOICE_NAMES = { kick: 'Kick', clap: 'Clap', hat: 'Hat', open: 'Open hat', bass: 'Bass', rim: 'Rim' };

/** One-shot of a library clip. Returns the source so callers can stop it. */
export function playSample(ac, dest, buffer, t, { rate = 1, gain = 1, maxLen } = {}) {
  const s = ac.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest);
  s.start(t);
  if (maxLen) { g.gain.setValueAtTime(gain, t + maxLen - 0.01); g.gain.linearRampToValueAtTime(0, t + maxLen); s.stop(t + maxLen + 0.02); }
  return s;
}
