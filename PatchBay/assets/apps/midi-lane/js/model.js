// MIDI Lane project model: tracks of notes in ticks (480 per quarter, 4/4), undo/redo,
// grid snap, quantize and half quantize, .mlane save/load.
import { defaultPatch as avionyxPatch } from './avionyx.js';
import { defaultKit, KIT_ROWS } from './drumway.js';

/** App version: bump here only; it shows in the header, the File sheet and saved projects. */
export const VERSION = '1.0';
export const PPQ = 480, BAR = PPQ * 4, STEP = PPQ / 4;
export const MAX_TRACKS = 16;
export const SNAPS = [
  { id: '1/4', t: 480 }, { id: '1/8', t: 240 }, { id: '1/16', t: 120 },
  { id: '1/32', t: 60 }, { id: '1/64', t: 30 }, { id: 'Off', t: 15 }, // Off = 1/128
];
// one color per MIDI channel, starting at pale aqua green
export const CH_COLORS = ['#8ff0cf', '#8fd8ff', '#b6a8ff', '#ff9fd4', '#ffb48c', '#ffe28a', '#c9f08c', '#8ce0f0',
  '#d7b0ff', '#ff8f7a', '#f5c46b', '#9ff0a8', '#a8c4ff', '#ffb0b0', '#d8e88a', '#c0c8d0'];

const uid = () => Math.random().toString(36).slice(2, 9);
export const defaultFx = () => ({
  tape: { on: false, wow: 0.25, flutter: 0.2, sat: 0.3, low: 0, high: 0 },
  drive: { on: false, mode: '747', drive: 0.25, iron: 0.14, warmth: 0.05, air: 1, glue: true, out: 0 },
});

export function makeTrack(o = {}) {
  const drum = !!o.drum;
  return {
    id: uid(), name: o.name || (drum ? 'Drums' : 'Keys'), ch: drum ? 9 : (o.ch ?? 0), drum,
    inst: o.inst || (drum ? 'drumway' : 'avionyx'),
    patch: o.patch || (drum ? defaultKit() : avionyxPatch()),
    fx: o.fx || defaultFx(), vol: o.vol ?? 0.8, mute: false, solo: false, midiOut: o.midiOut ?? true,
    rows: o.rows || [], notes: o.notes || [],
  };
}

function demo() {
  const P = { format: 'midilane', version: 1, name: 'Demo groove', bpm: 94, bars: 2, tracks: [] };
  const d = makeTrack({ name: 'Drums', drum: true }), k = makeTrack({ name: 'Keys', ch: 0 });
  const hit = (n, s, v = 100) => d.notes.push({ t: s * STEP, d: STEP, n, v });
  [0, 6, 10, 16, 22, 25, 26].forEach((s) => hit(36, s, 118));
  [4, 12, 20, 28].forEach((s) => hit(38, s, 108));
  for (let s = 0; s < 32; s += 2) if (s % 16 !== 14) hit(42, s, s % 4 ? 70 : 96);
  hit(46, 14, 90); hit(46, 30, 90); hit(49, 0, 96); hit(56, 27, 70); hit(50, 29, 92); hit(45, 31, 98);
  const chord = (t, ns, len) => ns.forEach((n) => k.notes.push({ t, d: len, n, v: 88 }));
  chord(0, [57, 60, 64, 67], 900); chord(960, [53, 57, 60, 64], 900);
  chord(1920, [48, 55, 59, 64], 900); chord(2880, [55, 59, 62, 65], 840);
  [69, 72, 76, 74].forEach((n, i) => k.notes.push({ t: 3360 + i * 120, d: 110, n, v: 76 }));
  P.tracks.push(d, k);
  return P;
}

export function newProject(empty = false) {
  if (!empty) return demo();
  return { format: 'midilane', version: 1, name: 'Untitled', bpm: 96, bars: 4,
    tracks: [makeTrack({ name: 'Drums', drum: true }), makeTrack({ name: 'Keys', ch: 0 })] };
}

// ---------- store ----------
const KEY = 'midilane.project.v1';
export let P = load() || newProject(true);
const subs = new Set();
export const onChange = (fn) => (subs.add(fn), () => subs.delete(fn));
let saveT = 0;
export function changed(what = 'notes') {
  subs.forEach((fn) => fn(what));
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* storage off */ } }, 400);
}
function load() { try { const s = localStorage.getItem(KEY); return s ? clean(JSON.parse(s)) : null; } catch { return null; } }
export const lenTicks = () => P.bars * BAR;

// ---------- undo ----------
const undoS = [], redoS = [];
export function pushUndo() { undoS.push(JSON.stringify(P)); if (undoS.length > 80) undoS.shift(); redoS.length = 0; }
export function undo() { if (!undoS.length) return false; redoS.push(JSON.stringify(P)); P = JSON.parse(undoS.pop()); changed('all'); return true; }
export function redo() { if (!redoS.length) return false; undoS.push(JSON.stringify(P)); P = JSON.parse(redoS.pop()); changed('all'); return true; }
export const canUndo = () => undoS.length > 0, canRedo = () => redoS.length > 0;
export function replaceProject(np) { pushUndo(); P = clean(np); changed('all'); }

// ---------- tracks ----------
export function addTrack(drum = false) {
  if (P.tracks.length >= MAX_TRACKS) return null;
  pushUndo();
  const used = new Set(P.tracks.map((t) => t.ch));
  let ch = 0; while (!drum && (used.has(ch) || ch === 9) && ch < 15) ch++;
  const t = makeTrack({ drum, ch, name: drum ? 'Drums ' + (P.tracks.filter((x) => x.drum).length + 1) : 'Keys ' + (P.tracks.length + 1) });
  P.tracks.push(t); changed('tracks'); return t;
}
export function removeTrack(id) { if (P.tracks.length <= 1) return; pushUndo(); P.tracks = P.tracks.filter((t) => t.id !== id); changed('tracks'); }
export function setDrum(t, on) {
  pushUndo();
  t.drum = on;
  if (on) { t.ch = 9; t.inst = 'drumway'; t.patch = defaultKit(); }
  else { const used = new Set(P.tracks.map((x) => x.ch)); let ch = 0; while ((used.has(ch) || ch === 9) && ch < 15) ch++; t.ch = ch; t.inst = 'avionyx'; t.patch = avionyxPatch(); }
  changed('tracks');
}
export const color = (t) => CH_COLORS[t.ch & 15];

/** Rows (note numbers, top to bottom) for the Rhythm Lane and the drum Key Lane. */
export function rowsFor(t) {
  if (t.drum) {
    const extra = [...new Set(t.notes.map((n) => n.n))].filter((n) => !KIT_ROWS.includes(n)).sort((a, b) => b - a);
    return [...KIT_ROWS, ...extra];
  }
  // the C4–C5 starter rows always stay, so tapping a step never collapses the grid to one row
  const s = new Set([60, 62, 64, 65, 67, 69, 71, 72, ...t.notes.map((n) => n.n), ...t.rows]);
  return [...s].sort((a, b) => b - a);
}

// ---------- quantize ----------
export const snapRound = (t, g) => Math.round(t / g) * g;
export const snapFloor = (t, g) => Math.floor(t / g) * g;
/** Full quantize: starts land on the grid. */
export function quantize(notes, g) { notes.forEach((n) => { n.t = Math.max(0, snapRound(n.t, g)); }); }
/** Half quantize (Maschine-style): each press moves a note halfway to the grid, so it creeps closer without landing. */
export function halfQuantize(notes, g) {
  notes.forEach((n) => { const q = snapRound(n.t, g), gap = q - n.t; if (Math.abs(gap) > 0.01) n.t = Math.max(0, n.t + gap / 2); });
}

// ---------- files ----------
export function clean(o) {
  if (!o || !Array.isArray(o.tracks)) throw new Error('That isn’t a MIDI Lane project.');
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
  const p = { format: 'midilane', version: 1, name: String(o.name || 'Untitled').slice(0, 60),
    bpm: num(o.bpm, 30, 300, 96), bars: Math.round(num(o.bars, 1, 64, 4)), tracks: [] };
  for (const t of o.tracks.slice(0, MAX_TRACKS)) {
    const base = makeTrack({ drum: !!t.drum, ch: num(t.ch, 0, 15, 0) });
    p.tracks.push({ ...base, ...t, id: t.id || base.id, ch: Math.round(num(t.ch, 0, 15, base.ch)),
      patch: t.patch && typeof t.patch === 'object' ? { ...base.patch, ...t.patch } : base.patch,
      fx: { tape: { ...base.fx.tape, ...(t.fx?.tape || {}) }, drive: { ...base.fx.drive, ...(t.fx?.drive || {}) } },
      rows: Array.isArray(t.rows) ? t.rows : [],
      notes: (t.notes || []).filter((n) => n && Number.isFinite(n.t)).map((n) => ({
        t: Math.max(0, +n.t), d: Math.max(1, +n.d || STEP), n: Math.round(num(n.n, 0, 127, 60)), v: Math.round(num(n.v, 1, 127, 100)) })) });
  }
  if (!p.tracks.length) p.tracks.push(makeTrack());
  return p;
}
export const projectJson = () => JSON.stringify({ ...P, savedWith: `MIDI Lane ${VERSION} by Jerm747` }, null, 1);
