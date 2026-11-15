// Arrange mode: loops end to end on one track, for stringing same-tempo loops (a loop pedal's
// layers, bounced sections, files) into a song. Each block is a sound from the Sample bin with a
// repeat count; blocks play back to back, sample-accurately, through the bus, so 747 Drive and
// Punch colour them like everything else. Sections and the rhythm composer are not used here.
//
// Export renders offline (faster than real time) through the same Drive chain, then encodes MP3.
import { audio, out } from './audio.js';
import * as library from './library.js';
import { buildOffline } from './character.js';

const KEY = 'beatroom.arrange', MODE_KEY = 'beatroom.mode';
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && Array.isArray(v.clips)) return { clips: v.clips.filter((c) => c && typeof c.clipId === 'string').map((c) => ({ uid: c.uid || uid(), clipId: c.clipId, reps: clampReps(c.reps) })) };
  } catch { /* fall through */ }
  return { clips: [] };
};
function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }
function clampReps(n) { return Number.isFinite(+n) ? Math.max(1, Math.min(32, Math.round(+n))) : 1; }
let st = load();
let mode = (() => { try { return localStorage.getItem(MODE_KEY) === 'arrange' ? 'arrange' : 'sections'; } catch { return 'sections'; } })();

const subs = new Set();
let view = null;
function refresh() {
  const blocks = st.clips.map((c) => { const clip = library.get(c.clipId); return { ...c, name: clip?.name || 'Missing sound', dur: clip?.duration || 0, missing: !clip }; });
  let t = 0;
  for (const b of blocks) { b.start = t; t += b.dur * b.reps; }
  view = { mode, blocks, total: t, playing: !!play.sources.length, at: play.index, startedAt: play.t0 };
  subs.forEach((fn) => fn(view));
}
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const get = () => view;
library.subscribe(() => refresh());

function commit(next) {
  st = next; refresh();
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* off */ }
}
export function setMode(m) {
  mode = m === 'arrange' ? 'arrange' : 'sections';
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* off */ }
  if (mode !== 'arrange') stop();
  refresh();
}
export const getMode = () => mode;

// ---------- editing ----------
export function addClip(clipId, at = st.clips.length) {
  if (!library.get(clipId)) return;
  const clips = [...st.clips]; clips.splice(at, 0, { uid: uid(), clipId, reps: 1 });
  stop(); commit({ ...st, clips });
}
/** Import audio files (e.g. loop-pedal loops) into the Sample bin and append them in order. */
export async function addFiles(files) {
  const ac = audio(); if (!ac) throw new Error('Audio is not available in this browser.');
  let n = 0;
  for (const f of files) {
    try { const c = await library.importFile(ac, f); addClip(c.id); n++; } catch { /* skip files that won't decode */ }
  }
  return n;
}
export function move(from, to) {
  if (from === to || from < 0 || from >= st.clips.length) return;
  const clips = [...st.clips]; const [b] = clips.splice(from, 1); clips.splice(Math.max(0, Math.min(clips.length, to)), 0, b);
  stop(); commit({ ...st, clips });
}
export function setReps(i, reps) { stop(); commit({ ...st, clips: st.clips.map((c, k) => (k === i ? { ...c, reps: clampReps(reps) } : c)) }); }
export function duplicate(i) { const c = st.clips[i]; if (!c) return; const clips = [...st.clips]; clips.splice(i + 1, 0, { ...c, uid: uid() }); stop(); commit({ ...st, clips }); }
export function remove(i) { stop(); commit({ ...st, clips: st.clips.filter((_, k) => k !== i) }); }
export function clear() { stop(); commit({ ...st, clips: [] }); }

// ---------- playback ----------
const play = { sources: [], index: -1, t0: 0, timer: 0 };
/** The order blocks play in, as [blockIndex, buffer] per pass. */
function sequence(from = 0) {
  const seq = [];
  st.clips.forEach((c, i) => { if (i < from) return; const clip = library.get(c.clipId); if (!clip) return; for (let r = 0; r < c.reps; r++) seq.push([i, clip.buffer]); });
  return seq;
}
export function start(from = 0) {
  stop();
  const ac = audio(); if (!ac) return;
  const seq = sequence(from); if (!seq.length) return;
  let t = ac.currentTime + 0.08;
  play.t0 = t; play.marks = [];
  for (const [i, buf] of seq) {
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(out()); s.start(t);
    play.sources.push(s); play.marks.push([t, i]); t += buf.duration;
  }
  play.end = t;
  const tick = () => {
    const now = ac.currentTime;
    if (now >= play.end) { stop(); return; }
    let cur = play.index;
    for (const [mt, i] of play.marks) if (now >= mt) cur = i;
    if (cur !== play.index) { play.index = cur; refresh(); }
    play.timer = setTimeout(tick, 60);
  };
  play.index = seq[0][0]; refresh(); tick();
}
export function stop() {
  clearTimeout(play.timer);
  for (const s of play.sources) { try { s.stop(); } catch { /* ended */ } try { s.disconnect(); } catch { /* gone */ } }
  const was = play.sources.length;
  play.sources = []; play.index = -1;
  if (was) refresh();
}
/** Seconds into the arrangement right now (0 when stopped). */
export function position() { const ac = audio(); return play.sources.length && ac ? Math.max(0, ac.currentTime - play.t0) : 0; }

// ---------- export ----------
/** Render the arrangement through 747 Drive (and Punch) offline. Returns an AudioBuffer. */
export async function render(onProgress = () => {}) {
  const seq = sequence(); if (!seq.length) throw new Error('Arrange is empty. Add some loops first.');
  const sr = seq[0][1].sampleRate || 48000;
  const total = seq.reduce((t, [, b]) => t + b.duration, 0);
  const length = Math.ceil((total + 0.25) * sr);
  const oc = new OfflineAudioContext(2, length, sr);
  const drive = await buildOffline(oc);
  drive.output.connect(oc.destination);
  let t = 0;
  for (const [, buf] of seq) { const s = oc.createBufferSource(); s.buffer = buf; s.connect(drive.input); s.start(t); t += buf.duration; }
  onProgress(0.1);
  try { const buf = await oc.startRendering(); onProgress(1); return buf; }
  finally { drive.release(); }
}

refresh();
