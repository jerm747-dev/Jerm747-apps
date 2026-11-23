// Shared audio context + the two effects every built-in instrument runs through:
//   instrument -> Black Box (tape: saturation, wow, flutter, low/high shelves) -> 747 Drive -> track gain -> master
// Both effects are ported from the Beat Room (tapefx.js / character.js) and rebuilt per instance,
// against any BaseAudioContext, so live playback and the MP3 bounce sound identical.
let ac = null, master = null;

export function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch { return null; }
    master = buildMaster(ac);
    master.output.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
export const masterIn = () => (audio(), master.input);
export const ready = () => !!ac;

/** Master: gain -> soft clip safety (no lookahead delay). */
export function buildMaster(c) {
  const input = c.createGain(); input.gain.value = 0.9;
  const pre = c.createGain(); pre.gain.value = 0.5;
  const lim = c.createWaveShaper(); lim.curve = softClip();
  const post = c.createGain(); post.gain.value = 2;
  input.connect(pre).connect(lim).connect(post);
  return { input, output: post };
}
function softClip() {
  const n = 4096, c = new Float32Array(n), K = 0.7;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2, a = Math.abs(x);
    const y = a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K));
    c[i] = (Math.sign(x) * y) / 2;
  }
  return c;
}

let noiseBufs = new WeakMap();
export function noise(c) {
  let b = noiseBufs.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(c, b);
  }
  const s = c.createBufferSource(); s.buffer = b; return s;
}

// ---------- Black Box (tape) ----------
function satCurve(amount) {
  const k = 1 + amount * 18, n = 2048, c = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  return c;
}
export function buildBlackBox(c) {
  const input = c.createGain(), output = c.createGain();
  const dry = c.createGain(), wet = c.createGain();
  const drive = c.createGain(), shaper = c.createWaveShaper(); shaper.oversample = '2x';
  const makeup = c.createGain();
  const delay = c.createDelay(0.1); delay.delayTime.value = 0.012;
  const wowLfo = c.createOscillator(); wowLfo.frequency.value = 0.55;
  const wowAmt = c.createGain();
  const flutLfo = c.createOscillator(); flutLfo.frequency.value = 6.8;
  const flutAmt = c.createGain();
  const low = c.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180;
  const high = c.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4500;
  input.connect(dry).connect(output);
  input.connect(drive).connect(shaper).connect(makeup).connect(delay).connect(low).connect(high).connect(wet).connect(output);
  wowLfo.connect(wowAmt).connect(delay.delayTime); flutLfo.connect(flutAmt).connect(delay.delayTime);
  wowLfo.start(); flutLfo.start();
  let lastSat = -1;
  function update(p) {
    const t = c.currentTime;
    if (p.sat !== lastSat) { shaper.curve = satCurve(p.sat); lastSat = p.sat; }
    dry.gain.setValueAtTime(p.on ? 0 : 1, t); wet.gain.setValueAtTime(p.on ? 1 : 0, t);
    drive.gain.setValueAtTime(1 + p.sat * 2.5, t); makeup.gain.setValueAtTime(1 / (1 + p.sat * 1.2), t);
    wowAmt.gain.setValueAtTime(p.wow * 0.0045, t); flutAmt.gain.setValueAtTime(p.flutter * 0.0007, t);
    low.gain.setValueAtTime(p.low * 12, t); high.gain.setValueAtTime(p.high * 12, t);
  }
  return { input, output, update, dispose() { try { wowLfo.stop(); flutLfo.stop(); input.disconnect(); output.disconnect(); } catch { /* gone */ } } };
}

// ---------- 747 Drive ----------
export const DRIVE_MODES = {
  clean: { name: 'Clean', drive: 0, iron: 0, warmth: 0, air: 0, glue: false },
  warm: { name: 'Warm', drive: 0.08, iron: 0.06, warmth: 0.12, air: 0, glue: false },
  iron: { name: 'Iron', drive: 0.14, iron: 0.2, warmth: 0.08, air: 0, glue: true },
  747: { name: '747', drive: 0.25, iron: 0.14, warmth: 0.05, air: 1, glue: true },
};
function driveCurve(k, bias) {
  const n = 2048, c = new Float32Array(n), t = Math.tanh, off = t(k * bias), slope = k * (1 - off * off);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = (t(k * (x + bias)) - off) / slope; }
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(c[i]));
  if (m > 1) for (let i = 0; i < n; i++) c[i] /= m;
  return c;
}
export function buildDrive(c) {
  const input = c.createGain(), pre = c.createGain();
  const emph = c.createBiquadFilter(); emph.type = 'lowshelf'; emph.frequency.value = 110;
  const shaper = c.createWaveShaper();
  const deemph = c.createBiquadFilter(); deemph.type = 'lowshelf'; deemph.frequency.value = 110;
  const warmth = c.createBiquadFilter(); warmth.type = 'highshelf'; warmth.frequency.value = 9000;
  const air = c.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 14000;
  const glue = c.createDynamicsCompressor(), trim = c.createGain();
  input.connect(pre).connect(emph).connect(shaper).connect(deemph).connect(warmth).connect(air);
  glue.connect(trim);
  const n = { k: -1, glued: null };
  function update(st) {
    const t = c.currentTime, set = (p, v) => p.setValueAtTime(v, t), on = st.on;
    const drv = on ? st.drive : 0, ironDb = on ? st.iron * 9 : 0, driveDb = drv * 18;
    set(pre.gain, Math.pow(10, driveDb / 20)); set(emph.gain, ironDb); set(deemph.gain, -ironDb);
    set(warmth.gain, on ? -st.warmth * 6 : 0); set(air.gain, on ? st.air * 3 : 0);
    const k = on && (drv > 0.001 || ironDb > 0) ? 1 + drv * 3.5 : 0;
    if (k !== n.k) { n.k = k; if (k) { shaper.curve = driveCurve(k, 0.18 + st.iron * 0.12); shaper.oversample = '4x'; } else { shaper.curve = null; shaper.oversample = 'none'; } }
    const g = on && st.glue;
    if (n.glued !== g) { n.glued = g; try { air.disconnect(); } catch { /* first */ } air.connect(g ? glue : trim); }
    set(glue.threshold, g ? -14 : 0); set(glue.ratio, g ? 3 : 1); set(glue.knee, g ? 8 : 0);
    set(glue.attack, g ? 0.03 : 0.003); set(glue.release, g ? 0.3 : 0.25);
    set(trim.gain, Math.pow(10, ((g ? 2.5 : 0) - driveDb * 0.82 + (on ? st.out * 12 : 0)) / 20));
  }
  return { input, output: trim, update, dispose() { try { input.disconnect(); trim.disconnect(); } catch { /* gone */ } } };
}

/** A track's strip: input -> Black Box -> 747 Drive -> gain -> dest. */
export function buildStrip(c, dest, fx, vol) {
  const bb = buildBlackBox(c), dr = buildDrive(c), gain = c.createGain();
  bb.output.connect(dr.input); dr.output.connect(gain).connect(dest);
  gain.gain.value = vol;
  const strip = {
    input: bb.input, gain,
    update(fx2, vol2, audible = true) { bb.update(fx2.tape); dr.update(fx2.drive); gain.gain.setTargetAtTime(audible ? vol2 : 0, c.currentTime, 0.015); },
    dispose() { bb.dispose(); dr.dispose(); try { gain.disconnect(); } catch { /* gone */ } },
  };
  strip.update(fx, vol);
  return strip;
}
export const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
