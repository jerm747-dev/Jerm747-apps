// Tape character: the sound of the cassette deck. Built against any BaseAudioContext so the
// exact same chain runs live (while you audition) and offline (when you "print" the sound into
// a new clip with the effects baked in).
//   input -> drive -> saturation (tanh) -> makeup -> wobbling delay (wow + flutter) -> low shelf -> high shelf -> output
export const TAPE_DEFAULTS = { wow: 0.25, flutter: 0.2, sat: 0.3, low: 0, high: 0 };
const BASE_DELAY = 0.012;

function satCurve(amount) {
  const k = 1 + amount * 18, n = 2048, c = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  return c;
}

export function buildTapeChain(ac, params = TAPE_DEFAULTS) {
  const input = ac.createGain();
  const drive = ac.createGain();
  const shaper = ac.createWaveShaper(); shaper.oversample = '2x';
  const makeup = ac.createGain();
  const delay = ac.createDelay(0.1); delay.delayTime.value = BASE_DELAY;
  const wowLfo = ac.createOscillator(); wowLfo.frequency.value = 0.55;
  const wowAmt = ac.createGain();
  const flutLfo = ac.createOscillator(); flutLfo.frequency.value = 6.8;
  const flutAmt = ac.createGain();
  const low = ac.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180;
  const high = ac.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4500;
  const output = ac.createGain();

  input.connect(drive).connect(shaper).connect(makeup).connect(delay).connect(low).connect(high).connect(output);
  wowLfo.connect(wowAmt).connect(delay.delayTime);
  flutLfo.connect(flutAmt).connect(delay.delayTime);
  wowLfo.start(); flutLfo.start();

  let lastSat = -1;
  function update(p) {
    const now = ac.currentTime;
    if (p.sat !== lastSat) { shaper.curve = satCurve(p.sat); lastSat = p.sat; }
    drive.gain.setValueAtTime(1 + p.sat * 2.5, now);
    makeup.gain.setValueAtTime(1 / (1 + p.sat * 1.2), now);
    wowAmt.gain.setValueAtTime(p.wow * 0.0045, now);
    flutAmt.gain.setValueAtTime(p.flutter * 0.0007, now);
    low.gain.setValueAtTime(p.low * 12, now);
    high.gain.setValueAtTime(p.high * 12, now);
  }
  update(params);

  return {
    input, output, update,
    dispose() { try { wowLfo.stop(); flutLfo.stop(); input.disconnect(); output.disconnect(); } catch { /* already gone */ } },
  };
}

/** Render a clip through the tape chain and return a new AudioBuffer with the effect baked in. */
export async function printTape(buffer, params) {
  const sr = buffer.sampleRate;
  const length = buffer.length + Math.ceil(sr * BASE_DELAY * 2);
  const off = new OfflineAudioContext(buffer.numberOfChannels, length, sr);
  const chain = buildTapeChain(off, params);
  const src = off.createBufferSource(); src.buffer = buffer;
  src.connect(chain.input); chain.output.connect(off.destination);
  src.start(0);
  return off.startRendering();
}
