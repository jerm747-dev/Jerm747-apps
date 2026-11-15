// Tape recorder: captures raw audio (no codec) from the mic, the room (everything playing in
// the Beat Room, after 747 Drive), or both, starting and stopping on exact audio times so a
// take that follows a count-in starts right on the downbeat.
//
//   mic  -> mic gain  ┐
//   mix tap -> room gain ┘-> rec input -> recorder (AudioWorklet, or ScriptProcessor fallback)
//
// The recorder output is muted, so nothing is monitored (no feedback). Metronome and count-in
// clicks go to a monitor path that doesn't pass the mix tap, so they never land on tape.
import { audio, mixTap } from './audio.js';
import { micNode, releaseMic } from './mic.js';

export const SOURCES = { mic: 'Mic', room: 'Room', both: 'Both' };

const WORKLET = `
class BrRec extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.start = 0; this.stop = Infinity;
    this.port.onmessage = (e) => { const d = e.data;
      if (d.start != null) { this.start = d.start; this.stop = Infinity; this.on = true; }
      if (d.stop != null) this.stop = d.stop; }; }
  process(inputs) {
    if (!this.on) return true;
    const n = 128, sr = sampleRate, t0 = currentTime, t1 = t0 + n / sr;
    if (t1 <= this.start) return true;
    const inp = inputs[0] || [];
    let a = 0, b = n;
    if (t0 < this.start) a = Math.min(n, Math.round((this.start - t0) * sr));
    if (t1 > this.stop) b = Math.max(a, Math.min(n, Math.round((this.stop - t0) * sr)));
    if (b > a) {
      const L = inp[0] ? inp[0].slice(a, b) : new Float32Array(b - a);
      const R = inp[1] ? inp[1].slice(a, b) : L.slice();
      this.port.postMessage({ L, R }, [L.buffer, R.buffer]);
    }
    if (t1 >= this.stop) { this.on = false; this.port.postMessage({ done: true }); }
    return true;
  }
}
registerProcessor('br-rec', BrRec);`;

let workletP = null;
function loadWorklet(ac) {
  if (!ac.audioWorklet) return Promise.resolve(false);
  if (!workletP) {
    // blob: first, then data: (some hosts allow one and not the other), else the fallback
    const blob = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    const data = `data:application/javascript;base64,${btoa(WORKLET)}`;
    workletP = ac.audioWorklet.addModule(blob).then(() => true, () => ac.audioWorklet.addModule(data).then(() => true, () => false));
  }
  return workletP;
}

let graph = null;
async function getGraph() {
  const ac = audio(); if (!ac) throw new Error('Audio is not available in this browser.');
  if (graph) return graph;
  const input = ac.createGain();
  const room = ac.createGain(); room.gain.value = 0;
  const mic = ac.createGain(); mic.gain.value = 0;
  mixTap().connect(room); room.connect(input); mic.connect(input);
  const sink = ac.createGain(); sink.gain.value = 0; sink.connect(ac.destination);
  const hasWorklet = await loadWorklet(ac);
  let node, kind;
  if (hasWorklet) {
    node = new AudioWorkletNode(ac, 'br-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit' });
    kind = 'worklet';
  } else {
    node = ac.createScriptProcessor(4096, 2, 1); kind = 'script';
  }
  input.connect(node); node.connect(sink);
  graph = { ac, input, room, mic, node, kind, micSrc: null };
  return graph;
}

/**
 * Start a take. source: 'mic' | 'room' | 'both'. at: audio time to start (defaults to now).
 * Resolves to { start, stop(at?) -> Promise<AudioBuffer>, level() } once the inputs are open.
 */
export async function startTake({ source = 'mic', at } = {}) {
  const g = await getGraph();
  const ac = g.ac;
  const useMic = source === 'mic' || source === 'both';
  const useRoom = source === 'room' || source === 'both';
  if (useMic) {
    const src = await micNode('tape');
    if (g.micSrc !== src) { try { g.micSrc?.disconnect(g.mic); } catch { /* gone */ } src.connect(g.mic); g.micSrc = src; }
  }
  g.mic.gain.value = useMic ? 1 : 0;
  g.room.gain.value = useRoom ? 1 : 0;
  // a meter on what's going to tape
  const an = ac.createAnalyser(); an.fftSize = 1024; g.input.connect(an);

  const start = Math.max(at || 0, ac.currentTime + 0.02);
  const L = [], R = [];
  let doneRes = null;
  const done = new Promise((res) => { doneRes = res; });
  let stopAt = Infinity;

  if (g.kind === 'worklet') {
    g.node.port.onmessage = (e) => { if (e.data.done) doneRes(); else { L.push(e.data.L); R.push(e.data.R); } };
    g.node.port.postMessage({ start });
  } else {
    g.node.onaudioprocess = (e) => {
      // the input block was captured about two buffers before its playbackTime (measured in Chrome)
      const n = e.inputBuffer.length, sr = ac.sampleRate, t0 = e.playbackTime - (2 * n) / sr, t1 = t0 + n / sr;
      if (t1 <= start) return;
      let a = 0, b = n;
      if (t0 < start) a = Math.round((start - t0) * sr);
      if (t1 > stopAt) b = Math.max(a, Math.round((stopAt - t0) * sr));
      if (b > a) {
        L.push(e.inputBuffer.getChannelData(0).slice(a, b));
        R.push(e.inputBuffer.getChannelData(Math.min(1, e.inputBuffer.numberOfChannels - 1)).slice(a, b));
      }
      if (t1 >= stopAt) { g.node.onaudioprocess = null; doneRes(); }
    };
  }

  const cleanup = () => {
    try { g.input.disconnect(an); } catch { /* gone */ }
    g.mic.gain.value = 0; g.room.gain.value = 0;
    if (useMic) releaseMic('tape');
  };

  return {
    start,
    analyser: an,
    /** Book the end ahead of time (sample-exact for bar-length takes). */
    stopAt(atTime) {
      stopAt = Math.max(start, atTime);
      if (g.kind === 'worklet') g.node.port.postMessage({ stop: stopAt });
    },
    /** Stop now (or at an audio time) and get the take as an AudioBuffer. */
    async stop(atTime) {
      if (atTime == null || atTime < stopAt) {
        stopAt = Math.max(start, atTime ?? ac.currentTime);
        if (g.kind === 'worklet') g.node.port.postMessage({ stop: stopAt });
      }
      // safety: if the audio thread has stalled, don't hang forever
      await Promise.race([done, new Promise((r) => setTimeout(r, Math.max(0, (stopAt - ac.currentTime) * 1000) + 600))]);
      if (g.kind === 'worklet') g.node.port.onmessage = null; else g.node.onaudioprocess = null;
      cleanup();
      const len = L.reduce((s, a) => s + a.length, 0);
      if (!len) throw new Error('Nothing came in. Check the source and try again.');
      const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: ac.sampleRate });
      const l = new Float32Array(len), r = new Float32Array(len);
      let o = 0; for (let i = 0; i < L.length; i++) { l.set(L[i], o); r.set(R[i], o); o += L[i].length; }
      buf.copyToChannel(l, 0); buf.copyToChannel(r, 1);
      return buf;
    },
    cancel() { stopAt = ac.currentTime; if (g.kind === 'worklet') { g.node.port.postMessage({ stop: stopAt }); g.node.port.onmessage = null; } else g.node.onaudioprocess = null; cleanup(); },
  };
}
