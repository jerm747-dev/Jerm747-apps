// The synth note lane: record what you play on the keyboard (touch, computer keys or MIDI) into
// the song, then it plays back on the shared transport with the rhythm composer.
//
// Each section (A–D) has its own notes; positions are in 16th-note steps (fractional, so takes
// keep their feel), and the section's length comes from the rhythm composer.
// REC from a stop: count-in, then the loop starts and one pass records. REC while playing: the
// take starts at the top of the next pass. Takes overdub on top of what's there; Undo pulls the
// last take back out. Quantize snaps starts to the chosen grid (1/4 to 1/64, triplets too) as you record (or the whole lane
// with Snap).
import { audio, latencyMs } from './audio.js';
import { isArmed, onRun } from './clock.js';
import * as synth from './synth.js';
import * as pads from './pads.js';
import * as countin from './countin.js';
import * as recclick from './recclick.js';

const KEY = 'beatroom.notes';
// Quantize grid, in 16th-note steps (T = triplet).
export const GRIDS = { '1/4': 4, '1/8': 2, '1/8T': 4 / 3, '1/16': 1, '1/16T': 2 / 3, '1/32': 0.5, '1/64': 0.25 };
const gridOf = () => GRIDS[song.grid] || 1;
const toGrid = (x, g) => Math.round(Math.round(x / g) * g * 1000) / 1000;
const blankSong = () => ({ sections: [[], [], [], []], on: true, quant: true, grid: '1/16' });
let song = load();
const history = [];   // snapshots for Undo (last few takes / edits)

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && Array.isArray(v.sections) && v.sections.length === 4) {
      const ok = (n) => n && Number.isFinite(n.p) && Number.isFinite(n.d) && Number.isFinite(n.n);
      return { sections: v.sections.map((s) => (Array.isArray(s) ? s.filter(ok).map((n) => ({ p: n.p, d: n.d, n: n.n | 0, v: Number.isFinite(n.v) ? n.v : 0.8 })) : [])), on: v.on !== false, quant: v.quant !== false, grid: v.grid in GRIDS ? v.grid : '1/16' };
    }
  } catch { /* fall through */ }
  return blankSong();
}

const subs = new Set();
let view = null;
function refresh() {
  view = { on: song.on, quant: song.quant, grid: song.grid, rec: rec.state, edit: pads.getEdit(), len: pads.getSecLen(pads.getEdit()), notes: song.sections[pads.getEdit()] || [], counts: song.sections.map((s) => s.length), canUndo: history.length > 0 };
  subs.forEach((fn) => fn(view));
}
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => view;

let saveT = 0;
function commit(next, { undoable = true } = {}) {
  if (undoable) { history.push(JSON.stringify(song.sections)); if (history.length > 20) history.shift(); }
  song = next;
  pads.refresh();
  refresh();
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(song)); } catch { /* storage off */ } }, 250);
}

// the song strip counts a section with synth notes as "has notes", so Song mode plays it
pads.setNotesCheck((i) => (song.sections[i] || []).length > 0);
pads.onSong(() => refresh());

// ---------- playback ----------
const steps = [];   // recent transport steps: { abs, sec, pos, time, dur, len } (for recording)
pads.onSchedule((sec, pos, time, dur, abs, len) => {
  steps.push({ abs, sec, pos, time, dur, len });
  if (steps.length > 128) steps.shift();
  onStepScheduled(sec, pos, time, dur, abs, len);
  if (!song.on) return;
  for (const n of song.sections[sec] || []) {
    if (n.p >= pos && n.p < pos + 1 && n.p < len) synth.playAt(n.n, n.v, time + (n.p - pos) * dur, n.d * dur);
  }
});

// ---------- recording ----------
// state: 'off' | 'armed' (waiting for the top) | 'rec' (this pass)
const rec = { state: 'off', start: null, take: [], held: new Map(), endT: 0, notBefore: 0 };
const setRec = (st) => {
  rec.state = st;
  if (st === 'off') recclick.end('synth');
  if (st !== 'armed' && countin.get().label === 'Synth') countin.show(0);
  refresh();
};

function onStepScheduled(sec, pos, time, dur, abs, len) {
  if (rec.state === 'armed' && sec === pads.getEdit() && pos === 0 && time >= rec.notBefore) {
    rec.start = { time, dur, len, sec }; rec.take = []; rec.endT = time + len * dur;
    setTimeout(() => { if (rec.state === 'armed') setRec('rec'); }, Math.max(0, (time - audio().currentTime) * 1000));
    setTimeout(() => finishTake(), Math.max(0, (rec.endT - audio().currentTime) * 1000) + 30);
  }
  // waiting at the top of a playing loop: count down the last bar
  if (rec.state === 'armed' && !rec.start && sec === pads.getEdit() && !countin.active()) {
    const beats = Math.ceil((len - pos - 1) / 4);
    setTimeout(() => { if (rec.state === 'armed') countin.show(beats >= 1 && beats <= 4 ? beats : 0, 'Synth'); }, Math.max(0, (time - audio().currentTime) * 1000));
  }
}

/** Arm a take (starts the transport with a count-in from a stop), or cancel. */
export function toggleRec() {
  if (rec.state !== 'off') { cancelRec(); return; }
  if (pads.getSong()?.mode !== 'loop') pads.setMode('loop');
  rec.start = null; rec.take = []; rec.held.clear();
  const ac = audio(); rec.notBefore = ac ? ac.currentTime : 0;
  setRec('armed');
  synth.warm();
  const at = isArmed('pattern') ? undefined : countin.run('Synth');
  if (at !== undefined) pads.play(true, at);
  recclick.begin('synth', at);
}
function cancelRec() {
  if (rec.state === 'rec') finishTake(true); else setRec('off');
  rec.start = null;
}

// Where a moment (audio time) sits in the take, in steps from the top. The player hears each
// step `latency` after it is scheduled and plays along with that, so the hit is moved back by it.
function placeOf(t) {
  const S = rec.start; if (!S) return null;
  const lat = (latencyMs() || 0) / 1000;
  return (t - lat - S.time) / S.dur;
}
synth.onPlay((kind, note, vel, t) => {
  if (rec.state === 'off' || !rec.start) return;
  const p = placeOf(t); if (p == null) return;
  if (kind === 'on') {
    // a note just ahead of the downbeat counts as the downbeat
    if (p < -0.5 || p >= rec.start.len) return;
    rec.held.set(note, { p: Math.max(0, p), v: vel });
  } else {
    const h = rec.held.get(note); if (!h) return;
    rec.held.delete(note);
    addToTake(note, h, p);
  }
});
function addToTake(note, h, endP) {
  const len = rec.start.len;
  let p = h.p;
  if (song.quant) { p = toGrid(p, gridOf()); if (p >= len) p -= len; }
  const d = Math.max(0.25, Math.min(len, endP - h.p));
  rec.take.push({ p: Math.round(p * 1000) / 1000, d: Math.round(d * 1000) / 1000, n: note, v: Math.round(h.v * 100) / 100 });
}
function finishTake(cancelled = false) {
  if (rec.state === 'off') return;
  if (rec.start && rec.state === 'rec') {
    // notes still held at the end of the pass close at the end of the section
    rec.held.forEach((h, note) => addToTake(note, h, rec.start.len));
    rec.held.clear();
    if (rec.take.length) {
      const sec = rec.start.sec;
      const sections = song.sections.map((s, i) => (i === sec ? [...s, ...rec.take].sort((a, b) => a.p - b.p) : s));
      commit({ ...song, sections });
    }
  }
  rec.take = []; rec.start = null;
  setRec('off');
  void cancelled;
}

// stopping the transport ends any take in progress
onRun(() => {
  if (isArmed('pattern')) return;
  if (rec.state === 'rec') finishTake();
  else if (rec.state === 'armed' && !countin.active()) { rec.start = null; setRec('off'); }
});

// ---------- editing ----------
const edit = () => pads.getEdit();
export function setOn(on) { commit({ ...song, on }, { undoable: false }); }
export function setGrid(grid) { if (grid in GRIDS) commit({ ...song, grid }, { undoable: false }); }
export function setQuant(q) { commit({ ...song, quant: q }, { undoable: false }); }
export function clear() { commit({ ...song, sections: song.sections.map((s, i) => (i === edit() ? [] : s)) }); }
export function remove(idx) { commit({ ...song, sections: song.sections.map((s, i) => (i === edit() ? s.filter((_, k) => k !== idx) : s)) }); }
/** Snap every note in this section to the nearest 16th. */
export function snap() {
  const len = pads.getSecLen(edit());
  const g = gridOf();
  const fix = (n) => { let p = toGrid(n.p, g); if (p >= len) p -= len; return { ...n, p, d: Math.max(Math.round(g * 1000) / 1000, toGrid(n.d, g)) }; };
  commit({ ...song, sections: song.sections.map((s, i) => (i === edit() ? s.map(fix) : s)) });
}
export function undo() {
  const prev = history.pop(); if (!prev) return;
  song = { ...song, sections: JSON.parse(prev) };
  commit(song, { undoable: false });
}
/** Hear one note from the lane (tapping it in the roll). */
export function audition(n) { const ac = audio(); if (ac) { synth.warm(); synth.playAt(n.n, n.v, ac.currentTime + 0.01, 0.25); } }

refresh();

// ---------- MIDI files ----------
// Import a phrase into the section you're editing: leading empty bars are trimmed, the section
// length is set to fit the phrase (16, 32 or 64 steps), and the notes replace what's there (Undo
// brings the old ones back). Export writes the section's notes as a MIDI file at the song's tempo.
import { readMidi, writeMidi } from './smf.js';
import { getBpm } from './clock.js';

/** buf: ArrayBuffer of a .mid file. Returns { count, len, bars, dropped, fileBpm, name }. */
export function importMidi(buf) {
  const { notes: raw, bpm: fileBpm, name } = readMidi(buf);
  if (!raw.length) throw new Error('That MIDI file has no notes (drum-channel notes are skipped).');
  const steps = raw.map((x) => ({ p: x.t * 4, d: x.d * 4, n: x.n, v: x.v }));
  const shift = Math.floor(Math.min(...steps.map((x) => x.p)) / 16) * 16;     // drop empty bars at the top
  steps.forEach((x) => { x.p -= shift; });
  const end = Math.max(...steps.map((x) => x.p + x.d));
  const len = [16, 32, 64].find((n) => end <= n + 0.001) || 64;
  const kept = steps.filter((x) => x.p < len).map((x) => ({
    p: Math.round(x.p * 1000) / 1000, d: Math.round(Math.max(0.25, Math.min(x.d, len - x.p)) * 1000) / 1000, n: x.n, v: Math.round(x.v * 100) / 100,
  }));
  if (pads.getLength() !== len) pads.setLength(len);
  commit({ ...song, sections: song.sections.map((s, i) => (i === edit() ? kept : s)) });
  return { count: kept.length, len, bars: Math.ceil(end / 16), dropped: steps.length - kept.length, fileBpm, name };
}
/** The section you're editing as a MIDI file (Blob), or null when it's empty. */
export function exportMidi() {
  const list = song.sections[edit()] || [];
  if (!list.length) return null;
  return writeMidi(list, { bpm: getBpm(), name: `Beat Room ${pads.SECTIONS[edit()]}` });
}
