// Song export: bounce the song (or one section) in real time through the tape's Room recorder,
// encode it as WAV or MP3, keep it on the local song shelf with a snapshot of the whole room
// (patterns, notes, mixer, tempo, synth patch, Drive), and hand the file to the device.
//
// Bounce = play from the top on an exact audio time, record the room from that same moment,
// stop the pattern at the end of the arrangement, keep a short tail for releases, trim silence.
import { audio } from './audio.js';
import { stepDur, isRunning } from './clock.js';
import { startTake } from './taperec.js';
import * as pads from './pads.js';

// ---------- arrangement ----------
/** Steps the export covers. scope 'song': each section with notes, in order, times its repeats.
 *  scope 'section': the section being edited, times its repeats. */
export function plan(scope) {
  const song = pads.getSong(); if (!song) return null;
  if (scope === 'section') {
    const s = song.info[song.edit];
    return { steps: s.len * s.reps, parts: [`${pads.SECTIONS[song.edit]}×${s.reps}`] };
  }
  const parts = [], idx = song.info.map((s, i) => i).filter((i) => song.info[i].notes);
  if (!idx.length) return null;
  let steps = 0;
  for (const i of idx) { steps += song.info[i].len * song.info[i].reps; parts.push(`${pads.SECTIONS[i]}×${song.info[i].reps}`); }
  return { steps, parts };
}

const TAIL = 2.0; // seconds after the last step, for synth releases and the drum decays

/** Bounce in real time. onProgress(0..1). Returns { done: Promise<AudioBuffer>, cancel() }. */
export function bounce(scope, onProgress = () => {}) {
  const ac = audio(); if (!ac) throw new Error('Audio is not available in this browser.');
  const p = plan(scope); if (!p) throw new Error('The song is empty. Put some notes in a section first.');
  if (isRunning()) pads.play(false);
  const prevMode = pads.getSong().mode;
  pads.setMode(scope === 'section' ? 'loop' : 'song');
  let cancelled = false, take = null, timer = 0, stopT = 0, raf = 0;
  const done = (async () => {
    await new Promise((r) => setTimeout(r, 120)); // let a stopped transport settle
    const at = ac.currentTime + 0.25, len = p.steps * stepDur(), end = at + len;
    take = await startTake({ source: 'room', at });
    take.stopAt(end + TAIL);
    pads.play(true, at);
    // stop the pattern just before the clock would book the first step past the end
    stopT = setTimeout(() => pads.play(false), Math.max(0, (end - 0.13 - ac.currentTime) * 1000));
    const tick = () => { onProgress(Math.max(0, Math.min(1, (ac.currentTime - at) / (len + TAIL)))); if (!cancelled) raf = requestAnimationFrame(tick); };
    tick();
    await new Promise((r) => { timer = setTimeout(r, Math.max(0, (end + TAIL - ac.currentTime) * 1000) + 60); });
    if (cancelled) throw new Error('cancelled');
    const buf = await take.stop(end + TAIL);
    onProgress(1);
    return trimEnd(buf);
  })().finally(() => { cancelAnimationFrame(raf); clearTimeout(stopT); pads.setMode(prevMode); });
  return {
    plan: p,
    done,
    cancel() { cancelled = true; clearTimeout(timer); clearTimeout(stopT); pads.play(false); take?.cancel(); },
  };
}

/** Cut silence off the end (keeps 120 ms after the last sound). */
function trimEnd(buf) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1);
  let last = buf.length - 1;
  while (last > 0 && Math.abs(L[last]) < 0.0008 && Math.abs(R[last]) < 0.0008) last--;
  const n = Math.min(buf.length, last + Math.round(sr * 0.12));
  if (n >= buf.length - 1 || n < sr * 0.2) return buf;
  const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
  out.copyToChannel(L.subarray(0, n), 0); out.copyToChannel(R.subarray(0, n), 1);
  return out;
}

// ---------- encoding ----------
/** 16-bit PCM stereo WAV. */
export function toWav(buf) {
  const ch = [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)];
  const n = buf.length, sr = buf.sampleRate, bytes = n * 4;
  const v = new DataView(new ArrayBuffer(44 + bytes));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const x = Math.max(-1, Math.min(1, ch[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([v.buffer], { type: 'audio/wav' });
}

// MP3 uses lamejs, loaded the first time it's needed. (For an offline build, bundle lamejs and
// set window.lamejs before calling toMp3.)
const LAME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
let lameP = null;
function loadLame() {
  if (window.lamejs) return Promise.resolve(window.lamejs);
  if (!lameP) {
    lameP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LAME_URL; s.async = true;
      s.onload = () => (window.lamejs ? res(window.lamejs) : rej(new Error('MP3 encoder did not start.')));
      s.onerror = () => { lameP = null; rej(new Error('Could not load the MP3 encoder. Check the connection, or export as WAV.')); };
      document.head.appendChild(s);
    });
  }
  return lameP;
}
/** MP3 at the given bitrate (kbps). onProgress(0..1) while encoding. */
export async function toMp3(buf, kbps = 192, onProgress = () => {}) {
  const lame = await loadLame();
  const sr = buf.sampleRate, n = buf.length;
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const enc = new lame.Mp3Encoder(2, sr, kbps);
  const toI16 = (src, a, b) => { const o = new Int16Array(b - a); for (let i = a; i < b; i++) { const x = Math.max(-1, Math.min(1, src[i])); o[i - a] = x < 0 ? x * 0x8000 : x * 0x7fff; } return o; };
  const parts = [], BLOCK = 1152 * 20;
  for (let i = 0; i < n; i += BLOCK) {
    const b = Math.min(n, i + BLOCK);
    const out = enc.encodeBuffer(toI16(L, i, b), toI16(R, i, b));
    if (out.length) parts.push(new Uint8Array(out));
    if ((i / BLOCK) % 8 === 0) { onProgress(i / n); await new Promise((r) => setTimeout(r, 0)); }
  }
  const tail = enc.flush(); if (tail.length) parts.push(new Uint8Array(tail));
  onProgress(1);
  return new Blob(parts, { type: 'audio/mpeg' });
}

// ---------- the song shelf (this device) ----------
// Each saved song: { id, name, created, format, duration, blob, project }. project is a snapshot
// of the room's saved settings, so Recall puts the whole room back the way it was.
const DB = 'beatroom-songs', STORE = 'songs';
const PROJECT_KEYS = ['beatroom.pads', 'beatroom.song', 'beatroom.notes', 'beatroom.bpm', 'beatroom.synth.current', 'beatroom.drive.v2', 'beatroom.tape', 'beatroom.master'];

function openDb() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Saving songs needs browser storage, which is off here.'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('Browser storage is blocked.'));
  });
}
async function run(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error || new Error('Could not save to browser storage.'));
  });
}
const subs = new Set();
let shelf = [];
const emit = () => subs.forEach((fn) => fn(shelf));
export const onShelf = (fn) => (subs.add(fn), () => subs.delete(fn));
export const getShelf = () => shelf;
export async function loadShelf() {
  try { shelf = ((await run('readonly', (s) => s.getAll())) || []).sort((a, b) => b.created - a.created); }
  catch { shelf = []; }
  emit(); return shelf;
}

export function snapshot() {
  const project = {};
  for (const k of PROJECT_KEYS) { try { const v = localStorage.getItem(k); if (v != null) project[k] = v; } catch { /* storage off */ } }
  return project;
}

export async function saveSong({ name, format, blob, duration }) {
  const rec = { id: `s${Date.now().toString(36)}`, name: (name || 'Untitled').trim().slice(0, 60) || 'Untitled', created: Date.now(), format, duration, blob, project: snapshot() };
  await run('readwrite', (s) => s.put(rec));
  await loadShelf();
  return rec;
}
export async function removeSong(id) { await run('readwrite', (s) => s.delete(id)); await loadShelf(); }

/** Put the room back the way it was when the song was saved (reloads the page). */
export function recall(rec) {
  try {
    for (const k of PROJECT_KEYS) { if (k in rec.project) localStorage.setItem(k, rec.project[k]); else localStorage.removeItem(k); }
  } catch { throw new Error('Browser storage is blocked, so the room can’t be restored here.'); }
  location.reload();
}

// ---------- handing the file over ----------
export const fileName = (name, format) => `${(name || 'Untitled').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'Untitled'}.${format}`;

/**
 * Save the file to the device. Inside a published claude.ai page this goes through the viewer's
 * save prompt (which may not accept audio files); in your own build it's a normal download.
 * Resolves 'saved'; rejects with a readable message.
 */
export async function saveFile(name, format, blob) {
  const filename = fileName(name, format);
  // Android app: the WebView ignores downloads, so the app opens Android's "Save to…" picker
  if (window.BeatRoomAndroid?.saveFile) {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsDataURL(blob); });
    const ok = await new Promise((res) => { window.__beatRoomSaved = (v) => res(!!v); window.BeatRoomAndroid.saveFile(filename, blob.type || 'application/octet-stream', b64); });
    if (!ok) throw new Error('Save cancelled.');
    return 'saved';
  }
  if (window.claude?.use) {
    const dl = await window.claude.use('downloads');
    if (!dl) throw new Error('This page can’t save files here. The song is in the Sample bin and on your Bounced songs list.');
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) {
      if (e?.code === 'declined') throw new Error('Save cancelled.');
      if (e?.code === 'rejected_extension' || e?.code === 'extension_not_enabled') throw new Error(`This preview page can’t save .${format} files. It’s in the Sample bin; your own Beat Room build and the app save it as a file.`);
      if (e?.code === 'rate_limited') throw new Error('A save prompt is already open. Try again in a moment.');
      throw new Error('This page can’t save files here. The song is in the Sample bin and on your Bounced songs list.');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
}
