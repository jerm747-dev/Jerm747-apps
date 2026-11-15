// The one AudioContext every section shares. Signal flow:
//   decks / pads / metronome -> bus -> 747 Drive (character.js) -> master gain -> analyser (speakers + meter) -> speakers out
// Browsers only allow audio after a tap, so audio() is called from click handlers and creates
// (or wakes) the context lazily.
import { build as buildDrive } from './character.js';
let ac = null;
let bus = null;
let master = null;
let analyser = null;
let tap = null;      // the mix after 747 Drive, before the master fader: what the tape records as "Room"
let monitor = null;  // clicks / count-in / button blips: heard, never recorded
const MASTER_KEY = 'beatroom.master';

export function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    bus = ac.createGain();
    master = ac.createGain();
    master.gain.value = loadMaster();
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    const drive = buildDrive(ac);
    tap = ac.createGain();
    monitor = ac.createGain();
    bus.connect(drive.input); drive.output.connect(tap).connect(master).connect(analyser).connect(ac.destination);
    monitor.connect(master);
  }
  if (ac.state === 'suspended' && !window.ArcadeGameClock?.held) ac.resume().catch(() => {});
  return ac;
}

/** The node every sound source connects to. Call audio() first. */
export const out = () => (audio(), bus);
/** Master analyser for the speakers and output meter (null until audio starts). */
export const masterAnalyser = () => analyser;
export const ready = () => !!ac;
/** The full mix (post Drive, pre master fader). The tape deck's Room input listens here. */
export const mixTap = () => (audio(), tap);
/** For clicks the player hears but the tape should not record (metronome, count-in, blips). */
export const monitorOut = () => (audio(), monitor);
/** Output latency in ms as the browser reports it (base + device). */
export function latencyMs() {
  if (!ac) return null;
  const b = ac.baseLatency || 0, o = ac.outputLatency || 0;
  return Math.round((b + o) * 1000);
}

function loadMaster() {
  try { const v = parseFloat(localStorage.getItem(MASTER_KEY)); return Number.isFinite(v) ? v : 0.8; } catch { return 0.8; }
}
let masterVal = loadMaster();
const masterSubs = new Set();
export const onMaster = (fn) => (masterSubs.add(fn), () => masterSubs.delete(fn));
export const getMaster = () => masterVal;
export function setMaster(v) {
  masterVal = v; masterSubs.forEach((fn) => fn(v));
  if (master) master.gain.setTargetAtTime(v, ac.currentTime, 0.02);
  try { localStorage.setItem(MASTER_KEY, String(v)); } catch { /* storage off */ }
}

/**
 * Unlock audio on the first real gesture. Phones are picky: iPhone only starts audio on a
 * finger lift (touchend / click), not on touch-down, so listen for all of them and stop once
 * the context is running. Also ask Safari to treat this as media playback, so the ringer's
 * silent switch doesn't mute the room.
 */
export function unlockOnGesture() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
  const evs = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  const go = () => {
    const c = audio(); if (!c) return;
    if (c.state === 'running') { evs.forEach((e) => window.removeEventListener(e, go, true)); return; }
    c.resume().then(() => { if (c.state === 'running') evs.forEach((e) => window.removeEventListener(e, go, true)); }).catch(() => {});
  };
  evs.forEach((e) => window.addEventListener(e, go, true));
  return () => evs.forEach((e) => window.removeEventListener(e, go, true));
}
export const running = () => !!ac && ac.state === 'running';

// ---------- settings ----------
const SET_KEY = 'beatroom.settings';
// countIn: bars of click before a recording starts (0, 1 or 2). speakers: show the boombox speakers.
const SET_DEF = { clicks: true, countIn: 1, speakers: true, clickOnRec: true };
let settings = (() => { try { return { ...SET_DEF, ...JSON.parse(localStorage.getItem(SET_KEY)) }; } catch { return { ...SET_DEF }; } })();
const setSubs = new Set();
export const getSettings = () => settings;
export const onSettings = (fn) => (setSubs.add(fn), () => setSubs.delete(fn));
export function setSetting(k, v) {
  settings = { ...settings, [k]: v };
  try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* storage off */ }
  setSubs.forEach((fn) => fn(settings));
}

/** Short square blip for button feedback, same as the Returnity pieces. Off in Settings → Button clicks. */
export function blip(f = 660) {
  if (!settings.clicks) { audio(); return; }
  const c = audio(); if (!c) return;
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.value = f;
  g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g).connect(monitor); o.start(t); o.stop(t + 0.09);
}

/** RMS level (0..1) of an analyser's current waveform. */
const scratch = new Map();
export function level(an) {
  if (!an) return 0;
  let buf = scratch.get(an);
  if (!buf) { buf = new Float32Array(an.fftSize); scratch.set(an, buf); }
  an.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(s / buf.length) * 2.2);
}
