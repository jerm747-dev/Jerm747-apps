/* Encore synth: every sound is generated live with Web Audio. No audio files. */
(() => {
'use strict';
let ctx = null, master, sfxBus, musicBus, comp, noiseBuf, echo;
let sfxOn = true, musicOn = true;
let seq = null;

function ensure() {
 if (ctx) return ctx;
 const A = window.AudioContext || window.webkitAudioContext;
 if (!A) return null;
 ctx = new A({latencyHint: 'interactive'});
 comp = ctx.createDynamicsCompressor();
 comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .18;
 master = ctx.createGain(); master.gain.value = .9;
 sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0;
 musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? .55 : 0;
 // A short tempo echo gives the synths some space.
 echo = ctx.createDelay(1); echo.delayTime.value = .201;
 const fb = ctx.createGain(); fb.gain.value = .28;
 const wet = ctx.createGain(); wet.gain.value = .22;
 const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
 echo.connect(tone); tone.connect(fb); fb.connect(echo); tone.connect(wet); wet.connect(comp);
 sfxBus.connect(comp); musicBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
 noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate);
 const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
 return ctx;
}
async function unlock() {
 const c = ensure(); if (!c) return false;
 try { if (c.state !== 'running') await c.resume(); } catch { return false; }
 return c.state === 'running';
}
const live = () => ctx && ctx.state === 'running';
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

function env(g, t, peak, a, d, sustain = 0, r = .05) {
 g.gain.cancelScheduledValues(t);
 g.gain.setValueAtTime(.0001, t);
 g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a);
 if (sustain > 0) {
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak * .6), t + a + d * .3);
  g.gain.setValueAtTime(Math.max(.0002, peak * .6), t + a + d);
  g.gain.exponentialRampToValueAtTime(.0001, t + a + d + r);
 } else g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
}
/* One oscillator voice with optional pitch glide, filter sweep and echo send. */
function voice({type = 'square', f = 440, to, t = 0, dur = .12, gain = .1, a = .004, cut, cutTo, q = 1, detune = 0, bus, send = 0, sustain = 0}) {
 if (!live()) return;
 const now = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain();
 o.type = type; o.detune.value = detune;
 o.frequency.setValueAtTime(f, now);
 if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
 let out = o;
 if (cut) {
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q;
  fl.frequency.setValueAtTime(cut, now);
  if (cutTo) fl.frequency.exponentialRampToValueAtTime(cutTo, now + dur);
  o.connect(fl); out = fl;
 }
 out.connect(g); g.connect(bus || sfxBus);
 if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(echo); }
 env(g, now, gain, a, dur, sustain);
 o.start(now); o.stop(now + a + dur + .12);
}
function noise({t = 0, dur = .08, gain = .08, type = 'highpass', f = 3000, to, q = .8, bus}) {
 if (!live()) return;
 const now = ctx.currentTime + t, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
 src.buffer = noiseBuf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, now);
 if (to) fl.frequency.exponentialRampToValueAtTime(to, now + dur);
 src.connect(fl); fl.connect(g); g.connect(bus || sfxBus);
 env(g, now, gain, .002, dur);
 src.start(now, Math.random() * .3); src.stop(now + dur + .05);
}
function kick(t = 0, gain = .5, bus) {
 voice({type: 'sine', f: 150, to: 42, t, dur: .22, gain, a: .002, bus});
 noise({t, dur: .02, gain: gain * .25, type: 'lowpass', f: 1800, bus});
}
function stab(notes, t = 0, dur = .22, gain = .06, cut = 3200, bus) {
 for (const n of notes) for (const d of [-9, 9]) voice({type: 'sawtooth', f: hz(n), t, dur, gain, cut, cutTo: cut * .25, q: 4, detune: d, bus, send: .5});
}

let stepFlip = false;
const SFX = {
 fire() { noise({dur:.11,gain:.07,type:'bandpass',f:2600,to:500}); voice({type:'triangle',f:390,to:115,dur:.18,gain:.08}); },
 smash() { kick(0,.3); noise({dur:.17,gain:.085,type:'lowpass',f:1700,to:110}); },
 pound() { kick(0,.6); noise({dur:.21,gain:.085,type:'lowpass',f:950,to:160}); },
 doubleJump() { voice({type:'triangle',f:470,to:940,dur:.13,gain:.09}); },
 dive() { voice({type:'sawtooth',f:460,to:95,dur:.17,gain:.06,cut:1500}); },
 jump() { voice({type: 'square', f: 300, to: 760, dur: .13, gain: .07, cut: 2600, q: 3, send: .2}); voice({type: 'triangle', f: 600, to: 1500, dur: .1, gain: .05}); },
 flip() {
  [76, 83, 88, 95].forEach((n, i) => voice({type: 'sawtooth', f: hz(n), t: i * .045, dur: .09, gain: .05, cut: 4200, cutTo: 1500, q: 6, send: .45}));
  noise({dur: .32, gain: .07, type: 'bandpass', f: 500, to: 6000, q: 2.5});
 },
 land(o = {}) { const p = .5 + (o.power || .5) * .5; voice({type: 'sine', f: 150, to: 50, dur: .14, gain: .22 * p, a: .002}); noise({dur: .05, gain: .05 * p, type: 'lowpass', f: 900}); },
 step(o = {}) { stepFlip = !stepFlip; noise({dur: o.run ? .035 : .025, gain: o.run ? .035 : .022, type: 'bandpass', f: stepFlip ? 2400 : 1900, q: 1.4}); },
 duck() { voice({type: 'triangle', f: 260, to: 120, dur: .1, gain: .09}); noise({dur: .06, gain: .03, type: 'lowpass', f: 700}); },
 speedOn() { voice({type: 'sawtooth', f: 110, to: 220, dur: .22, gain: .06, cut: 300, cutTo: 5000, q: 9}); voice({type: 'square', f: hz(88), t: .12, dur: .06, gain: .03}); },
 speedOff() { voice({type: 'sawtooth', f: 220, to: 110, dur: .2, gain: .05, cut: 4000, cutTo: 260, q: 9}); },
 crate() { [84, 88, 91, 96, 100].forEach((n, i) => { voice({type: 'sine', f: hz(n), t: i * .05, dur: .35, gain: .07, send: .6}); voice({type: 'triangle', f: hz(n + 12), t: i * .05, dur: .12, gain: .025}); }); },
 reward() { [72, 76, 79, 83, 84, 88].forEach((n, i) => voice({type: 'square', f: hz(n), t: i * .07, dur: .2, gain: .045, cut: 3000, send: .6})); stab([60, 64, 67, 71], .42, .7, .035, 2400); },
 talk() { voice({type: 'sine', f: 880, to: 990, dur: .05, gain: .05}); },
 next() { voice({type: 'square', f: 660, dur: .04, gain: .035, cut: 2400}); voice({type: 'square', f: 990, t: .05, dur: .05, gain: .035, cut: 2400}); },
 skip() { voice({type: 'triangle', f: 500, to: 300, dur: .12, gain: .06}); },
 move() { voice({type: 'square', f: 1320, dur: .025, gain: .03, cut: 3500}); },
 ok() { voice({type: 'square', f: hz(76), dur: .06, gain: .05, cut: 3000}); voice({type: 'square', f: hz(83), t: .07, dur: .12, gain: .05, cut: 3000, send: .4}); },
 back() { voice({type: 'square', f: hz(83), dur: .06, gain: .045, cut: 2500}); voice({type: 'square', f: hz(76), t: .07, dur: .1, gain: .045, cut: 2500}); },
 pause() { voice({type: 'sawtooth', f: 520, to: 130, dur: .3, gain: .06, cut: 3000, cutTo: 300, q: 5}); },
 resume() { voice({type: 'sawtooth', f: 130, to: 520, dur: .26, gain: .06, cut: 300, cutTo: 3000, q: 5}); },
 toggle() { voice({type: 'triangle', f: 880, dur: .04, gain: .05}); voice({type: 'triangle', f: 1320, t: .04, dur: .05, gain: .04}); },
 /* Logo letters: rising stabs, one per letter. */
 letter(o = {}) { const i = o.i || 0, n = [57, 60, 64, 67, 69, 72][i % 6]; kick(0, .28); stab([n, n + 7], 0, .16, .04, 2600); },
 slam() { kick(0, .6); stab([57, 64, 69, 72, 76], 0, .9, .045, 4200); noise({dur: .9, gain: .09, type: 'highpass', f: 6000, to: 2500}); voice({type: 'sine', f: 55, dur: .9, gain: .25, a: .01}); },
 riser() { noise({dur: .5, gain: .06, type: 'bandpass', f: 300, to: 7000, q: 3}); voice({type: 'sawtooth', f: 110, to: 880, dur: .5, gain: .035, cut: 400, cutTo: 6000, q: 6}); },
 /* READY / SET / GO count-in. */
 ready() { kick(0, .5); stab([57, 64, 69], 0, .3, .05, 2400); },
 set() { kick(0, .5); stab([60, 67, 72], 0, .3, .05, 3000); },
 go() { kick(0, .7); stab([64, 69, 72, 76, 81], 0, 1.1, .05, 5200); noise({dur: 1.2, gain: .1, type: 'highpass', f: 5000, to: 2000}); voice({type: 'sine', f: 55, dur: 1, gain: .28, a: .005}); }
};
function play(name, opts) { if (!sfxOn || !live()) return; try { SFX[name]?.(opts); } catch {} }

/* Title theme: 112 BPM, A minor (Am F C G), bass + arp + drums, scheduled ahead. */
const BPM = 112, STEP = 60 / BPM / 4;
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const BASS = [45, 41, 36, 43];
function startMusic() {
 if (!musicOn || !live() || seq) return;
 const bus = ctx.createGain(); bus.connect(musicBus);
 bus.gain.setValueAtTime(.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
 let step = 0, next = ctx.currentTime + .08;
 const tick = () => {
  while (next < ctx.currentTime + .15) {
   const bar = Math.floor(step / 16) % 4, s = step % 16, t = next - ctx.currentTime, ch = CHORDS[bar];
   if (s % 4 === 0) kick(t, .3, bus);
   if (s % 4 === 2) noise({t, dur: .03, gain: .025, type: 'highpass', f: 8000, bus});
   if (s === 4 || s === 12) noise({t, dur: .12, gain: .05, type: 'bandpass', f: 1800, q: .7, bus});
   if ([0, 3, 6, 8, 11, 14].includes(s)) voice({type: 'sawtooth', f: hz(BASS[bar] + (s === 14 ? 12 : 0)), t, dur: .16, gain: .07, cut: 900, cutTo: 260, q: 5, bus});
   const arp = [0, 1, 2, 1, 2, 0, 1, 2][s % 8];
   voice({type: 'square', f: hz(ch[arp] + 12 + (s >= 8 && step % 32 >= 16 ? 12 : 0)), t, dur: .09, gain: .022, cut: 2600, cutTo: 900, bus, send: .5});
   if (s === 0) for (const n of ch) voice({type: 'triangle', f: hz(n), t, dur: STEP * 15, gain: .018, a: .3, bus, sustain: 1});
   step++; next += STEP;
  }
 };
 tick();
 seq = {bus, timer: setInterval(tick, 25)};
}
function stopMusic(fade = .6) {
 if (!seq) return;
 const {bus, timer} = seq; seq = null; clearInterval(timer);
 if (!ctx) return;
 const t = ctx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value || .0001, t);
 bus.gain.exponentialRampToValueAtTime(.0001, t + fade);
 setTimeout(() => bus.disconnect(), fade * 1000 + 300);
}
function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, .02); }
function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? .55 : 0, ctx.currentTime, .05); }

globalThis.EncoreSynth = {unlock, play, startMusic, stopMusic, setSfx, setMusic, get running() { return live(); }, get musicPlaying() { return !!seq; }};
})();
