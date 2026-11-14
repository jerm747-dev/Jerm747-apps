// Cutting the record: turns a library clip into the "groove" the turntable plays.
//
// 1. RIAA pre-emphasis. Real records are cut with the treble boosted and the bass cut; the phono
//    stage (in the deck worklet) undoes it. At normal speed the round trip is flat. When you slow
//    the record by hand, the boosted treble slides down into the range the preamp cuts, so the
//    sound goes darker and bassier; speed it up and it brightens. That's the vinyl scratch tone.
// 2. Dust in the groove: crackle, pops and groove hiss are added after the pre-emphasis, as part of
//    the record, so they slow down, speed up and reverse with your hand, and the phono stage
//    softens them the way it does on a real record.
// 3. Filtered copies (half and quarter bandwidth) for fast moves, so whipping the record doesn't
//    fold harsh aliases back into the sound (DJ software does the same).
//
// RIAA time constants: 3180 µs, 318 µs, 75 µs.
export const T1 = 3180e-6, T2 = 318e-6, T3 = 75e-6;
export const DUST = { off: 'Clean', light: 'Light', heavy: 'Dusty' };

// first-order analog section (b1·s + b0)/(a1·s + a0), bilinear at rate sr
function sect(b1, b0, a1, a0, sr) {
  const K = 2 * sr, B0 = b0 + b1 * K, B1 = b0 - b1 * K, A0 = a0 + a1 * K, A1 = a0 - a1 * K;
  return { b0: B0 / A0, b1: B1 / A0, a1: A1 / A0 };
}
const magAt = (secs, f) => secs.reduce((m, [b1, b0, a1, a0]) => {
  const w = 2 * Math.PI * f;
  return m * Math.hypot(b0, b1 * w) / Math.hypot(a0, a1 * w);
}, 1);

/** RIAA recording (pre-emphasis) as first-order sections, unity at 1 kHz. */
export function preEmphasis(sr) {
  const T4 = 1 / (2 * Math.PI * Math.min(20000, 0.42 * sr)); // keeps the boost finite near the top
  const an = [[T1, 1, T2, 1], [T3, 1, T4, 1]];
  return { secs: an.map((a) => sect(...a, sr)), gain: 1 / magAt(an, 1000) };
}
/** RIAA playback (de-emphasis), unity at 1 kHz. Used inside the deck worklet too. */
export function deEmphasis(sr) {
  const an = [[T2, 1, T1, 1], [0, 1, T3, 1]];
  return { secs: an.map((a) => sect(...a, sr)), gain: 1 / magAt(an, 1000) };
}

function runSections(x, { secs, gain }) {
  const y = new Float32Array(x.length);
  y.set(x);
  for (const s of secs) {
    let x1 = 0, y1 = 0;
    for (let i = 0; i < y.length; i++) { const xi = y[i], yi = s.b0 * xi + s.b1 * x1 - s.a1 * y1; x1 = xi; y1 = yi; y[i] = yi; }
  }
  for (let i = 0; i < y.length; i++) y[i] *= gain;
  return y;
}

// zero-phase low-pass (two passes of a 2-pole Butterworth), so the copies line up for blending
function lowpassZero(x, fc, sr) {
  const w = Math.tan((Math.PI * fc) / sr), q = Math.SQRT1_2, n = 1 / (1 + w / q + w * w);
  const b0 = w * w * n, b1 = 2 * b0, b2 = b0, a1 = 2 * (w * w - 1) * n, a2 = (1 - w / q + w * w) * n;
  const pass = (src, rev) => {
    const out = new Float32Array(src.length), N = src.length;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let k = 0; k < N; k++) {
      const i = rev ? N - 1 - k : k, xi = src[i], yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = yi; out[i] = yi;
    }
    return out;
  };
  return pass(pass(x, false), true);
}

// deterministic noise so the same record always has the same dust
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function addDust(L, R, sr, kind, seed) {
  if (kind === 'off') return;
  const r = rng(seed), heavy = kind === 'heavy';
  const rate = heavy ? 22 : 6, hiss = heavy ? 0.0035 : 0.0012, n = L.length;
  // groove hiss (very soft, slightly different per side)
  for (let i = 0; i < n; i++) { L[i] += (r() - 0.5) * hiss; R[i] += (r() - 0.5) * hiss; }
  // crackle: short decaying bursts, the odd bigger pop
  let t = 0;
  while (true) {
    t += -Math.log(1 - r()) / rate; const at = Math.floor(t * sr); if (at >= n) break;
    const pop = r() < (heavy ? 0.06 : 0.03);
    const amp = (pop ? 0.12 + r() * 0.12 : 0.012 + r() * (heavy ? 0.05 : 0.025)) * (r() < 0.5 ? -1 : 1);
    const len = Math.floor(sr * (pop ? 0.0015 + r() * 0.002 : 0.0002 + r() * 0.0009)), pan = r();
    for (let k = 0; k < len && at + k < n; k++) {
      const e = amp * Math.exp((-5 * k) / len) * (k % 2 ? -0.6 : 1);
      L[at + k] += e * (0.6 + 0.4 * pan); R[at + k] += e * (1 - 0.4 * pan);
    }
  }
}

/**
 * Cut a clip into a playable groove. Returns { levels: [[L,R], [L,R]?, [L,R]?], analog }.
 * analog: apply RIAA pre-emphasis (the worklet's phono stage must be on to match).
 */
export function cutRecord(buffer, { analog = true, dust = 'light', seed = 747 } = {}) {
  const sr = buffer.sampleRate;
  const src0 = buffer.getChannelData(0), src1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : src0;
  let L, R;
  if (analog) { const pe = preEmphasis(sr); L = runSections(src0, pe); R = src1 === src0 ? L.slice() : runSections(src1, pe); }
  else { L = src0.slice(); R = src1.slice(); }
  addDust(L, R, sr, analog ? dust : 'off', seed);
  const levels = [[L, R]];
  // filtered copies for fast hand moves (skipped on very long clips to save memory)
  if (buffer.duration <= 90) {
    levels.push([lowpassZero(L, sr * 0.22, sr), lowpassZero(R, sr * 0.22, sr)]);
    levels.push([lowpassZero(L, sr * 0.11, sr), lowpassZero(R, sr * 0.11, sr)]);
  }
  return { levels, analog };
}
