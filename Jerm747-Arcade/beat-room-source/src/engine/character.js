// 747 Drive: the Beat Room's own master "character" stage, between the bus and the master fader.
// Built in the spirit of transformer-coupled class-A consoles: drive the input and it rounds
// off peaks with mostly 2nd-harmonic color, the low end saturates first (the "iron"), an air
// band opens the very top, and a slow bus compressor glues it together. Our design, our names.
//
//   bus -> drive gain -> iron pre-emphasis -> asymmetric saturator (4x oversampled)
//       -> iron de-emphasis -> warmth (top roll-off) -> air shelf -> glue comp -> trim -> master
//
// Modes are starting points; every control can be moved after picking one.
const KEY = 'beatroom.drive';

export const MODES = {
  clean: { name: 'Clean', drive: 0, iron: 0, warmth: 0, air: 0, glue: false },
  warm: { name: 'Warm', drive: 0.3, iron: 0.25, warmth: 0.35, air: 0, glue: false },
  iron: { name: 'Iron', drive: 0.5, iron: 0.7, warmth: 0.25, air: 0, glue: true },
  747: { name: '747', drive: 0.62, iron: 0.5, warmth: 0.15, air: 1, glue: true },
};
export const AIR_STEPS = [0, 1, 2]; // off, +3 dB, +6 dB around 16 kHz

const DEF = { on: false, mode: '747', ...MODES[747], out: 0 };
let st = load();
let nodes = null;
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => st;

function load() {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEF }; }
}
let saveT = 0;
function commit(next) {
  st = next; apply();
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage off */ } }, 250);
  subs.forEach((fn) => fn(st));
}

/** Asymmetric soft clip, normalized to unity gain for small signals. bias tilts it toward even harmonics. */
function curve(k, bias) {
  const n = 2048, c = new Float32Array(n);
  const t = Math.tanh, off = t(k * bias), slope = k * (1 - off * off);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = (t(k * (x + bias)) - off) / slope;
  }
  // keep the top of the curve inside ±1 so it never runs away
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(c[i]));
  if (m > 1) for (let i = 0; i < n; i++) c[i] /= m;
  return c;
}

/** Build the chain once, inside the shared AudioContext. Returns { input, output }. */
export function build(ac) {
  const input = ac.createGain();
  const pre = ac.createGain();
  const emph = ac.createBiquadFilter(); emph.type = 'lowshelf'; emph.frequency.value = 110;
  const shaper = ac.createWaveShaper();
  const deemph = ac.createBiquadFilter(); deemph.type = 'lowshelf'; deemph.frequency.value = 110;
  const warmth = ac.createBiquadFilter(); warmth.type = 'highshelf'; warmth.frequency.value = 9000;
  const air = ac.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 14000;
  const glue = ac.createDynamicsCompressor();
  const trim = ac.createGain();
  input.connect(pre).connect(emph).connect(shaper).connect(deemph).connect(warmth).connect(air).connect(glue).connect(trim);
  nodes = { ac, input, pre, emph, shaper, deemph, warmth, air, glue, trim, k: -1 };
  apply(true);
  return { input, output: trim };
}

function apply(now = false) {
  if (!nodes) return;
  const n = nodes, t = n.ac.currentTime, tc = now ? 0 : 0.03;
  const set = (p, v) => (now ? (p.value = v) : p.setTargetAtTime(v, t, tc));
  const on = st.on;
  const drive = on ? st.drive : 0;
  const ironDb = on ? st.iron * 9 : 0;
  // drive: up to +18 dB into the curve; trim gives most of it back so the level stays steady
  const driveDb = drive * 18;
  set(n.pre.gain, Math.pow(10, driveDb / 20));
  set(n.emph.gain, ironDb); set(n.deemph.gain, -ironDb);
  set(n.warmth.gain, on ? -st.warmth * 6 : 0);
  set(n.air.gain, on ? st.air * 3 : 0);
  const k = on && (drive > 0.001 || ironDb > 0) ? 1 + drive * 3.5 : 0;
  if (k !== n.k) {
    n.k = k;
    if (k) { n.shaper.curve = curve(k, 0.18 + st.iron * 0.12); n.shaper.oversample = '4x'; }
    else { n.shaper.curve = null; n.shaper.oversample = 'none'; }
  }
  // glue: slow attack, auto-ish release, gentle ratio; off = ratio 1
  const g = on && st.glue;
  set(n.glue.threshold, g ? -14 : 0); set(n.glue.ratio, g ? 3 : 1); set(n.glue.knee, g ? 8 : 0);
  set(n.glue.attack, g ? 0.03 : 0.003); set(n.glue.release, g ? 0.3 : 0.25);
  const makeup = (g ? 2.5 : 0) - driveDb * 0.82 + (on ? st.out * 12 : 0);
  set(n.trim.gain, Math.pow(10, makeup / 20));
}

export const setOn = (on) => commit({ ...st, on });
export const setMode = (mode) => MODES[mode] && commit({ ...st, ...MODES[mode], mode, on: mode === 'clean' ? st.on : true });
export const set = (change) => commit({ ...st, ...change });
/** Live reduction from the glue comp in dB (0 when idle), for the meter. */
export const reduction = () => (nodes && st.on && st.glue ? nodes.glue.reduction : 0);
