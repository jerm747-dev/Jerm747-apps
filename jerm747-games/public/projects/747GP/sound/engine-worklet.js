// 747 GP — Engine synth AudioWorklet
// ------------------------------------------------------------------
// Every cylinder fires an exhaust pulse at its own crank angle. Each
// pulse is a falling polynomial "saw" — (1-t)^k with a soft attack and
// a small negative dip — so the wave you'd see on a scope is the x^3
// curve coming down, once per firing. Pulses are summed per exhaust
// bank, run through a resonant low-pass (the muffler), a short comb
// (the pipe length), soft saturation, then panned left/right.
//
// Uneven firing per bank (cross-plane V8, 270° twins) + per-cylinder
// "lope" (big-cam idle) is what gives the wub-wub. Nothing is sampled.
//
// This one file runs in two places:
//   • the browser, as an AudioWorkletProcessor ('gp-engine')
//   • Node (tools/render-previews.mjs), through globalThis.__GPEngineCore
// ------------------------------------------------------------------

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Topology-preserving state-variable filter (stable when swept fast)
class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.g = 0; this.k = 1; this.a1 = 0; this.a2 = 0; this.a3 = 0; }
  set(fc, q, sr) {
    const f = Math.min(fc, sr * 0.45);
    this.g = Math.tan(Math.PI * f / sr);
    this.k = 1 / Math.max(q, 0.3);
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }
  lp(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return v2;
  }
}

class EngineCore {
  constructor(preset, sr) {
    this.sr = sr;
    this.p = preset;
    const p = preset;
    const n = p.fire.length;
    this.n = n;
    this.nb = p.banks;
    this.rand = mulberry32(p.seed || 747);

    this.theta = 0;               // crank angle, 0..720 (one 4-stroke cycle)
    this.rpm = p.idle; this.rpmT = p.idle;
    this.thr = 0; this.thrT = 0;
    this.on = 1; this.onT = 1;    // master fade (start/stop/pause)

    // per-cylinder state
    this.prevLocal = new Float32Array(n).fill(719);
    this.cylFixed = new Float32Array(n);   // fixed per-cylinder character
    this.cylAmp = new Float32Array(n).fill(1);
    this.cylOff = new Float32Array(n);     // timing jitter (deg)
    for (let i = 0; i < n; i++) this.cylFixed[i] = 1 + (p.cylVar || 0) * (this.rand() * 2 - 1);

    // per-bank DSP
    this.svf = []; this.op = new Float32Array(this.nb); this.pipe = []; this.pipeIdx = new Int32Array(this.nb);
    this.pipeLen = new Int32Array(this.nb); this.pipeDamp = new Float32Array(this.nb);
    this.pop = new Float32Array(this.nb);
    for (let b = 0; b < this.nb; b++) {
      this.svf.push(new SVF());
      const ms = (p.pipeMs && p.pipeMs[b % p.pipeMs.length]) || 3;
      const len = Math.max(2, Math.round(ms * sr / 1000));
      this.pipe.push(new Float32Array(len));
      this.pipeLen[b] = len;
    }
    this.bankIn = new Float32Array(this.nb);
    // pan gains
    this.panL = new Float32Array(this.nb); this.panR = new Float32Array(this.nb);
    for (let b = 0; b < this.nb; b++) {
      const pan = (p.pan && p.pan[b] !== undefined) ? p.pan[b] : 0;
      const a = (pan + 1) * Math.PI / 4;
      this.panL[b] = Math.cos(a) * Math.SQRT2 * 0.7071;
      this.panR[b] = Math.sin(a) * Math.SQRT2 * 0.7071;
    }
    // body / sub rumble path
    this.body = new SVF();
    // intake noise filters
    this.hpN = 0; this.hpNx = 0; this.lpN = 0; this.envAbs = 0;
    // whine
    this.whPh = 0;
    // DC blockers L/R
    this.dcxL = 0; this.dcyL = 0; this.dcxR = 0; this.dcyR = 0;
    // limiter chop
    this.limPh = 0;
    // shift cut (set from outside for gear changes)
    this.cut = 0;
    this.ctrl = 0; // control-rate counter
    this.updateFilters();
  }

  setTargets(rpm, thr) {
    const p = this.p;
    if (rpm !== undefined) this.rpmT = Math.max(p.idle * 0.9, Math.min(rpm, p.redline * 1.02));
    if (thr !== undefined) this.thrT = Math.max(0, Math.min(1, thr));
  }

  updateFilters() {
    const p = this.p, r = this.rpm / 1000, t = this.thr;
    const fc = (p.lpBase + p.lpPerK * r + p.lpLoad * t) * (0.65 + 0.35 * t);
    for (let b = 0; b < this.nb; b++) this.svf[b].set(fc, p.q, this.sr);
    this.opCoef = Math.exp(-TAU * Math.min(fc * 1.6, this.sr * 0.45) / this.sr);
    this.body.set(p.bodyHz || 90, 0.9, this.sr);
    this.nLp = Math.exp(-TAU * 4500 / this.sr);
    this.nHp = Math.exp(-TAU * 900 / this.sr);
    // lope fades out as revs rise
    const span = Math.max(1, (p.lopeFade || p.idle * 3) - p.idle);
    const x = Math.max(0, Math.min(1, 1 - (this.rpm - p.idle) / span));
    this.lopeNow = (p.lope || 0) * x * x * (0.6 + 0.4 * (1 - t));
    this.ampNow = 0.28 + 0.72 * Math.pow(t, 0.8);
    this.limiting = (this.rpmT >= p.redline * 0.995 && this.thrT > 0.5);
    this.overrun = (this.thrT < 0.08 && this.rpm > p.redline * 0.35);
  }

  shape(t, k, us, att) {
    // soft attack, polynomial fall, small negative dip — ends at 0 with 0 slope
    let env = 1;
    if (t < att) { const s = Math.sin(0.5 * Math.PI * t / att); env = s * s; }
    const fall = Math.pow(1 - t, k);
    const dip = Math.sin(Math.PI * t);
    return env * fall - us * dip * dip * (1 - t);
  }

  // render `frames` samples into L,R
  process(L, R, frames) {
    const p = this.p, sr = this.sr, n = this.n, nb = this.nb;
    const rpmA = 1 - Math.exp(-1 / (sr * (p.rpmLag || 0.045)));
    const thrA = 1 - Math.exp(-1 / (sr * 0.02));
    const onA = 1 - Math.exp(-1 / (sr * 0.06));
    const k = p.shapeK, us = p.undershoot || 0;
    const drive = p.drive || 1.5;
    const pipeFb = p.pipeFb || 0.3;
    const bodyAmt = p.body || 0;
    const intake = p.intake || 0;
    const wh = p.whine;
    const gain = p.gain || 1;

    for (let i = 0; i < frames; i++) {
      if ((this.ctrl++ & 31) === 0) this.updateFilters();
      this.rpm += (this.rpmT - this.rpm) * rpmA;
      let thrTarget = this.thrT * (1 - this.cut);
      this.thr += (thrTarget - this.thr) * thrA;
      this.on += (this.onT - this.on) * onA;

      // crank advance: rpm/60 rev/s * 360 deg
      const degPerSample = this.rpm * 6 / sr;
      this.theta += degPerSample;
      if (this.theta >= 720) this.theta -= 720;

      // rev limiter chop (~18 Hz) when pinned
      let limGain = 1;
      if (this.limiting) {
        this.limPh += 18 / sr; if (this.limPh >= 1) this.limPh -= 1;
        limGain = this.limPh < 0.45 ? 1 : 0.15;
      }

      const pulseDeg = p.pulseDeg;
      const att = Math.min(0.4, Math.max(p.attack || 0.05, (this.rpm * 6 * 0.00022) / pulseDeg));
      for (let b = 0; b < nb; b++) this.bankIn[b] = 0;

      let absSum = 0;
      for (let c = 0; c < n; c++) {
        let local = this.theta - p.fire[c] - this.cylOff[c];
        local = ((local % 720) + 720) % 720;
        if (local < this.prevLocal[c]) {
          // this cylinder just fired: roll its lope / misfire / pop dice
          const r1 = this.rand() * 2 - 1, r2 = this.rand() * 2 - 1;
          this.cylAmp[c] = this.cylFixed[c] * (1 + this.lopeNow * 0.75 * r1);
          this.cylOff[c] = this.lopeNow * (p.jitterDeg || 10) * r2;
          // pops: `pops` ≈ crackles per firing at 20 Hz firing, scaled so fast engines don't turn to static
          if (this.overrun && this.rand() < (p.pops || 0) * Math.min(1, 20 / Math.max(1, this.rpm / 120 * n)) * 3) this.pop[p.bank[c]] = 0.7 + 0.6 * this.rand();
        }
        this.prevLocal[c] = local;
        if (local < pulseDeg) {
          const s = this.shape(local / pulseDeg, k, us, att) * this.cylAmp[c];
          this.bankIn[p.bank[c]] += s;
          absSum += s > 0 ? s : -s;
        }
      }

      // pops / crackle on overrun (injected into the bank before the muffler)
      for (let b = 0; b < nb; b++) {
        if (this.pop[b] > 0.001) {
          this.bankIn[b] += this.pop[b] * (this.rand() * 2 - 1) * 1.6;
          this.pop[b] *= Math.exp(-1 / (sr * 0.012));
        }
      }

      const amp = this.ampNow * limGain;
      let outL = 0, outR = 0, bodySum = 0;
      for (let b = 0; b < nb; b++) {
        const x = this.bankIn[b] * amp;
        bodySum += x;
        let y = this.svf[b].lp(x);
        // extra one-pole to smooth the top end
        this.op[b] = y + (this.op[b] - y) * this.opCoef;
        y = this.op[b];
        // pipe comb with damping
        const buf = this.pipe[b], idx = this.pipeIdx[b];
        const d = buf[idx];
        this.pipeDamp[b] = d + (this.pipeDamp[b] - d) * 0.35;
        const yo = y + pipeFb * this.pipeDamp[b];
        buf[idx] = yo;
        this.pipeIdx[b] = (idx + 1) % this.pipeLen[b];
        // saturation
        const s = Math.tanh(yo * drive * (0.7 + 0.6 * this.thr));
        outL += s * this.panL[b];
        outR += s * this.panR[b];
      }

      // body / felt rumble — low-passed sum of all pulses, centered
      const bo = this.body.lp(bodySum) * bodyAmt;
      outL += bo; outR += bo;

      // intake / mechanical hiss, gated by the pulses
      this.envAbs += (absSum - this.envAbs) * 0.01;
      if (intake > 0) {
        const w = this.rand() * 2 - 1;
        this.lpN = w + (this.lpN - w) * this.nLp;
        const hp = this.lpN - this.hpNx + this.nHp * this.hpN; this.hpNx = this.lpN; this.hpN = hp;
        const ns = hp * intake * this.envAbs * (0.25 + 0.75 * this.thr) * amp;
        outL += ns; outR += ns;
      }

      // whine (supercharger / gear / turbo)
      if (wh && wh.amt > 0) {
        const f = this.rpm / 60 * wh.ratio;
        this.whPh += f / sr; if (this.whPh >= 1) this.whPh -= 1;
        const rr = this.rpm / p.redline;
        const wa = wh.amt * rr * rr * ((wh.load || 0.6) * this.thr + (1 - (wh.load || 0.6)));
        const ws = Math.sin(TAU * this.whPh) * wa;
        outL += ws; outR += ws;
      }

      // DC block + output
      const g = gain * this.on;
      const yl = outL - this.dcxL + 0.9985 * this.dcyL; this.dcxL = outL; this.dcyL = yl;
      const yr = outR - this.dcxR + 0.9985 * this.dcyR; this.dcxR = outR; this.dcyR = yr;
      L[i] = Math.tanh(yl * g);
      R[i] = Math.tanh(yr * g);
    }
  }
}

globalThis.__GPEngineCore = EngineCore;

if (typeof registerProcessor === 'function') {
  class GPEngineProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.core = new EngineCore(options.processorOptions.preset, sampleRate);
      this.alive = true;
      this.port.onmessage = (e) => {
        const m = e.data;
        if (m.rpm !== undefined || m.thr !== undefined) this.core.setTargets(m.rpm, m.thr);
        if (m.cut !== undefined) this.core.cut = m.cut;
        if (m.on !== undefined) this.core.onT = m.on;
        if (m.preset) { const r = this.core.rpm; this.core = new EngineCore(m.preset, sampleRate); this.core.rpm = r; }
        if (m.kill) this.alive = false;
      };
    }
    process(_in, outputs) {
      const out = outputs[0];
      const L = out[0], R = out[1] || out[0];
      this.core.process(L, R, L.length);
      return this.alive;
    }
  }
  registerProcessor('gp-engine', GPEngineProcessor);
}
