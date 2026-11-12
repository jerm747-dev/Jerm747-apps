// The sample library: the glue between sections. The tape deck records into it, the turntable
// imports files into it, the "print" button saves effected takes into it, and any sequencer row
// can load any clip from it. Clips persist in this browser (IndexedDB), so they survive reloads.
const DB = 'beatroom', STORE = 'clips';
const clips = new Map();
const subs = new Set();
let loaded = null;

let snapshot = []; // stable between changes, so React's useSyncExternalStore can read it directly
const emit = () => { snapshot = [...clips.values()].sort((a, b) => a.created - b.created); subs.forEach((fn) => fn(snapshot)); };
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const list = () => snapshot;
export const get = (id) => clips.get(id) || null;

function openDb() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
      t.oncomplete = () => res(out?.result); t.onerror = () => rej(t.error);
    });
  } catch { return undefined; } // private mode or storage blocked: the library still works for this visit
}

function toRecord(c) {
  const ch = []; for (let i = 0; i < c.buffer.numberOfChannels; i++) ch.push(c.buffer.getChannelData(i).slice());
  return { id: c.id, name: c.name, created: c.created, source: c.source, sampleRate: c.buffer.sampleRate, ch };
}
function fromRecord(r) {
  const buffer = new AudioBuffer({ length: r.ch[0].length, numberOfChannels: r.ch.length, sampleRate: r.sampleRate });
  r.ch.forEach((d, i) => buffer.copyToChannel(d, i));
  return { id: r.id, name: r.name, created: r.created, source: r.source, buffer, duration: buffer.duration };
}

/** Load saved clips once. Safe to call many times. */
export function loadAll() {
  if (!loaded) {
    loaded = (async () => {
      const db = await openDb().catch(() => null); if (!db) return;
      const rows = await new Promise((res) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
      for (const r of rows) { try { const c = fromRecord(r); clips.set(c.id, c); } catch { /* skip a bad row */ } }
      emit();
    })();
  }
  return loaded;
}

/** Cut the silence before the first sound (keeps 8 ms), so a recorded hit lands on the step. */
export function trimStart(buffer, threshold = 0.02) {
  const d = buffer.getChannelData(0); let i = 0;
  while (i < d.length && Math.abs(d[i]) < threshold) i++;
  const start = Math.max(0, i - Math.floor(buffer.sampleRate * 0.008));
  if (start < buffer.sampleRate * 0.01 || start >= d.length - 64) return buffer;
  const out = new AudioBuffer({ length: d.length - start, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(start), c);
  return out;
}

const nextName = (prefix) => {
  const n = list().filter((c) => c.name.startsWith(prefix)).length + 1;
  return `${prefix} ${String(n).padStart(2, '0')}`;
};

export function add({ buffer, name, source = 'tape' }) {
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const c = { id, name: name || nextName(source === 'print' ? 'Print' : source === 'file' ? 'File' : source === 'room' ? 'Room' : source === 'bounce' ? 'Bounce' : 'Take'), created: Date.now(), source, buffer, duration: buffer.duration };
  clips.set(id, c); emit();
  tx('readwrite', (s) => s.put(toRecord(c)));
  return c;
}
export function rename(id, name) {
  const c = clips.get(id); if (!c || !name.trim()) return;
  c.name = name.trim().slice(0, 32); emit();
  tx('readwrite', (s) => s.put(toRecord(c)));
}
export function remove(id) {
  if (!clips.delete(id)) return; emit();
  tx('readwrite', (s) => s.delete(id));
}

/** Decode an audio file the user picked into a library clip. */
export async function importFile(ac, file) {
  const buf = await ac.decodeAudioData(await file.arrayBuffer());
  return add({ buffer: buf, name: file.name.replace(/\.[^.]+$/, '').slice(0, 32), source: 'file' });
}
