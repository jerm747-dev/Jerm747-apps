// Playback engine: a look-ahead scheduler that books every note at an exact audio time, plays it
// on the track's built-in instrument (Avionyx / Drumway) and sends the same note to the USB MIDI
// output at the matching moment. Also: live note previews, panic, and the offline MP3 bounce.
import { audio, masterIn, buildStrip, buildMaster } from './audio.js';
import { Avionyx } from './avionyx.js';
import { Drumway } from './drumway.js';
import { P, PPQ, BAR, lenTicks } from './model.js';

// ---------- settings ----------
const SKEY = 'midilane.settings';
export const settings = (() => { try { return { builtIn: true, midiOut: true, outId: '', ...JSON.parse(localStorage.getItem(SKEY)) }; } catch { return { builtIn: true, midiOut: true, outId: '' }; } })();
export function setSetting(k, v) { settings[k] = v; try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* off */ } }

// ---------- per-track instruments ----------
const rigs = new Map(); // track id -> { kind, inst, strip }
function makeInst(kind, c, dest) { return kind === 'drumway' ? new Drumway(c, dest) : kind === 'avionyx' ? new Avionyx(c, dest) : null; }
function rig(t) {
  const c = audio(); if (!c) return null;
  let r = rigs.get(t.id);
  if (r && r.kind !== t.inst) { r.inst?.stopAll(); r.strip.dispose(); rigs.delete(t.id); r = null; }
  if (!r) { const strip = buildStrip(c, masterIn(), t.fx, t.vol); r = { kind: t.inst, strip, inst: makeInst(t.inst, c, strip.input) }; rigs.set(t.id, r); }
  r.inst?.setPatch(t.patch);
  return r;
}
const audible = (t) => { const solo = P.tracks.some((x) => x.solo); return !t.mute && (!solo || t.solo); };
/** Push a track's patch / fx / level / mute into its live rig. */
export function refresh(t) { const r = rig(t); if (r) r.strip.update(t.fx, t.vol, audible(t)); }
export function refreshAll() {
  const ids = new Set(P.tracks.map((t) => t.id));
  for (const [id, r] of rigs) if (!ids.has(id)) { r.inst?.stopAll(); r.strip.dispose(); rigs.delete(id); }
  P.tracks.forEach(refresh);
}

// ---------- MIDI out ----------
let access = null, out = null;
export const midi = { state: 'off', msg: '', outputs: [], inputs: [] };
const midiSubs = new Set();
export const onMidi = (fn) => (midiSubs.add(fn), () => midiSubs.delete(fn));
const midiSet = (s) => { Object.assign(midi, s); midiSubs.forEach((fn) => fn(midi)); };
const androidOut = () => typeof window !== 'undefined' && window.MidiLaneAndroid && typeof window.MidiLaneAndroid.midiSend === 'function';
// ---------- MIDI in ----------
const inSubs = new Set();
/** fn({ type: 'on'|'off', ch, n, v, ts }) — ts in performance.now() time */
export const onMidiIn = (fn) => (inSubs.add(fn), () => inSubs.delete(fn));
function feedIn(b0, b1, b2, ts) {
  const type = b0 & 0xf0, ch = b0 & 15;
  if (type !== 0x90 && type !== 0x80) return;
  const ev = { type: type === 0x90 && b2 > 0 ? 'on' : 'off', ch, n: b1 & 127, v: b2 & 127, ts: ts ?? performance.now() };
  inSubs.forEach((fn) => fn(ev));
}
// Raw messages for Live routing: fn(bytes: number[], fromId, ts). fromId is a device id, 'virtual' or 'android'.
const rawSubs = new Set();
export const onMidiRaw = (fn) => (rawSubs.add(fn), () => rawSubs.delete(fn));
const raw = (bytes, from, ts) => rawSubs.forEach((fn) => fn(bytes, from, ts));
// Android app hook: the native side calls window.midiLaneIn(status, data1, data2) for each message it receives
if (typeof window !== 'undefined') window.midiLaneIn = (a, b, c) => { raw([a, b, c], 'android', performance.now()); feedIn(a, b, c, performance.now()); };
/** On-screen keys / pads feed the same path as a USB device. */
export const virtualIn = (type, n, v = 100, ch = 0) => {
  const b = [(type === 'on' ? 0x90 : 0x80) | ch, n, type === 'on' ? v : 0];
  raw(b, 'virtual', performance.now()); feedIn(b[0], b[1], b[2], performance.now());
};
/** Send raw bytes to one output now: a device id, or 'android'. Returns false if it isn't there. */
export function sendTo(outId, bytes) {
  if (outId === 'android') { if (!androidOut()) return false; try { window.MidiLaneAndroid.midiSend(JSON.stringify(bytes), 0); return true; } catch { return false; } }
  let o = null; access?.outputs.forEach((x) => { if (x.id === outId) o = x; });
  if (!o) return false;
  try { o.send(bytes); return true; } catch { return false; }
}
function pickIn() {
  const list = [];
  access.inputs.forEach((i) => {
    if (i.state === 'disconnected') return;
    list.push({ id: i.id, name: i.name || 'MIDI in' });
    i.onmidimessage = (e) => {
      const d = e.data; raw(Array.from(d), i.id, e.timeStamp);
      if (settings.inId && settings.inId !== i.id) return;
      if (d.length >= 3) feedIn(d[0], d[1], d[2], e.timeStamp); else if (d.length === 2) feedIn(d[0], d[1], 0, e.timeStamp);
    };
  });
  midi.inputs = list;
}
export function chooseIn(id) { setSetting('inId', id); }

function pickOut() {
  if (!access) return;
  pickIn();
  const list = []; access.outputs.forEach((o) => { if (o.state !== 'disconnected') list.push({ id: o.id, name: o.name || 'MIDI out' }); });
  out = null; access.outputs.forEach((o) => { if (o.id === settings.outId) out = o; });
  if (!out && list.length) { access.outputs.forEach((o) => { if (!out && o.id === list[0].id) out = o; }); setSetting('outId', list[0].id); }
  midiSet({ state: 'on', outputs: list, msg: list.length || midi.inputs.length ? '' : 'No MIDI device found yet. Plug one in (USB OTG on a phone) and it shows up here.' });
}
export async function connectMidi() {
  if (androidOut()) { midiSet({ state: 'on', outputs: [{ id: 'android', name: 'Android MIDI' }], msg: '' }); return; }
  if (typeof navigator.requestMIDIAccess !== 'function') { midiSet({ state: 'error', msg: 'This browser has no Web MIDI. Chrome or Edge (desktop or Android) has it; Safari doesn’t.' }); return; }
  if (!window.isSecureContext) { midiSet({ state: 'error', msg: 'MIDI needs the site on https (or localhost).' }); return; }
  midiSet({ state: 'wait', msg: 'Asking for MIDI access…' });
  try { access = await navigator.requestMIDIAccess({ sysex: false }); access.onstatechange = pickOut; pickOut(); }
  catch { access = null; midiSet({ state: 'error', msg: 'MIDI access was blocked here. Allow MIDI for the site, or open MIDI Lane from your own site (embedded previews can’t reach USB).' }); }
}
export function chooseOut(id) { setSetting('outId', id); pickOut(); }
function send(bytes, when) {
  if (!settings.midiOut) return;
  const c = audio(); const delay = Math.max(0, (when - c.currentTime) * 1000);
  if (androidOut()) { try { window.MidiLaneAndroid.midiSend(JSON.stringify(bytes), delay); } catch { /* bridge gone */ } return; }
  if (!out) return;
  try { out.send(bytes, performance.now() + delay); } catch { /* device gone */ }
}
function midiNote(t, n, v, when, dur) {
  if (!t.midiOut) return;
  send([0x90 | t.ch, n & 127, Math.max(1, Math.min(127, Math.round(v)))], when);
  send([0x80 | t.ch, n & 127, 0], when + Math.max(0.01, dur));
}

// ---------- transport ----------
const LOOK = 0.12, TICK_MS = 25;
let playing = false, t0 = 0, sched = 0, timer = 0;
let rec = null; // { click, song, exclude } while the Record screen runs
export let startTick = 0;
export const isPlaying = () => playing;
const spt = () => 60 / (P.bpm * PPQ);
export function setStart(tick) { startTick = Math.max(0, Math.min(lenTicks() - 1, tick)); if (playing) { stop(); play(); } }

function click(when, accent) {
  const c = audio(), o = c.createOscillator(), g = c.createGain();
  o.frequency.value = accent ? 1760 : 1175; o.type = 'triangle';
  g.gain.setValueAtTime(accent ? 0.5 : 0.32, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  o.connect(g).connect(masterIn()); o.start(when); o.stop(when + 0.06);
}
function pumpRec() {
  const c = audio(), s = spt(), len = lenTicks();
  const horizon = (c.currentTime + LOOK - t0) / s;
  if (horizon <= sched) return;
  if (rec.click) for (let b = Math.ceil(sched / PPQ) * PPQ; b < horizon; b += PPQ) click(t0 + b * s, ((b % BAR) + BAR) % BAR === 0);
  if (rec.song) for (const t of P.tracks) {
    if (t.id === rec.exclude || !audible(t)) continue;
    const r = settings.builtIn ? rig(t) : null;
    for (const x of t.notes) {
      if (x.t < sched || x.t >= horizon || x.t >= len) continue;
      const when = t0 + x.t * s, dur = Math.min(x.d, len - x.t) * s;
      r?.inst?.play(x.n, x.v, when, dur); midiNote(t, x.n, x.v, when, dur);
    }
  }
  sched = horizon;
}
function pump() {
  if (rec) return pumpRec();
  const c = audio(), len = lenTicks(), s = spt();
  const horizon = (c.currentTime + LOOK - t0) / s;
  while (sched < horizon) {
    const base = Math.floor(sched / len) * len, end = Math.min(horizon, base + len);
    const a = sched - base, b = end - base;
    for (const t of P.tracks) {
      if (!audible(t)) continue;
      const r = settings.builtIn ? rig(t) : null;
      for (const x of t.notes) {
        if (x.t < a || x.t >= b || x.t >= len) continue;
        const when = t0 + (base + x.t) * s, dur = Math.min(x.d, len - x.t) * s;
        r?.inst?.play(x.n, x.v, when, dur);
        midiNote(t, x.n, x.v, when, dur);
      }
    }
    sched = end;
  }
}
export function play() {
  const c = audio(); if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  refreshAll();
  t0 = c.currentTime + 0.06 - startTick * spt(); sched = startTick;
  playing = true; pump(); clearInterval(timer); timer = setInterval(pump, TICK_MS);
}
/** Recording pass: one run from `from` (ticks) with optional count-in beats, click and the song playing along. */
export function playRec({ from = 0, countIn = 0, click: ck = true, song = true, exclude = null }) {
  const c = audio(); if (!c) return null;
  if (c.state !== 'running') c.resume().catch(() => {});
  if (playing) stop();
  refreshAll();
  rec = { click: ck, song, exclude };
  sched = from - countIn * PPQ;
  t0 = c.currentTime + 0.1 - sched * spt();
  playing = true; pumpRec(); clearInterval(timer); timer = setInterval(pump, TICK_MS);
  return true;
}
/** Song position (ticks, not wrapped) for a performance.now() timestamp, during a recording pass. */
export function tickAt(ts) { const c = audio(); return (c.currentTime + (ts - performance.now()) / 1000 - t0) / spt(); }
export const recording = () => !!rec;
export function stop() {
  playing = false; clearInterval(timer); rec = null;
  for (const r of rigs.values()) r.inst?.stopAll();
  panic(false);
}
/** Current position in ticks (inside the loop). */
export function position() {
  if (!playing) return startTick;
  if (rec) return (audio().currentTime - t0) / spt();
  const c = audio(), len = lenTicks();
  return ((((c.currentTime - t0) / spt()) % len) + len) % len;
}
/** Keep the beat when the tempo changes mid-play. */
export function tempoChanged(oldBpm) {
  if (!playing) return;
  const c = audio(), oldSpt = 60 / (oldBpm * PPQ), cur = (c.currentTime - t0) / oldSpt;
  t0 = c.currentTime - cur * spt(); sched = Math.max(sched, cur + LOOK / spt());
}
export function panic(cut = true) {
  if (cut) for (const r of rigs.values()) r.inst?.stopAll();
  const chs = new Set(P.tracks.map((t) => t.ch));
  if (access && out) try { out.clear?.(); } catch { /* not supported */ }
  chs.forEach((ch) => { send([0xb0 | ch, 123, 0], audio().currentTime); send([0xb0 | ch, 120, 0], audio().currentTime); });
}
/** Tap a key / a row / a step: hear it now. */
export function preview(t, n, v = 100, dur = 0.35) {
  const c = audio(); if (!c) return;
  if (c.state !== 'running') { c.resume().then(() => preview(t, n, v, dur)).catch(() => {}); return; }
  const when = c.currentTime + 0.005;
  if (settings.builtIn) { refresh(t); rig(t)?.inst?.play(n, v, when, dur); }
  midiNote(t, n, v, when, dur);
}

export const audioCtx = () => audio();
/** Schedule one note on a track's sound at an audio time (take preview). */
export function previewAt(t, n, v, when, dur) { if (settings.builtIn) { refresh(t); rig(t)?.inst?.play(n, v, when, dur); } midiNote(t, n, v, when, dur); }
/** Live input monitoring: key down starts a held note on the track's sound, key up lets it go. */
const held = new Map();
export function monitorOn(t, n, v, thru = false) {
  const c = audio(); if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  monitorOff(t, n, thru);
  if (settings.builtIn) { refresh(t); const r = rig(t); const h = r?.inst?.play(n, v, c.currentTime + 0.003, t.inst === 'drumway' ? 0.1 : 30); if (h) held.set(n, h); }
  if (thru && t.midiOut) send([0x90 | t.ch, n, v], c.currentTime);
}
export function monitorOff(t, n, thru = false) {
  held.get(n)?.release?.(); held.delete(n);
  if (thru && t.midiOut) send([0x80 | t.ch, n, 0], audio().currentTime);
}

// ---------- offline bounce ----------
/** Render the whole song (one pass + tail) through the same instruments and effects. */
export async function render(onProgress = () => {}) {
  const sr = 44100, s = spt(), len = lenTicks(), tail = 2.5, secs = len * s + tail;
  const oc = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
  const m = buildMaster(oc); m.output.connect(oc.destination);
  for (const t of P.tracks) {
    if (!audible(t) || t.inst === 'none') continue;
    const strip = buildStrip(oc, m.input, t.fx, t.vol);
    const inst = makeInst(t.inst, oc, strip.input); inst.setPatch(t.patch);
    for (const x of t.notes) if (x.t < len) inst.play(x.n, x.v, 0.05 + x.t * s, Math.min(x.d, len - x.t) * s);
  }
  onProgress(0.3);
  const buf = await oc.startRendering();
  onProgress(0.7);
  return buf;
}
