// 747 GP — Audio manager (the one file the game talks to)
// ------------------------------------------------------------------
//   import { GPAudio } from './sound/gp-audio.js';
//   const audio = await GPAudio.create();      // once, at boot
//   window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
//
//   const eng = audio.engine('car', 1200);      // or audio.engine('sleeper') / ('f1')
//   eng.start();
//   // every frame:
//   eng.drive(speed01, throttle, dtMs);         // built-in sound gearbox
//   //   or, if you compute rpm yourself:  eng.set(rpm, throttle)
//
//   audio.play('click.up'); audio.play('chime.good');
//   audio.pause();  audio.resume();             // ducks engines + plays the sounds
// ------------------------------------------------------------------
import { buildPreset, engineFor } from './engine-presets.js';
import { renderUISound, UI_SOUND_NAMES } from './ui-sounds.js';
import { SoundGearbox } from './gearbox.js';

export class GPAudio {
  static async create({ workletUrl, volume = 0.9, engineVolume = 0.8, uiVolume = 0.7 } = {}) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    const url = workletUrl || new URL('./engine-worklet.js', import.meta.url);
    await ctx.audioWorklet.addModule(url);
    const a = new GPAudio(ctx);
    a.setVolume({ master: volume, engines: engineVolume, ui: uiVolume });
    return a;
  }

  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    // gentle bus compressor so 3+ engines never clip
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.15;
    this.engineBus = ctx.createGain();
    this.engineDuck = ctx.createGain();   // used by pause/resume
    this.uiBus = ctx.createGain();
    this.engineBus.connect(this.engineDuck).connect(this.comp);
    this.uiBus.connect(this.comp);
    this.comp.connect(this.master).connect(ctx.destination);

    this.buffers = {};
    for (const name of UI_SOUND_NAMES) {
      const [L, R] = renderUISound(name, ctx.sampleRate);
      const b = ctx.createBuffer(2, L.length, ctx.sampleRate);
      b.copyToChannel(L, 0); b.copyToChannel(R, 1);
      this.buffers[name] = b;
    }
    this.voices = new Set();
    this.paused = false;
  }

  // Browsers start audio suspended — call from the first tap/click/keypress
  unlock() { if (this.ctx.state !== 'running') return this.ctx.resume(); return Promise.resolve(); }

  setVolume({ master, engines, ui } = {}) {
    const t = this.ctx.currentTime;
    if (master !== undefined) this.master.gain.setTargetAtTime(master, t, 0.03);
    if (engines !== undefined) this.engineBus.gain.setTargetAtTime(engines, t, 0.03);
    if (ui !== undefined) this.uiBus.gain.setTargetAtTime(ui, t, 0.03);
  }

  // UI one-shots. opts: { gain, rate, pan }
  play(name, { gain = 1, rate = 1, pan = 0 } = {}) {
    const b = this.buffers[name];
    if (!b) { console.warn('747GP sound: no UI sound', name); return; }
    const src = this.ctx.createBufferSource();
    src.buffer = b; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    let node = src.connect(g);
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.uiBus);
    src.start();
    return src;
  }

  // Engine voice by (type, class) or by preset id: engine('car',1200) | engine('sleeper') | engine('moto1800_twin')
  engine(typeOrId, cls, overrides) {
    const id = cls === undefined && typeOrId.includes('_') ? typeOrId : engineFor(typeOrId, cls);
    const family = typeOrId.includes('_') ? (id.startsWith('moto') ? 'moto' : id.startsWith('truck') ? 'truck' : id.startsWith('f1') ? 'f1' : id.startsWith('sleeper') ? 'sleeper' : 'car') : typeOrId;
    const v = new EngineVoice(this, buildPreset(id, overrides), family);
    this.voices.add(v);
    return v;
  }

  pause() {
    if (this.paused) return; this.paused = true;
    const t = this.ctx.currentTime;
    this.engineDuck.gain.cancelScheduledValues(t);
    this.engineDuck.gain.setTargetAtTime(0.0, t, 0.08);
    this.play('pause');
  }

  resume() {
    if (!this.paused) return; this.paused = false;
    const t = this.ctx.currentTime;
    this.engineDuck.gain.cancelScheduledValues(t);
    this.engineDuck.gain.setTargetAtTime(1.0, t + 0.15, 0.12);
    this.play('resume');
  }
}

class EngineVoice {
  constructor(audio, preset, family) {
    this.audio = audio;
    this.preset = preset;
    this.node = new AudioWorkletNode(audio.ctx, 'gp-engine', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { preset },
    });
    this.out = audio.ctx.createGain();
    this.out.gain.value = 0;
    this.node.connect(this.out).connect(audio.engineBus);
    this.gearbox = new SoundGearbox(preset, family);
    this._last = { rpm: -1, thr: -1, cut: -1 };
  }

  start(level = 1) { this.out.gain.setTargetAtTime(level, this.audio.ctx.currentTime, 0.05); return this; }
  stop() { this.out.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.08); return this; }

  // direct control: rpm (number), throttle 0..1
  set(rpm, throttle = 0, cut = 0) {
    const L = this._last;
    if (Math.abs(rpm - L.rpm) > 3 || Math.abs(throttle - L.thr) > 0.01 || cut !== L.cut) {
      this.node.port.postMessage({ rpm, thr: throttle, cut });
      L.rpm = rpm; L.thr = throttle; L.cut = cut;
    }
  }

  // easy mode: speed as 0..1 of top speed, throttle 0..1 → gearbox handles rpm + shifts
  drive(speed01, throttle, dtMs = 16.7) {
    const g = this.gearbox.update(speed01, throttle, dtMs);
    this.set(g.rpm, g.throttle, g.cut);
    return g;   // { rpm, throttle, gear, cut } — handy for a tach / gear readout
  }

  // distance-based volume for AI cars (1 = right next to you)
  setLevel(level) { this.out.gain.setTargetAtTime(level, this.audio.ctx.currentTime, 0.05); }

  destroy() {
    this.stop();
    setTimeout(() => { this.node.port.postMessage({ kill: true }); this.node.disconnect(); this.out.disconnect(); }, 400);
    this.audio.voices.delete(this);
  }
}
