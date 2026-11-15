// 747 Drive: the Beat Room's own master "character" stage, between the bus and the master fader.
// Built in the spirit of transformer-coupled class-A consoles: drive the input and it rounds
// off peaks with mostly 2nd-harmonic color, the low end saturates first (the "iron"), an air
// band opens the very top, and a slow bus compressor glues it together. Our design, our names.
//
//   bus -> drive gain -> iron pre-emphasis -> asymmetric saturator (4x oversampled)
//       -> iron de-emphasis -> warmth (top roll-off) -> air shelf -> glue comp -> trim
//       -> PUNCH -> master
//
// PUNCH is the arcade Game Music punch (a 125 Hz body lift into a tanh drive, mixed in parallel
// with the dry signal) followed by a transient shaper that lifts each hit's attack and lets the
// sustain sit back. The shaper is an AudioWorklet with no lookahead, so the parallel mix never
// combs; until it loads (or where worklets are missing) Punch is the parallel stage alone.
//
// Modes are starting points; every control stays fully adjustable after selecting a preset.
const KEY = 'beatroom.drive.v2'; // Preserve saved custom settings.

// The 747 preset starts at 25% Drive; the knob retains its full 0–100% range.
export const MODES = {
  clean: { name: 'Clean', drive: 0, iron: 0, warmth: 0, air: 0, glue: false },
  warm: { name: 'Warm', drive: 0.08, iron: 0.06, warmth: 0.12, air: 0, glue: false },
  iron: { name: 'Iron', drive: 0.14, iron: 0.2, warmth: 0.08, air: 0, glue: true },
  747: { name: '747', drive: 0.25, iron: 0.14, warmth: 0.05, air: 1, glue: true },
};
export const AIR_STEPS = [0, 1, 2]; // off, +3 dB, +6 dB around 16 kHz

const DEF = { on: false, mode: '747', ...MODES[747], out: 0, punch: false };
let st = load();
let nodes = null;
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => st;

function load() {
  try {
    const saved = { ...DEF, ...JSON.parse(localStorage.getItem(KEY)) };
    return saved;
  } catch { return { ...DEF }; }
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

// Transient shaper: a fast and a slow envelope follower; where the fast one runs ahead of the
// slow one (an attack) the gain rises, up to about +6 dB; on sustain it settles back to unity.
const SHAPER = `class P747 extends AudioWorkletProcessor{
  static get parameterDescriptors(){return [{name:'amount',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'}]}
  constructor(){super();this.f=0;this.s=0;this.g=1;const sr=sampleRate;
    this.fa=Math.exp(-1/(sr*.0008));this.fr=Math.exp(-1/(sr*.025));this.sa=Math.exp(-1/(sr*.022));this.sr=Math.exp(-1/(sr*.16));this.gs=Math.exp(-1/(sr*.0007));}
  process(inputs,outputs,params){const i=inputs[0],o=outputs[0];if(!i.length){return true}
    const a=params.amount[0],n=i[0].length,L=i[0],R=i[1]||i[0];
    for(let k=0;k<n;k++){const x=Math.max(Math.abs(L[k]),Math.abs(R[k]));
      this.f=x>this.f?this.fa*this.f+(1-this.fa)*x:this.fr*this.f+(1-this.fr)*x;
      this.s=x>this.s?this.sa*this.s+(1-this.sa)*x:this.sr*this.s+(1-this.sr)*x;
      let t=a>0&&this.s>1e-5?Math.pow(this.f/this.s,a*1.3):1;t=Math.min(2,Math.max(.8,t));
      this.g=this.gs*this.g+(1-this.gs)*t;
      for(let c=0;c<o.length;c++){const src=i[c]||L;o[c][k]=src[k]*this.g}}
    return true}}
registerProcessor('p747-punch',P747);`;
async function loadShaper(ac) {
  if (!ac.audioWorklet) return false;
  const url = URL.createObjectURL(new Blob([SHAPER], { type: 'application/javascript' }));
  try { await ac.audioWorklet.addModule(url); return true; }
  catch { try { await ac.audioWorklet.addModule(`data:application/javascript;base64,${btoa(SHAPER)}`); return true; } catch { return false; } }
  finally { URL.revokeObjectURL(url); }
}
const tanhCurve = (amount) => Float32Array.from({ length: 2048 }, (_, i) => Math.tanh(amount * (2 * i / 2047 - 1)) / Math.tanh(amount));

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
  input.connect(pre).connect(emph).connect(shaper).connect(deemph).connect(warmth).connect(air);
  glue.connect(trim);
  // Punch: dry + (body lift -> tanh drive) in parallel, as in the arcade Game Music player
  const pDry = ac.createGain(), pWet = ac.createGain(), pMix = ac.createGain(), out = ac.createGain();
  const body = ac.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 125; body.Q.value = 0.85; body.gain.value = 2;
  const sat = ac.createWaveShaper(); sat.curve = tanhCurve(1.8); sat.oversample = '2x';
  trim.connect(pDry).connect(pMix); trim.connect(body).connect(sat).connect(pWet).connect(pMix);
  pMix.connect(out);
  // the glue comp has a built-in lookahead delay, so it is only in the path while Glue is on
  nodes = { ac, input, pre, emph, shaper, deemph, warmth, air, glue, trim, pDry, pWet, pMix, out, shaperNode: null, k: -1, glued: null };
  loadShaper(ac).then((ok) => {
    if (!ok || !nodes) return;
    try {
      const node = new AudioWorkletNode(ac, 'p747-punch', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      pMix.disconnect(); pMix.connect(node).connect(out);
      nodes.shaperNode = node; apply(true);
    } catch { /* stays the parallel stage alone */ }
  });
  apply(true);
  return { input, output: out };
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
  if (n.glued !== g) { n.glued = g; try { n.air.disconnect(); } catch { /* first run */ } n.air.connect(g ? n.glue : n.trim); }
  set(n.glue.threshold, g ? -14 : 0); set(n.glue.ratio, g ? 3 : 1); set(n.glue.knee, g ? 8 : 0);
  set(n.glue.attack, g ? 0.03 : 0.003); set(n.glue.release, g ? 0.3 : 0.25);
  const makeup = (g ? 2.5 : 0) - driveDb * 0.82 + (on ? st.out * 12 : 0);
  set(n.trim.gain, Math.pow(10, makeup / 20));
  const p = on && st.punch;
  set(n.pDry.gain, p ? 0.42 : 1); set(n.pWet.gain, p ? 0.49 : 0);
  if (n.shaperNode) set(n.shaperNode.parameters.get('amount'), p ? 0.7 : 0);
}

export const setOn = (on) => commit({ ...st, on });
export const setMode = (mode) => MODES[mode] && commit({ ...st, ...MODES[mode], mode, on: mode === 'clean' ? st.on : true });
export const set = (change) => commit({ ...st, ...change });
/** Live reduction from the glue comp in dB (0 when idle), for the meter. */
export const reduction = () => (nodes && st.on && st.glue ? nodes.glue.reduction : 0);
