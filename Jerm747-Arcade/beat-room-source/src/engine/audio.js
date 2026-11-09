// The one AudioContext every section shares. Signal flow:
//   decks / pads / metronome -> bus -> 747 Drive (character.js) -> master gain -> analyser (speakers + meter) -> speakers out
// Browsers only allow audio after a tap, so audio() is called from click handlers and creates
// (or wakes) the context lazily.
import { build as buildDrive } from './character.js';
let ac = null;
let bus = null;
let master = null;
let analyser = null;
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
    bus.connect(drive.input); drive.output.connect(master).connect(analyser).connect(ac.destination);
  }
  if (ac.state === 'suspended' && !window.ArcadeGameClock?.held) ac.resume().catch(() => {});
  return ac;
}

/** The node every sound source connects to. Call audio() first. */
export const out = () => (audio(), bus);
/** Master analyser for the speakers and output meter (null until audio starts). */
export const masterAnalyser = () => analyser;
export const ready = () => !!ac;

function loadMaster() {
  try { const v = parseFloat(localStorage.getItem(MASTER_KEY)); return Number.isFinite(v) ? v : 0.8; } catch { return 0.8; }
}
export const getMaster = () => (master ? master.gain.value : loadMaster());
export function setMaster(v) {
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
let settings = (() => { try { return { clicks: true, ...JSON.parse(localStorage.getItem(SET_KEY)) }; } catch { return { clicks: true }; } })();
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
  o.connect(g).connect(bus); o.start(t); o.stop(t + 0.09);
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
