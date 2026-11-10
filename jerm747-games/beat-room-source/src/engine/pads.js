// Sequencer state, shared by the Rhythm Composer UI and the clock. Each row has a sound source
// (a synth voice or a library clip), 16, 32 or 64 steps, and its own mixer channel (EQ + level + mute).
// Loop record: arm it and the next full pass of the pattern records live pad hits (quantized
// to the nearest step, added on top of what's there); when that pass ends, recording stops
// and the loop keeps playing.
// Song: four sections (A–D), each with its own steps and length; the row sounds and mixer
// are shared. The grid always shows the section being edited. Loop mode repeats that
// section; Song mode plays the sections that have notes in order, A to D, and starts over.
import { audio, out } from './audio.js';
import { createChannel } from './channel.js';
import { VOICES, playSample } from './voices.js';
import { definePart, arm, isArmed, onStep } from './clock.js';
import * as library from './library.js';

const KEY = 'beatroom.pads';
export const LENGTHS = [16, 32, 64];
const blank = (n = 16) => Array(n).fill(0);
const DEFAULT_ROWS = [
  { id: 'r1', name: 'Kick', src: { type: 'synth', voice: 'kick' }, steps: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0] },
  { id: 'r2', name: 'Clap', src: { type: 'synth', voice: 'clap' }, steps: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1] },
  { id: 'r3', name: 'Hat', src: { type: 'synth', voice: 'hat' }, steps: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  { id: 'r4', name: 'Open', src: { type: 'synth', voice: 'open' }, steps: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
  { id: 'r5', name: 'Tape', src: null, steps: blank() },
].map((r) => ({ low: 0, mid: 0, high: 0, vol: 0.8, mute: false, ...r }));

let rows = load();
let len = loadLen();
const SONG_KEY = 'beatroom.song';
export const SECTIONS = ['A', 'B', 'C', 'D'];
const stepMap = (rs) => Object.fromEntries(rs.map((r) => [r.id, r.steps]));
const hasNotes = (sec) => Object.values(sec.steps).some((a) => a.some(Boolean));
let song = loadSong();
{ // show the section being edited
  const S = song.sections[song.edit];
  len = S.len; rows = rows.map((r) => ({ ...r, steps: S.steps[r.id] ? [...S.steps[r.id]] : blank(S.len) }));
}
function loadSong() {
  try {
    const v = JSON.parse(localStorage.getItem(SONG_KEY));
    if (v && Array.isArray(v.sections) && v.sections.length === 4) {
      const sections = v.sections.map((sec) => {
        const n = LENGTHS.includes(sec?.len) ? sec.len : 16;
        const steps = {};
        for (const r of DEFAULT_ROWS) { const a = sec?.steps?.[r.id]; steps[r.id] = Array.from({ length: n }, (_, i) => (Array.isArray(a) && a[i] ? 1 : 0)); }
        return { len: n, steps };
      });
      return { sections, edit: Math.max(0, Math.min(3, v.edit | 0)), mode: v.mode === 'song' ? 'song' : 'loop' };
    }
  } catch { /* fall through */ }
  // first run (or older save): the current pattern becomes section A
  const empty = () => ({ len: 16, steps: Object.fromEntries(DEFAULT_ROWS.map((r) => [r.id, blank(16)])) });
  return { sections: [{ len, steps: stepMap(rows) }, empty(), empty(), empty()], edit: 0, mode: 'loop' };
}
const songSubs = new Set();
let songView = null;
function refreshSong() {
  songView = { edit: song.edit, mode: song.mode, info: song.sections.map((sec) => ({ len: sec.len, notes: hasNotes(sec) })) };
  songSubs.forEach((fn) => fn(songView));
}
export const onSong = (fn) => (songSubs.add(fn), () => songSubs.delete(fn));
export const getSong = () => songView;
const subs = new Set();
const channels = new Map();
const voicesOut = new Map(); // row id -> last sample source, for choke

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved) && saved.length === DEFAULT_ROWS.length) {
      return saved.map((r, i) => {
        const st = Array.isArray(r.steps) ? r.steps : blank();
        const n = st.length >= 64 ? 64 : st.length >= 32 ? 32 : 16;
        return { ...DEFAULT_ROWS[i], ...r, steps: [...st.slice(0, n), ...blank(Math.max(0, n - st.length))] };
      });
    }
  } catch { /* fall through */ }
  return structuredClone(DEFAULT_ROWS);
}
function loadLen() {
  const n = rows[0]?.steps.length;
  return LENGTHS.includes(n) ? n : 16;
}
let saveT = 0;
function commit(next) {
  rows = next;
  song.sections[song.edit] = { len, steps: stepMap(rows) };
  subs.forEach((fn) => fn(rows));
  rows.forEach((r) => channels.get(r.id)?.set(r));
  refreshSong();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); localStorage.setItem(SONG_KEY, JSON.stringify(song)); } catch { /* storage off */ }
  }, 250);
}

export const getRows = () => rows;
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));

function channel(row) {
  let ch = channels.get(row.id);
  if (!ch) { ch = createChannel(audio(), out()); ch.set(row); channels.set(row.id, ch); }
  return ch;
}

function sound(row, time) {
  const ac = audio(); if (!ac || !row.src) return;
  const dest = channel(row).input;
  if (row.src.type === 'synth') { VOICES[row.src.voice]?.(ac, dest, time); return; }
  const clip = library.get(row.src.clipId); if (!clip) return;
  const prev = voicesOut.get(row.id);
  if (prev) { try { prev.stop(time); } catch { /* ended */ } }
  voicesOut.set(row.id, playSample(ac, dest, clip.buffer, time, { maxLen: Math.min(clip.duration, 4) }));
}

// ---------- playback ----------
// The cursor walks the song one step at a time; marks remember which section/step each
// transport step played, so the UI and loop record can line up with what's sounding.
const cursor = { sec: 0, pos: 0 };
const marks = new Map();
function nextSec(from) {
  for (let k = 1; k <= 4; k++) { const i = (from + k) % 4; if (hasNotes(song.sections[i])) return i; }
  return from;
}
function firstSec() {
  if (song.mode === 'loop') return song.edit;
  const i = song.sections.findIndex(hasNotes);
  return i < 0 ? song.edit : i;
}
definePart('pattern', (step, time, dur, abs) => {
  if (abs === 0) { cursor.sec = firstSec(); cursor.pos = 0; marks.clear(); }
  const S = song.sections[cursor.sec];
  for (const r of rows) if (S.steps[r.id]?.[cursor.pos]) sound(r, time);
  marks.set(abs, { sec: cursor.sec, pos: cursor.pos, len: S.len });
  if (marks.size > 96) marks.delete(marks.keys().next().value);
  if (++cursor.pos >= S.len) { cursor.pos = 0; cursor.sec = song.mode === 'song' ? nextSec(cursor.sec) : song.edit; }
});
/** Which section and step a transport step played (null if unknown). */
export const posAt = (abs) => marks.get(abs) || null;

/** Edit another section: the grid switches to it (and Loop mode moves there at the end of the bar). */
export function setEdit(i) {
  if (i === song.edit || !song.sections[i]) return;
  song.edit = i;
  const S = song.sections[i];
  len = S.len;
  commit(rows.map((r) => ({ ...r, steps: [...(S.steps[r.id] || blank(S.len))] })));
}
export function setMode(mode) { song.mode = mode === 'song' ? 'song' : 'loop'; refreshSong(); commit(rows); }
/** Copy the section being edited onto another one, then edit that one. */
export function copyTo(i) {
  if (i === song.edit || !song.sections[i]) return;
  song.sections[i] = structuredClone(song.sections[song.edit]);
  song.edit = -1; setEdit(i);
}

/** Pattern length in steps (16, 32 or 64). */
export const getLength = () => len;
/** Change the length. Longer repeats what's there so the groove carries on; shorter keeps the start. */
export function setLength(n) {
  if (!LENGTHS.includes(n) || n === len) return;
  len = n;
  commit(rows.map((r) => ({ ...r, steps: Array.from({ length: n }, (_, i) => r.steps[i % r.steps.length]) })));
}

// ---------- loop record ----------
// state: 'off' | 'armed' (waiting for the top of the pattern) | 'rec' (recording this pass)
const rec = { state: 'off', start: 0, minAbs: 0, last: { abs: -1, time: 0, dur: 0.15 } };
const recSubs = new Set();
export const getRec = () => rec.state;
export const onRec = (fn) => (recSubs.add(fn), () => recSubs.delete(fn));
const setRec = (st) => { rec.state = st; recSubs.forEach((fn) => fn(st)); };

onStep((i, abs, time, dur) => {
  if (i < 0) { rec.last.abs = -1; if (rec.state !== 'off') setRec('off'); return; }
  rec.last = { abs, time, dur };
  const m = posAt(abs);
  if (rec.state === 'armed' && m && m.pos === 0 && m.sec === song.edit && abs >= rec.minAbs) { rec.start = abs; setRec('rec'); }
  else if (rec.state === 'rec' && abs - rec.start >= len) setRec('off');
});

/** Arm loop record (starts the pattern if it's stopped), or cancel it. */
export function toggleRec() {
  if (rec.state !== 'off') { setRec('off'); return; }
  // from a stop the pattern plays one pass first as a count-in; if it's already looping,
  // recording starts at the top of the next pass
  // recording always works on the section you're looking at, so it switches to Loop mode
  if (song.mode !== 'loop') setMode('loop');
  rec.minAbs = isArmed('pattern') ? 0 : len;
  setRec('armed');
  if (!isArmed('pattern')) play(true);
}

/** Live pad hit: plays the row now and, while recording, writes it to the nearest step. */
const hitListeners = new Set();
export const onPerform = fn => { hitListeners.add(fn); return () => hitListeners.delete(fn); };
export function perform(ri) {
  if (!rows[ri]?.src) return;
  hitListeners.forEach(fn => fn(ri));
  const ac = audio(); if (!ac) return;
  sound(rows[ri], ac.currentTime);
  const L = rec.last; if (rec.state === 'off' || L.abs < 0) return;
  const abs = L.abs + Math.round((ac.currentTime - L.time) / L.dur);
  // a hit just ahead of the downbeat while armed counts as the first step of the take
  if (rec.state === 'armed') {
    const m = posAt(abs);
    if (!m || m.pos !== 0 || m.sec !== song.edit || abs < rec.minAbs) return;
    rec.start = abs; setRec('rec');
  }
  if (abs - rec.start >= len || abs < rec.start) return;
  const i = abs - rec.start;
  if (rows[ri].steps[i]) return;
  commit(rows.map((r, k) => (k === ri ? { ...r, steps: r.steps.map((v, j) => (j === i ? 1 : v)) } : r)));
}

export function toggleStep(ri, i) {
  const next = rows.map((r, k) => (k === ri ? { ...r, steps: r.steps.map((v, j) => (j === i ? (v ? 0 : 1) : v)) } : r));
  commit(next);
  if (next[ri].steps[i] && !isArmed('pattern')) hit(ri);
}
export function setRow(ri, patch) { commit(rows.map((r, k) => (k === ri ? { ...r, ...patch } : r))); }
export function clear() { commit(rows.map((r) => ({ ...r, steps: blank(len) }))); }
export function hit(ri) { const ac = audio(); if (ac) sound(rows[ri], ac.currentTime); }

/** Put a clip on a row (defaults to the Tape row) and name the row after it. */
export function loadClip(clipId, ri = rows.length - 1) {
  const clip = library.get(clipId); if (!clip) return;
  setRow(ri, { src: { type: 'sample', clipId }, name: clip.name.slice(0, 8) });
}

export const isPlaying = () => isArmed('pattern');
export function play(on) { if (!on && rec.state !== 'off') setRec('off'); arm('pattern', on); }

// when a clip is deleted, rows using it go quiet instead of pointing at nothing
let loadedOnce = false;
library.subscribe((list) => {
  if (!loadedOnce) return;
  const ids = new Set(list.map((c) => c.id));
  const gone = (r) => r.src?.type === 'sample' && !ids.has(r.src.clipId);
  if (rows.some(gone)) commit(rows.map((r) => (gone(r) ? { ...r, src: null } : r)));
});
library.loadAll().then(() => { loadedOnce = true; });
refreshSong();
