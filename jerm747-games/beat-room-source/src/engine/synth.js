// The Beat Room synth: three oscillators (saw / square / sine), coarse + fine detune, one amp
// ADSR, a patch memory, and a layer slot that stacks a second patch under the panel sound.
//
//   per note: osc 1..3 -> level -> envelope ┐
//             (layer: osc 1..3 -> level -> envelope, its own ADSR) ┘-> synth in -> volume
//             -> limiter -> scope analyser -> shared bus
//
// Edits to the oscillators reach notes that are already sounding; envelope edits apply from the
// next note. The panel sound is saved in the browser so it comes back on reload.
import { audio, out } from './audio.js';

export const WAVES = ['sawtooth', 'square', 'sine'];
export const WAVE_NAMES = { sawtooth: 'Saw', square: 'Square', sine: 'Sine' };
export const COARSE = 24;      // semitones either way
export const FINE = 50;        // cents either way
export const BEND = 2;         // pitch-bend range in semitones
const MAX_VOICES = 16;
const PEAK = 0.28;             // per-voice headroom so chords don't slam the limiter

// Envelope times are stored as knob positions (0..1) and squared, so the short end has detail.
export const ENV_MAX = { a: 3, d: 3, r: 5 };
export const envSec = (k, v) => 0.002 + v * v * ENV_MAX[k];

const CUR_KEY = 'beatroom.synth.current';
const PATCH_KEY = 'beatroom.synth.patches';

const osc = (wave, coarse = 0, fine = 0, level = 0.6, on = true) => ({ on, wave, coarse, fine, level });
// Synth EQ: low shelf 120 Hz, sweepable mid peak (200 Hz–5 kHz), high shelf 5 kHz. Gains are
// -1..1 (= ±12 dB); freq is a 0..1 knob position mapped on a log scale.
export const EQ_DB = 12;
export const FLAT_EQ = { low: 0, mid: 0, freq: 0.5, high: 0 };
export const midHz = (v) => 200 * Math.pow(25, v);
const sound = (oscs, env) => ({ osc: oscs, env });

export const FACTORY = [
  { id: 'f-init', name: 'Init', ...sound([osc('sawtooth', 0, 0, 0.7), osc('square', -12, 0, 0.4, false), osc('sine', 12, 0, 0.3, false)], { a: 0.05, d: 0.35, s: 0.7, r: 0.3 }) },
  { id: 'f-lead', name: 'Saw Lead', ...sound([osc('sawtooth', 0, -7, 0.6), osc('sawtooth', 0, 7, 0.6), osc('square', 12, 0, 0.22)], { a: 0.04, d: 0.4, s: 0.75, r: 0.3 }) },
  { id: 'f-bass', name: 'Square Bass', eq: { low: 0.45, mid: -0.25, freq: 0.45, high: -0.2 }, ...sound([osc('square', -12, 0, 0.7), osc('sawtooth', -12, 5, 0.4), osc('sine', -24, 0, 0.6)], { a: 0.02, d: 0.3, s: 0.5, r: 0.2 }) },
  { id: 'f-pad', name: 'Sine Pad', ...sound([osc('sine', 0, 0, 0.6), osc('sine', 12, 4, 0.35), osc('sawtooth', 0, -9, 0.16)], { a: 0.55, d: 0.6, s: 0.8, r: 0.65 }) },
  { id: 'f-organ', name: 'Square Organ', ...sound([osc('square', 0, 0, 0.35), osc('sine', 12, 0, 0.5), osc('sine', 19, 0, 0.35)], { a: 0.03, d: 0.2, s: 0.9, r: 0.15 }) },
  { id: 'f-pluck', name: 'Pluck', ...sound([osc('sawtooth', 0, 0, 0.65), osc('square', 0, 3, 0.3), osc('sine', -12, 0, 0.45)], { a: 0.02, d: 0.42, s: 0, r: 0.3 }) },
].map((p) => ({ eq: { ...FLAT_EQ }, ...p, factory: true, vol: 0.8, layer: null }));

// ---------- state ----------
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

function cleanSound(s, fallback = FACTORY[0]) {
  const src = s && Array.isArray(s.osc) ? s : fallback;
  return {
    osc: [0, 1, 2].map((i) => {
      const o = src.osc[i] || fallback.osc[i];
      return {
        on: o.on !== false,
        wave: WAVES.includes(o.wave) ? o.wave : 'sawtooth',
        coarse: Math.round(num(o.coarse, -COARSE, COARSE, 0)),
        fine: num(o.fine, -FINE, FINE, 0),
        level: num(o.level, 0, 1, 0.6),
      };
    }),
    env: { a: num(src.env?.a, 0, 1, 0.05), d: num(src.env?.d, 0, 1, 0.35), s: num(src.env?.s, 0, 1, 0.7), r: num(src.env?.r, 0, 1, 0.3) },
  };
}
function cleanPatch(p) {
  const base = cleanSound(p);
  const layer = p?.layer && p.layer.osc ? { ...cleanSound(p.layer), id: p.layer.id || null, name: String(p.layer.name || 'Layer'), mix: num(p.layer.mix, 0, 1, 0.5) } : null;
  const e = p?.eq || FLAT_EQ;
  const eq = { low: num(e.low, -1, 1, 0), mid: num(e.mid, -1, 1, 0), freq: num(e.freq, 0, 1, 0.5), high: num(e.high, -1, 1, 0) };
  return { ...base, name: String(p?.name || 'Init').slice(0, 40), vol: num(p?.vol, 0, 1, 0.8), eq, layer };
}

function load(key, d) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? d; } catch { return d; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage off */ } }

let user = (load(PATCH_KEY, []) || []).filter((p) => p && p.id).map((p) => ({ ...cleanPatch(p), id: String(p.id) }));
const saved = load(CUR_KEY, null);
let cur = saved ? { ...cleanPatch(saved), from: saved.from || null, dirty: !!saved.dirty } : { ...cleanPatch(FACTORY[0]), from: 'f-init', dirty: false };

const subs = new Set();
const noteSubs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const onNotes = (fn) => (noteSubs.add(fn), () => noteSubs.delete(fn));
export const getPatch = () => cur;
export const listPatches = () => [...FACTORY, ...user];

let saveTimer = 0;
function commit(next) {
  cur = next;
  clearTimeout(saveTimer); saveTimer = setTimeout(() => save(CUR_KEY, cur), 250);
  subs.forEach((fn) => fn(cur));
}

// ---------- audio graph ----------
let node = null;
function graph() {
  const ac = audio(); if (!ac) return null;
  if (!node || node.ac !== ac) {
    const input = ac.createGain();
    const low = ac.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 120;
    const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.Q.value = 1;
    const high = ac.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 5000;
    const vol = ac.createGain(); vol.gain.value = cur.vol;
    // safety clip instead of a compressor: a DynamicsCompressor delays the signal by its
    // lookahead (~6 ms), a WaveShaper adds nothing. Clean up to 0.7, then rounds off softly.
    const pre = ac.createGain(); pre.gain.value = 0.5;
    const lim = ac.createWaveShaper(); lim.curve = softClip(); lim.oversample = 'none';
    const post = ac.createGain(); post.gain.value = 2;
    const an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0;
    input.connect(low).connect(mid).connect(high).connect(vol).connect(pre).connect(lim).connect(post).connect(an).connect(out());
    node = { ac, input, vol, an, low, mid, high };
    applyEq(0);
  }
  return node;
}
function applyEq(tc = 0.02) {
  if (!node) return;
  const t = node.ac.currentTime, e = cur.eq;
  const set = (param, v) => (tc ? param.setTargetAtTime(v, t, tc) : (param.value = v));
  set(node.low.gain, e.low * EQ_DB); set(node.mid.gain, e.mid * EQ_DB); set(node.high.gain, e.high * EQ_DB);
  set(node.mid.frequency, midHz(e.freq));
}
function softClip() {
  const n = 4096, c = new Float32Array(n), K = 0.7;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2, a = Math.abs(x); // curve input is ±1 = ±2 after the 0.5 pre-gain
    const y = a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K));
    c[i] = (Math.sign(x) * y) / 2;
  }
  return c;
}
/** Build the synth graph and wake the audio engine now, so the first key or MIDI note has nothing to set up. */
export function warm() {
  const g = graph(); if (!g) return;
  if (g.ac.state !== 'running') g.ac.resume().catch(() => {});
}
/** Analyser on the synth's own output, for the scope (null until the first note). */
export const analyser = () => node?.an || null;

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
let bend = 0;
const detuneOf = (o) => o.coarse * 100 + o.fine + bend * 100;

function startPart(ac, snd, note, peak, t, dest) {
  const env = ac.createGain(); env.gain.value = 0; env.connect(dest);
  const oscs = snd.osc.map((o) => {
    const n = ac.createOscillator(); n.type = o.wave; n.frequency.value = mtof(note); n.detune.value = detuneOf(o);
    const g = ac.createGain(); g.gain.value = o.on ? o.level : 0;
    n.connect(g).connect(env); n.start(t);
    return { n, g };
  });
  const A = envSec('a', snd.env.a), D = envSec('d', snd.env.d);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + A);
  env.gain.setTargetAtTime(peak * snd.env.s, t + A, D / 3);
  return { env, oscs, snd };
}
function releasePart(p, t, rSec) {
  const g = p.env.gain;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
  else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
  g.setTargetAtTime(0, t, rSec / 4);
  const end = t + rSec * 1.3 + 0.05;
  p.oscs.forEach((o) => { try { o.n.stop(end); } catch { /* already stopped */ } });
  setTimeout(() => { try { p.env.disconnect(); } catch { /* gone */ } }, (end - p.env.context.currentTime) * 1000 + 100);
}

const playSubs = new Set();
/** Live playing (keys, touch, MIDI): fn('on', note, vel, audioTime) / fn('off', note, 0, audioTime). Used by the note recorder. */
export const onPlay = (fn) => (playSubs.add(fn), () => playSubs.delete(fn));
const emitPlay = (kind, note, vel, t) => playSubs.forEach((fn) => fn(kind, note, vel, t));

const voices = new Map();   // note -> { main, layer, born }
const held = new Set();     // keys physically down
let sustain = false;

function emitNotes() { const n = [...voices.keys()]; noteSubs.forEach((fn) => fn(n)); }
export const getNotes = () => [...voices.keys()];

function kill(note, fast = false) {
  const v = voices.get(note); if (!v) return;
  const ac = node.ac, t = ac.currentTime;
  releasePart(v.main, t, fast ? 0.01 : envSec('r', cur.env.r));
  if (v.layer) releasePart(v.layer, t, fast ? 0.01 : envSec('r', v.layer.snd.env.r));
  voices.delete(note);
  emitPlay('off', note, 0, t);
}

/** Start a note (MIDI number). vel is 0..1. */
export function noteOn(note, vel = 0.8) {
  const g = graph(); if (!g) return;
  // audio not started yet (first touch on a phone): start it, then play this note
  if (g.ac.state !== 'running') {
    g.ac.resume().then(() => { if (held.has(note) && !voices.has(note)) noteOn(note, vel); }).catch(() => {});
    held.add(note); return;
  }
  if (voices.has(note)) kill(note, true);
  if (voices.size >= MAX_VOICES) {
    const oldest = [...voices.entries()].sort((a, b) => a[1].born - b[1].born)[0];
    if (oldest) kill(oldest[0], true);
  }
  const t = g.ac.currentTime; // no added offset: start on the very next audio block
  const mix = cur.layer ? cur.layer.mix : 0;
  const mainAmt = cur.layer ? Math.min(1, 2 * (1 - mix)) : 1;
  const layerAmt = cur.layer ? Math.min(1, 2 * mix) : 0;
  const peak = PEAK * (0.35 + 0.65 * vel);
  const main = startPart(g.ac, cur, note, peak * mainAmt, t, g.input);
  const layer = cur.layer && layerAmt > 0.001 ? startPart(g.ac, cur.layer, note, peak * layerAmt, t, g.input) : null;
  voices.set(note, { main, layer, born: performance.now() });
  held.add(note);
  emitPlay('on', note, vel, t);
  emitNotes();
}
export function noteOff(note) {
  held.delete(note);
  if (sustain) return;
  if (voices.has(note)) { kill(note); emitNotes(); }
}
export function allOff() {
  held.clear(); sustain = false;
  if (node) [...voices.keys()].forEach((n) => kill(n));
  emitNotes();
}
/** Sustain pedal (MIDI CC 64): notes ring until the pedal comes up. */
export function setSustain(on) {
  sustain = on;
  if (!on && node) { [...voices.keys()].filter((n) => !held.has(n)).forEach((n) => kill(n)); emitNotes(); }
}
/** Pitch bend in semitones (-BEND..BEND), applied to every sounding oscillator. */
export function setBend(semis) {
  bend = semis;
  if (!node) return;
  const t = node.ac.currentTime;
  voices.forEach((v) => [v.main, v.layer].forEach((p) => p && p.oscs.forEach((o, i) => o.n.detune.setTargetAtTime(detuneOf(p.snd.osc[i]), t, 0.008))));
}

// A release booked ahead of time: queue the fall after the attack/decay events (no cancel,
// which works the same in every browser).
function releaseLater(p, off, rSec) {
  const start = p.env.context.currentTime;
  p.env.gain.setTargetAtTime(0, Math.max(off, start), rSec / 4);
  const end = off + rSec * 1.3 + 0.05;
  p.oscs.forEach((o) => { try { o.n.stop(end); } catch { /* already stopped */ } });
  setTimeout(() => { try { p.env.disconnect(); } catch { /* gone */ } }, (end - p.env.context.currentTime) * 1000 + 100);
}

// ---------- scheduled notes (the note lane) ----------
// Played from the transport at exact audio times; separate from the live voices so a recorded
// part and live playing never cut each other off.
let seqCount = 0;
export function playAt(note, vel, t, dur) {
  const g = graph(); if (!g || g.ac.state !== 'running' || seqCount >= 24) return;
  const mix = cur.layer ? cur.layer.mix : 0;
  const mainAmt = cur.layer ? Math.min(1, 2 * (1 - mix)) : 1;
  const layerAmt = cur.layer ? Math.min(1, 2 * mix) : 0;
  const peak = PEAK * (0.35 + 0.65 * vel);
  const main = startPart(g.ac, cur, note, peak * mainAmt, t, g.input);
  const layer = cur.layer && layerAmt > 0.001 ? startPart(g.ac, cur.layer, note, peak * layerAmt, t, g.input) : null;
  const off = t + Math.max(0.03, dur);
  releaseLater(main, off, envSec('r', cur.env.r));
  if (layer) releaseLater(layer, off, envSec('r', cur.layer.env.r));
  seqCount++;
  setTimeout(() => { seqCount--; }, (off - g.ac.currentTime) * 1000 + 50);
}

// ---------- panel edits ----------
export function setOsc(i, change) {
  const oscs = cur.osc.map((o, k) => (k === i ? { ...o, ...change } : o));
  commit({ ...cur, osc: oscs, dirty: true });
  if (!node) return;
  const t = node.ac.currentTime, o = oscs[i];
  voices.forEach((v) => {
    v.main.snd = cur;
    const p = v.main.oscs[i];
    if (p.n.type !== o.wave) p.n.type = o.wave;
    p.n.detune.setTargetAtTime(detuneOf(o), t, 0.01);
    p.g.gain.setTargetAtTime(o.on ? o.level : 0, t, 0.01);
  });
}
export const setEnv = (change) => commit({ ...cur, env: { ...cur.env, ...change }, dirty: true });
export function setEq(change) { commit({ ...cur, eq: { ...cur.eq, ...change }, dirty: true }); applyEq(); }
export function setVol(v) {
  commit({ ...cur, vol: v, dirty: true });
  if (node) node.vol.gain.setTargetAtTime(v, node.ac.currentTime, 0.02);
}

// ---------- patches ----------
const soundOf = (p) => ({ osc: clone(p.osc), env: clone(p.env) });

export function loadPatch(id) {
  const p = listPatches().find((x) => x.id === id); if (!p) return;
  commit({ ...cleanPatch(clone(p)), from: p.id, dirty: false });
  if (node) node.vol.gain.setTargetAtTime(cur.vol, node.ac.currentTime, 0.02);
  applyEq();
}
/** Save the panel (and its layer) as a patch. Same name as one of yours overwrites it. */
export function savePatch(name) {
  const nm = (name || '').trim().slice(0, 40) || 'My patch';
  const existing = user.find((p) => p.name.toLowerCase() === nm.toLowerCase());
  const id = existing ? existing.id : `u-${Date.now().toString(36)}`;
  const p = { ...cleanPatch({ ...cur, name: nm }), id };
  user = existing ? user.map((x) => (x.id === id ? p : x)) : [...user, p];
  save(PATCH_KEY, user);
  commit({ ...cur, name: nm, from: id, dirty: false });
  return id;
}
export function deletePatch(id) {
  if (!user.some((p) => p.id === id)) return;
  user = user.filter((p) => p.id !== id);
  save(PATCH_KEY, user);
  commit({ ...cur, from: cur.from === id ? null : cur.from, dirty: cur.from === id ? true : cur.dirty });
}
/** Stack a saved patch under the panel sound (null clears it). The layer keeps its own ADSR. */
export function setLayer(id) {
  if (!id) { commit({ ...cur, layer: null, dirty: true }); return; }
  const p = listPatches().find((x) => x.id === id); if (!p) return;
  commit({ ...cur, layer: { ...soundOf(p), id: p.id, name: p.name, mix: cur.layer?.mix ?? 0.5 }, dirty: true });
}
export const setLayerMix = (mix) => cur.layer && commit({ ...cur, layer: { ...cur.layer, mix }, dirty: true });
/** Fold the layer into the panel: a new 3-osc patch blending both sounds, ready to tweak or save. */
export function flattenLayer() {
  const L = cur.layer; if (!L) return;
  const m = L.mix, lerp = (a, b) => a + (b - a) * m;
  // keep the strongest three of the six oscillators, weighted by the blend
  const pool = [
    ...cur.osc.map((o) => ({ ...o, w: (o.on ? o.level : 0) * Math.min(1, 2 * (1 - m)) })),
    ...L.osc.map((o) => ({ ...o, w: (o.on ? o.level : 0) * Math.min(1, 2 * m) })),
  ].sort((a, b) => b.w - a.w).slice(0, 3);
  const oscs = pool.map(({ w, ...o }) => ({ ...o, on: w > 0.001, level: Math.min(1, w) }));
  const env = { a: lerp(cur.env.a, L.env.a), d: lerp(cur.env.d, L.env.d), s: lerp(cur.env.s, L.env.s), r: lerp(cur.env.r, L.env.r) };
  commit({ ...cur, name: `${cur.name} + ${L.name}`.slice(0, 40), osc: oscs, env, layer: null, from: null, dirty: true });
}

// ---------- helpers for the UI ----------
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
export const isBlack = (n) => [1, 3, 6, 8, 10].includes(n % 12);
