// Beat Room projects. A project is everything you are building: patterns and sections, the note
// lane, mixer, tempo, synth patch, Drive and Punch, tape and turntable settings, Arrange mode,
// and every sound the project uses (clips loaded on rows, on the turntable, or in Arrange).
//
// File: "<name>.beatroom". Inside it is an ordinary zip (stored, no compression), so it can be
// renamed .zip and opened anywhere:
//   project.json        settings, plus a list of the sounds
//   sounds/<id>.wav     each sound as 16-bit WAV
// Projects saved "on this device" keep the same file in browser storage, listed in the dialog.
// Opening a project writes its settings back and reloads the room at the top.
import * as library from './library.js';

export const EXT = 'beatroom';
const FORMAT = 'jerm747-beatroom';
// Settings that belong to a project. Device things (MIDI mapping, view layout, clicks) stay put.
export const PROJECT_KEYS = ['beatroom.pads', 'beatroom.song', 'beatroom.notes', 'beatroom.bpm', 'beatroom.synth.current',
  'beatroom.synth.patches', 'beatroom.drive.v2', 'beatroom.tape', 'beatroom.master', 'beatroom.vinyl', 'beatroom.arrange', 'beatroom.mode', 'beatroom.export'];
const NAME_KEY = 'beatroom.project';

// ---------- current project name ----------
const subs = new Set();
let current = (() => { try { return JSON.parse(localStorage.getItem(NAME_KEY)) || { name: 'Untitled' }; } catch { return { name: 'Untitled' }; } })();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const getCurrent = () => current;
function setCurrent(next) { current = next; try { localStorage.setItem(NAME_KEY, JSON.stringify(current)); } catch { /* off */ } subs.forEach((fn) => fn(current)); }
export const rename = (name) => setCurrent({ ...current, name: (name || '').trim().slice(0, 60) || 'Untitled' });

// ---------- zip (stored) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/x-beatroom' });
}
function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), out = new Map();
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('That isn’t a Beat Room project file.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The project file is damaged.');
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    if (method !== 0) throw new Error('This project was repacked with compression. Save it again from Beat Room.');
    const ln = v.getUint16(local + 26, true), lx = v.getUint16(local + 28, true), start = local + 30 + ln + lx;
    out.set(name, u8.subarray(start, start + size));
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---------- sounds ----------
function wav(buffer) {
  const chs = Math.min(2, buffer.numberOfChannels), n = buffer.length, sr = buffer.sampleRate;
  const v = new DataView(new ArrayBuffer(44 + n * chs * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * chs * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, chs, true); v.setUint32(24, sr, true); v.setUint32(28, sr * chs * 2, true); v.setUint16(32, chs * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * chs * 2, true);
  const data = [...Array(chs)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < chs; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Uint8Array(v.buffer);
}
function unwav(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 12, fmt = null;
  while (p + 8 <= u8.length) {
    const id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]), size = v.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = { ch: v.getUint16(p + 10, true), sr: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    if (id === 'data' && fmt) {
      const n = Math.floor(size / (fmt.ch * 2)), buffer = new AudioBuffer({ length: Math.max(1, n), numberOfChannels: fmt.ch, sampleRate: fmt.sr });
      for (let c = 0; c < fmt.ch; c++) { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = v.getInt16(p + 8 + (i * fmt.ch + c) * 2, true) / 0x8000; buffer.copyToChannel(d, c); }
      return buffer;
    }
    p += 8 + size + (size & 1);
  }
  throw new Error('A sound in the project is damaged.');
}
/** Clip ids the project uses: sounds on rows and in Arrange. */
function usedClips(keys) {
  const ids = new Set();
  const json = (k) => { try { return JSON.parse(keys[k] || 'null'); } catch { return null; } };
  for (const r of json('beatroom.pads') || []) if (r?.src?.type === 'sample' && r.src.clipId) ids.add(r.src.clipId);
  for (const c of json('beatroom.arrange')?.clips || []) if (c?.clipId) ids.add(c.clipId);
  return [...ids].filter((id) => library.get(id));
}

// ---------- build / open ----------
export function snapshot() {
  const keys = {};
  for (const k of PROJECT_KEYS) { try { const v = localStorage.getItem(k); if (v != null) keys[k] = v; } catch { /* off */ } }
  return keys;
}
/** The current room as a .beatroom file (Blob). */
export async function build(name = current.name) {
  await library.loadAll();
  const keys = snapshot(), ids = usedClips(keys), enc = new TextEncoder();
  const sounds = ids.map((id) => { const c = library.get(id); return { id, name: c.name, source: c.source, file: `sounds/${id}.wav` }; });
  const manifest = { format: FORMAT, version: 1, name, saved: new Date().toISOString(), app: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev', keys, sounds };
  const files = [{ name: 'project.json', data: enc.encode(JSON.stringify(manifest, null, 1)) }];
  for (const s of sounds) files.push({ name: s.file, data: wav(library.get(s.id).buffer) });
  return { blob: zip(files), sounds: sounds.length };
}
/** Read a project file without changing anything. */
export async function read(fileOrBlob) {
  const files = unzip(await fileOrBlob.arrayBuffer());
  const raw = files.get('project.json'); if (!raw) throw new Error('That isn’t a Beat Room project file.');
  const m = JSON.parse(new TextDecoder().decode(raw));
  if (m.format !== FORMAT) throw new Error('That isn’t a Beat Room project file.');
  return { manifest: m, files };
}
/** Put a project in the room: sounds into the library, settings back, then reload at the top. */
export async function open(fileOrBlob, savedId) {
  const { manifest: m, files } = await read(fileOrBlob);
  await library.loadAll();
  for (const s of m.sounds || []) {
    if (library.get(s.id)) continue;
    const data = files.get(s.file); if (!data) continue;
    await library.addWithId({ id: s.id, name: s.name, source: s.source || 'file', buffer: unwav(data) });
  }
  try {
    for (const k of PROJECT_KEYS) { if (k in (m.keys || {})) localStorage.setItem(k, m.keys[k]); else localStorage.removeItem(k); }
  } catch { throw new Error('Browser storage is blocked, so the project can’t be opened here.'); }
  setCurrent({ name: m.name || 'Untitled', id: savedId });
  reloadTop();
}
/** Start fresh: clears the project settings (sounds stay in the Sample bin). */
export function fresh(name = 'Untitled') {
  try { for (const k of PROJECT_KEYS) localStorage.removeItem(k); } catch { /* off */ }
  setCurrent({ name });
  reloadTop();
}
function reloadTop() {
  try { sessionStorage.setItem('beatroom.skipSplash', '1'); } catch { /* off */ }
  window.scrollTo(0, 0);
  location.reload();
}

// ---------- projects kept on this device ----------
const DB = 'beatroom-projects', STORE = 'projects';
function db() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Browser storage is off here.'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('Browser storage is blocked.'));
  });
}
async function run(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); });
}
const listSubs = new Set();
let saved = [];
export const onList = (fn) => (listSubs.add(fn), () => listSubs.delete(fn));
export const getList = () => saved;
export async function loadList() {
  try { saved = ((await run('readonly', (s) => s.getAll())) || []).map(({ blob, ...r }) => ({ ...r, size: blob?.size || 0 })).sort((a, b) => b.updated - a.updated); }
  catch { saved = []; }
  listSubs.forEach((fn) => fn(saved)); return saved;
}
/** Save the room as a project on this device (same name updates it). Returns the record. */
export async function saveHere(name = current.name) {
  const { blob, sounds } = await build(name);
  const existing = saved.find((p) => p.id === current.id && p.name === name) || saved.find((p) => p.name === name);
  const id = existing?.id || `p${Date.now().toString(36)}`;
  await run('readwrite', (s) => s.put({ id, name, updated: Date.now(), sounds, blob }));
  setCurrent({ name, id });
  await loadList();
  return { id, name, sounds, blob };
}
export async function openSaved(id) {
  const rec = await run('readonly', (s) => s.get(id)); if (!rec) throw new Error('That project is gone.');
  await open(rec.blob, id);
}
export async function removeSaved(id) { await run('readwrite', (s) => s.delete(id)); if (current.id === id) setCurrent({ name: current.name }); await loadList(); }
