// Sequencer state, shared by the Rhythm Composer UI and the clock. Each row has a sound source
// (a synth voice or a library clip), 16 steps, and its own mixer channel (EQ + level + mute).
import { audio, out } from './audio.js';
import { createChannel } from './channel.js';
import { VOICES, playSample } from './voices.js';
import { definePart, arm, isArmed } from './clock.js';
import * as library from './library.js';

const KEY = 'beatroom.pads';
const blank = () => Array(16).fill(0);
const DEFAULT_ROWS = [
  { id: 'r1', name: 'Kick', src: { type: 'synth', voice: 'kick' }, steps: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0] },
  { id: 'r2', name: 'Clap', src: { type: 'synth', voice: 'clap' }, steps: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1] },
  { id: 'r3', name: 'Hat', src: { type: 'synth', voice: 'hat' }, steps: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  { id: 'r4', name: 'Open', src: { type: 'synth', voice: 'open' }, steps: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0] },
  { id: 'r5', name: 'Tape', src: null, steps: blank() },
].map((r) => ({ low: 0, mid: 0, high: 0, vol: 0.8, mute: false, ...r }));

let rows = load();
const subs = new Set();
const channels = new Map();
const voicesOut = new Map(); // row id -> last sample source, for choke

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved) && saved.length === DEFAULT_ROWS.length) return saved.map((r, i) => ({ ...DEFAULT_ROWS[i], ...r, steps: (r.steps || blank()).slice(0, 16) }));
  } catch { /* fall through */ }
  return structuredClone(DEFAULT_ROWS);
}
let saveT = 0;
function commit(next) {
  rows = next;
  subs.forEach((fn) => fn(rows));
  rows.forEach((r) => channels.get(r.id)?.set(r));
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* storage off */ } }, 250);
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

definePart('pattern', (step, time) => {
  for (const r of rows) if (r.steps[step]) sound(r, time);
});

export function toggleStep(ri, i) {
  const next = rows.map((r, k) => (k === ri ? { ...r, steps: r.steps.map((v, j) => (j === i ? (v ? 0 : 1) : v)) } : r));
  commit(next);
  if (next[ri].steps[i] && !isArmed('pattern')) hit(ri);
}
export function setRow(ri, patch) { commit(rows.map((r, k) => (k === ri ? { ...r, ...patch } : r))); }
export function clear() { commit(rows.map((r) => ({ ...r, steps: blank() }))); }
export function hit(ri) { const ac = audio(); if (ac) sound(rows[ri], ac.currentTime); }

/** Put a clip on a row (defaults to the Tape row) and name the row after it. */
export function loadClip(clipId, ri = rows.length - 1) {
  const clip = library.get(clipId); if (!clip) return;
  setRow(ri, { src: { type: 'sample', clipId }, name: clip.name.slice(0, 8) });
}

export const isPlaying = () => isArmed('pattern');
export const play = (on) => arm('pattern', on);

// when a clip is deleted, rows using it go quiet instead of pointing at nothing
let loadedOnce = false;
library.subscribe((list) => {
  if (!loadedOnce) return;
  const ids = new Set(list.map((c) => c.id));
  const gone = (r) => r.src?.type === 'sample' && !ids.has(r.src.clipId);
  if (rows.some(gone)) commit(rows.map((r) => (gone(r) ? { ...r, src: null } : r)));
});
library.loadAll().then(() => { loadedOnce = true; });
