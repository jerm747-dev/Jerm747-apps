// Vinyl-mode turntable engine, the way DJ software and touch-strip samplers scratch.
//
// An AudioWorklet reads the record at a position that's always moving toward a target:
//   motor:  the platter turns at the record speed (33/45 + pitch), with spin-up and brake
//   hand:   your finger sets the position 1:1 (one turn = 1.8 s of groove), so the sound's speed
//           is your finger's speed: crawl it slow, stop it dead, drag it backward, whip it
//   release: the record keeps the speed your hand gave it and eases back to the motor (or stops)
// Reads are interpolated in both directions, and a DC blocker keeps a stopped record silent.
// A Cut gain (the crossfader) can chop the sound at any moment.
//
// If AudioWorklet isn't available, a plain BufferSource deck keeps play/pause/seek working
// (hand scratching needs the worklet).
import { audio, out } from './audio.js';
import { cutRecord, deEmphasis } from './vinylcut.js';

export const REV_SEC = 1.8; // seconds of groove under one turn of a 33⅓ record

const WORKLET = `
class BrDeck extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lv = null; this.n = 0;
    this.x = 0; this.v = 0;                 // platter position (samples) and speed (1 = normal)
    this.motor = 0; this.accUp = 1 / 0.6; this.accDn = 1 / 0.35;   // constant-torque motor
    this.hand = false; this.anchor = 0; this.y = 0; this.vy = 0; this.since = 1e9; this.corr = 0; this.corrN = 0;
    this.analog = true; this.de = null; this.ds = [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.cut = 1; this.cutT = 1; this.dc = [0, 0, 0, 0]; this.ph = 0; this.ph2 = 0; this.tick = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.levels) { this.lv = d.levels; this.n = d.levels[0][0].length; if (!d.keepPos) { this.x = 0; this.v = 0; } else this.x %= this.n; }
      if (d.clear) { this.lv = null; this.n = 0; }
      if (d.analog != null) this.analog = d.analog;
      if (d.de) this.de = d.de;
      if (d.seek != null) { this.x = d.seek * sampleRate; if (this.hand) { this.anchor = this.x; this.y = this.x; } }
      if (d.motor != null) { this.motor = d.motor; if (d.up) this.accUp = 1 / d.up; if (d.dn) this.accDn = 1 / d.dn; if (d.jump) this.v = d.motor; }
      if (d.grab) { this.hand = true; this.anchor = this.x; this.y = this.x; this.vy = 0; this.since = 0; this.corrN = 0; }
      if (d.offset != null && this.hand) {
        // a touch event is a correction, not a jump: close the gap over the next 25 ms so the hand path stays continuous
        const tgt = this.anchor + d.offset * sampleRate, len = 0.025 * sampleRate;
        this.corr = (tgt - this.y) / len; this.corrN = len; this.vy = d.vel || 0; this.since = 0;
      }
      if (d.release) { this.hand = false; }
      if (d.cut != null) this.cutT = d.cut ? 0 : 1;
    };
  }
  // 4-point cubic (Catmull-Rom) read with wrap
  read(a, x) {
    const n = this.n, i = x | 0, f = x - i;
    const i0 = i === 0 ? n - 1 : i - 1, i2 = i + 1 >= n ? i + 1 - n : i + 1, i3 = i + 2 >= n ? i + 2 - n : i + 2;
    const p0 = a[i0], p1 = a[i], p2 = a[i2], p3 = a[i3];
    return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
  }
  process(_, outputs) {
    const o = outputs[0], oL = o[0], oR = o[1] || o[0], N = oL.length;
    if (!this.lv || !this.n) { oL.fill(0); if (oR !== oL) oR.fill(0); return true; }
    const sr = sampleRate, dt = 1 / sr, n = this.n, lv = this.lv, HAND_HZ = 14;
    // the record on the slipmat, pulled toward your hand by a stiff, well-damped spring (about 22 Hz):
    // it can't jump, so every move glides the way a heavy platter does
    const w = 2 * Math.PI * HAND_HZ, k = w * w, c = 2 * 1.0 * w;
    const kCut = 1 - Math.exp(-1 / (sr * 0.0012));
    const de = this.analog ? this.de : null;
    for (let i = 0; i < N; i++) {
      if (this.hand) {
        // between touch events, keep the hand moving at its last speed for a moment, then let it settle
        if (this.since < 0.04) this.y += this.vy; else this.vy *= 0.995;
        if (this.corrN > 0) { this.y += this.corr; this.corrN--; }
        this.since += dt;
        const a = k * (this.y - this.x) / sr + c * (this.vy - this.v);   // in speed units per second
        this.v += a * dt; this.x += this.v;
      } else {
        // motor: constant torque, plus a little wow and flutter when the analog model is on
        let target = this.motor;
        if (this.analog && target > 0) { this.ph += 0.55 * dt; this.ph2 += 6.8 * dt; target *= 1 + 0.0009 * Math.sin(6.2832 * this.ph) + 0.00035 * Math.sin(6.2832 * this.ph2); }
        const dv = target - this.v, step = (dv > 0 ? this.accUp : this.accDn) * dt;
        this.v += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
        this.x += this.v;
      }
      let x = this.x % n; if (x < 0) x += n;
      // fast moves read from the filtered copies so they don't alias
      const sp = Math.abs(this.v);
      let l, r;
      if (lv.length < 3 || sp < 1.6) { l = this.read(lv[0][0], x); r = this.read(lv[0][1], x); }
      else if (sp < 3.2) { const m = (sp - 1.6) / 1.6; l = this.read(lv[0][0], x) * (1 - m) + this.read(lv[1][0], x) * m; r = this.read(lv[0][1], x) * (1 - m) + this.read(lv[1][1], x) * m; }
      else { const m = Math.min(1, (sp - 3.2) / 3.2); l = this.read(lv[1][0], x) * (1 - m) + this.read(lv[2][0], x) * m; r = this.read(lv[1][1], x) * (1 - m) + this.read(lv[2][1], x) * m; }
      if (de) {
        // the cartridge is a velocity sensor: its output follows how fast the groove passes the
        // stylus, so a slow drag is quiet and a fast whip is loud (capped so a wild whip can't blow up)
        const g = Math.min(sp, 3); l *= g; r *= g;
        // phono stage: RIAA playback curve, then a little preamp warmth on the peaks
        for (let s = 0; s < de.secs.length; s++) {
          const q = de.secs[s], zl = this.ds[s * 2], zr = this.ds[s * 2 + 1];
          const yl = q.b0 * l + q.b1 * zl[0] - q.a1 * zl[1]; zl[0] = l; zl[1] = yl; l = yl;
          const yr = q.b0 * r + q.b1 * zr[0] - q.a1 * zr[1]; zr[0] = r; zr[1] = yr; r = yr;
        }
        l *= de.gain; r *= de.gain;
        l = Math.tanh(l * 1.15) / 1.15 + 0.015 * l * l; r = Math.tanh(r * 1.15) / 1.15 + 0.015 * r * r;
      }
      // DC blocker: a record held still is silent
      const yl = l - this.dc[0] + 0.9975 * this.dc[1], yr = r - this.dc[2] + 0.9975 * this.dc[3];
      this.dc[0] = l; this.dc[1] = yl; this.dc[2] = r; this.dc[3] = yr;
      this.cut += (this.cutT - this.cut) * kCut;
      oL[i] = yl * this.cut; if (oR !== oL) oR[i] = yr * this.cut;
    }
    if (!this.hand && Math.abs(this.x) > n * 4) { this.x %= n; if (this.x < 0) this.x += n; }
    if ((this.tick += N) >= 512) { this.tick = 0; let x = this.x % n; if (x < 0) x += n; this.port.postMessage({ pos: x / sr, rate: this.v }); }
    return true;
  }
}
registerProcessor('br-deck', BrDeck);`;

let ready = null;   // Promise<engine>
let eng = null;

/** Get (or build) the deck engine. */
export function deckEngine() {
  if (!ready) ready = build();
  return ready;
}
export const engineNow = () => eng;

async function build() {
  const ac = audio(); if (!ac) throw new Error('Audio is not available in this browser.');
  const gain = ac.createGain(); gain.gain.value = 0.9; gain.connect(out());
  let ok = false;
  if (ac.audioWorklet) {
    const blob = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try { await ac.audioWorklet.addModule(blob); ok = true; }
    catch { try { await ac.audioWorklet.addModule(`data:application/javascript;base64,${btoa(WORKLET)}`); ok = true; } catch { ok = false; } }
  }
  eng = ok ? workletDeck(ac, gain) : bufferDeck(ac, gain);
  return eng;
}

// ---------- worklet deck (vinyl mode) ----------
const AN_KEY = 'beatroom.vinyl';
export const loadVinylOpts = () => { try { return { analog: true, dust: 'light', ...JSON.parse(localStorage.getItem(AN_KEY)) }; } catch { return { analog: true, dust: 'light' }; } };
function workletDeck(ac, gain) {
  const node = new AudioWorkletNode(ac, 'br-deck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
  node.connect(gain);
  const st = { pos: 0, rate: 0, at: 0, dur: 0, motor: 0, clip: null, opts: loadVinylOpts() };
  node.port.onmessage = (e) => { st.pos = e.data.pos; st.rate = e.data.rate; st.at = performance.now(); };
  const send = (m) => node.port.postMessage(m);
  const de = deEmphasis(ac.sampleRate);
  send({ de: { secs: de.secs, gain: de.gain }, analog: st.opts.analog });
  const cut = (clip, keepPos) => {
    // copies with the cut applied, so the library keeps its own audio
    const rec = cutRecord(clip.buffer, { analog: st.opts.analog, dust: st.opts.dust, seed: [...clip.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) });
    send({ levels: rec.levels, analog: rec.analog, keepPos });
  };
  return {
    scratch: true,
    get opts() { return st.opts; },
    /** Analog model on/off and dust amount; re-cuts the record on the platter in place. */
    setOpts(o) {
      st.opts = { ...st.opts, ...o };
      try { localStorage.setItem(AN_KEY, JSON.stringify(st.opts)); } catch { /* off */ }
      if (st.clip) cut(st.clip, true); else send({ analog: st.opts.analog });
    },
    load(clip) {
      if (st.clip === clip) return;
      st.clip = clip; st.dur = clip ? clip.duration : 0; st.pos = 0;
      if (!clip) { send({ clear: true }); return; }
      cut(clip, false);
    },
    /** Motor on at a playback rate (1 = normal); up = seconds to reach speed from a stop. */
    play(rate, up = 0.6) { st.motor = rate; send({ motor: rate, up }); },
    setRate(rate) { if (st.motor) { st.motor = rate; send({ motor: rate }); } },
    /** Motor off: brakes to a stop in about `dn` seconds. */
    pause(dn = 0.35) { st.motor = 0; send({ motor: 0, dn }); },
    stop() { st.motor = 0; send({ motor: 0, jump: true, seek: 0 }); st.pos = 0; },
    seek(sec) { st.pos = sec; send({ seek: sec }); },
    grab() { send({ grab: true }); },
    /** Hand position (seconds of groove from the grab) and hand speed (seconds per second). */
    hand(offsetSec, vel = 0) { send({ offset: offsetSec, vel }); },
    release() { send({ release: true }); },
    cut(on) { send({ cut: on }); },
    read() {
      const dt = Math.min(0.05, (performance.now() - st.at) / 1000);
      const p = st.pos + st.rate * dt;
      return { pos: st.dur ? ((p % st.dur) + st.dur) % st.dur : 0, speed: st.rate };
    },
    get running() { return st.motor > 0; },
  };
}

// ---------- fallback: BufferSource deck (no hand scratching) ----------
function bufferDeck(ac, gain) {
  const cutG = ac.createGain(); cutG.connect(gain);
  const st = { clip: null, src: null, pos: 0, rate: 0, t: 0, motor: 0 };
  const now = () => (st.src ? st.pos + (ac.currentTime - st.t) * st.rate : st.pos);
  const kill = () => { if (st.src) { try { st.src.stop(); } catch { /* ended */ } st.src = null; } };
  const run = (rate, spin) => {
    if (!st.clip) return;
    st.pos = (now() % st.clip.duration + st.clip.duration) % st.clip.duration; kill();
    const s = ac.createBufferSource(); s.buffer = st.clip.buffer; s.loop = true;
    s.playbackRate.value = rate; s.connect(cutG); s.start(0, st.pos);
    st.src = s; st.t = ac.currentTime; st.rate = rate; void spin;
  };
  return {
    scratch: false,
    opts: { analog: false, dust: 'off' },
    setOpts() {},
    load(clip) { if (st.clip === clip) return; kill(); st.clip = clip; st.pos = 0; },
    play(rate, spin) { st.motor = rate; run(rate, spin); },
    setRate(rate) { if (st.motor) { st.motor = rate; run(rate, 0); } },
    pause() { st.pos = now(); st.motor = 0; kill(); },
    stop() { kill(); st.pos = 0; st.motor = 0; },
    seek(sec) { st.pos = sec; if (st.motor) run(st.motor, 0); },
    grab() { st.pos = now(); kill(); },
    hand() {},
    release() { if (st.motor) run(st.motor, 0); },
    cut(on) { cutG.gain.setTargetAtTime(on ? 0 : 1, ac.currentTime, 0.002); },
    read() { const d = st.clip?.duration || 0; return { pos: d ? ((now() % d) + d) % d : 0, speed: st.src ? st.rate : 0 }; },
    get running() { return st.motor > 0; },
  };
}
