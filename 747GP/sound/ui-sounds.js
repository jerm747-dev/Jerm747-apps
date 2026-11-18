// 747 GP — UI sounds (chimes, clicks, pause/resume, zooms)
// ------------------------------------------------------------------
// Pure math: each sound renders into Float32Arrays [L, R] at any sample
// rate. gp-audio.js renders them once into AudioBuffers at startup
// (no audio files to ship), and tools/render-previews.mjs uses the same
// code to export WAV/MP3 previews.
//
// Palette: low, warm FM "boops" tuned to a D-major / A feel, so every
// chime agrees with every other chime. Clicks are short high ticks.
// ------------------------------------------------------------------

const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const note = (name) => {
  const m = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const [, l, acc, oct] = name.match(/([A-G])(#|b)?(\d)/);
  const semi = m[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + (parseInt(oct, 10) - 4) * 12;
  return 440 * Math.pow(2, semi / 12);
};

function buf(sr, sec) { return new Float32Array(Math.ceil(sr * sec)); }

// warm FM boop: sine carrier, 2:1 modulator whose brightness decays fast
function boop(out, sr, at, f, { dur = 0.9, decay = 0.32, index = 1.2, ratio = 2, glide = 0.03, amp = 0.5, sub = 0.25, pan = 0 } = {}) {
  const start = Math.floor(at * sr), n = Math.min(out[0].length - start, Math.floor(dur * sr));
  let pc = 0, pm = 0, ps = 0;
  const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fi = f * (1 - glide * Math.exp(-t / 0.035));
    const I = index * Math.exp(-t / 0.08);
    pm += fi * ratio / sr; pc += fi / sr; ps += fi * 0.5 / sr;
    const atk = Math.min(1, t / 0.006);
    const env = atk * atk * Math.exp(-t / decay);
    const tail = Math.min(1, (n - i) / (sr * 0.02));
    const s = (Math.sin(TAU * pc + I * Math.sin(TAU * pm)) + sub * Math.sin(TAU * ps)) * env * amp * tail;
    out[0][start + i] += s * gl;
    out[1][start + i] += s * gr;
  }
}

// short tick: fast pitch-dropping sine + 2 ms noise transient
function tick(out, sr, at, f0, f1, { amp = 0.45, decay = 0.007, noise = 0.25, seed = 1 } = {}) {
  const start = Math.floor(at * sr), n = Math.min(out[0].length - start, Math.floor(0.05 * sr));
  const r = rng(seed); let ph = 0, hp = 0, px = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.004);
    ph += f / sr;
    const env = Math.min(1, t / 0.0005) * Math.exp(-t / decay);
    const w = r(); hp = 0.6 * (hp + w - px); px = w;
    const nz = hp * noise * Math.exp(-t / 0.0015);
    const s = (Math.sin(TAU * ph) * env + nz) * amp;
    out[0][start + i] += s; out[1][start + i] += s;
  }
}

// state-variable band-pass noise sweep (the "zoom" / whoosh)
function whoosh(out, sr, at, dur, fA, fB, { amp = 0.35, q = 2.2, seed = 7, curve = 1 } = {}) {
  const start = Math.floor(at * sr), n = Math.min(out[0].length - start, Math.floor(dur * sr));
  const rL = rng(seed), rR = rng(seed + 99);
  const st = [[0, 0], [0, 0]];
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const f = fA * Math.pow(fB / fA, Math.pow(x, curve));
    const g = Math.tan(Math.PI * Math.min(f, sr * 0.45) / sr), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1;
    const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 2;
    [rL(), rR()].forEach((w, c) => {
      const s = st[c];
      const v1 = a1 * s[0] + a2 * (w - s[1]);
      const v2 = s[1] + g * v1;
      s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1];
      out[c][start + i] += v1 * env * amp;
    });
  }
}

// tonal sweep (pause = down, resume = up), triangle-ish through a closing/opening low-pass
function sweep(out, sr, at, dur, fA, fB, { amp = 0.3, lpA = 6000, lpB = 500 } = {}) {
  const start = Math.floor(at * sr), n = Math.min(out[0].length - start, Math.floor(dur * sr));
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const f = fA * Math.pow(fB / fA, x * x * (3 - 2 * x));
    ph += f / sr;
    const p = ph % 1;
    const tri = 1 - 4 * Math.abs(p - 0.5);
    const raw = 0.7 * Math.sin(TAU * ph) + 0.3 * tri;
    const fc = lpA * Math.pow(lpB / lpA, x);
    const c = 1 - Math.exp(-TAU * fc / sr);
    lp += (raw - lp) * c;
    const env = Math.min(1, x / 0.08) * Math.min(1, (1 - x) / 0.25);
    out[0][start + i] += lp * env * amp; out[1][start + i] += lp * env * amp;
  }
}

function normalize(out, peak = 0.8) {
  let m = 0;
  for (const ch of out) for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
  if (m > 0) { const g = peak / m; for (const ch of out) for (let i = 0; i < ch.length; i++) ch[i] *= g; }
  return out;
}

// --- the sound list -------------------------------------------------
// [length in seconds, render function, peak level]
const DEFS = {
  // feel-good chimes (low and warm)
  'chime.soft':    [0.9, (o, sr) => boop(o, sr, 0, note('A3'), { decay: 0.3 }), 0.6],
  'chime.confirm': [1.0, (o, sr) => { boop(o, sr, 0, note('D4'), { decay: 0.22, pan: -0.15 }); boop(o, sr, 0.085, note('A4'), { decay: 0.32, pan: 0.15 }); }, 0.62],
  'chime.good':    [1.3, (o, sr) => ['D4', 'F#4', 'A4', 'C#5'].forEach((nm, i) => boop(o, sr, i * 0.07, note(nm), { decay: 0.45, index: 0.9, amp: 0.4, pan: -0.3 + i * 0.2 })), 0.65],
  'chime.best':    [1.8, (o, sr) => {
      ['D3', 'A3', 'D4', 'F#4', 'A4'].forEach((nm, i) => boop(o, sr, i * 0.075, note(nm), { decay: 0.6, index: 1.0, amp: 0.38, pan: -0.4 + i * 0.2 }));
      boop(o, sr, 0.38, note('D5'), { decay: 0.7, index: 2.2, ratio: 3.5, amp: 0.22 });  // shimmer
    }, 0.7],
  'chime.back':    [0.9, (o, sr) => { boop(o, sr, 0, note('A3'), { decay: 0.18 }); boop(o, sr, 0.08, note('D3'), { decay: 0.3, sub: 0.35 }); }, 0.6],

  // menu clicks
  'click.up':      [0.06, (o, sr) => tick(o, sr, 0, 3400, 2600, { seed: 11 }), 0.5],
  'click.down':    [0.06, (o, sr) => tick(o, sr, 0, 2300, 1700, { seed: 12 }), 0.5],
  'click.select':  [0.25, (o, sr) => { tick(o, sr, 0, 1800, 1300, { decay: 0.01, seed: 13 }); boop(o, sr, 0.004, note('D4'), { dur: 0.22, decay: 0.05, index: 0.6, amp: 0.3 }); }, 0.6],

  // pause / resume — a zoom down into a low boop, and back up into a tick
  'pause':         [0.75, (o, sr) => {
      sweep(o, sr, 0, 0.32, 880, 140, { lpA: 7000, lpB: 600 });
      whoosh(o, sr, 0, 0.34, 3500, 400, { amp: 0.22, curve: 0.7 });
      boop(o, sr, 0.28, note('D3'), { decay: 0.22, sub: 0.4, amp: 0.45 });
    }, 0.65],
  'resume':        [0.55, (o, sr) => {
      sweep(o, sr, 0, 0.3, 140, 880, { lpA: 600, lpB: 7000 });
      whoosh(o, sr, 0, 0.32, 400, 3500, { amp: 0.22, curve: 1.4 });
      tick(o, sr, 0.29, 3400, 2600, { seed: 14 });
      boop(o, sr, 0.29, note('A4'), { decay: 0.12, amp: 0.25 });
    }, 0.65],

  // camera / screen zooms
  'zoom.in':       [0.45, (o, sr) => whoosh(o, sr, 0, 0.42, 300, 4200, { curve: 1.3 }), 0.55],
  'zoom.out':      [0.45, (o, sr) => whoosh(o, sr, 0, 0.42, 4200, 300, { curve: 0.75 }), 0.55],
};

export const UI_SOUND_NAMES = Object.keys(DEFS);

export function renderUISound(name, sr = 48000) {
  const d = DEFS[name];
  if (!d) throw new Error(`747GP sound: unknown UI sound "${name}"`);
  const out = [buf(sr, d[0]), buf(sr, d[0])];
  d[1](out, sr);
  return normalize(out, d[2]);
}
