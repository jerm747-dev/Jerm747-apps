// A mixer channel: 3-band EQ + level + mute. Every sequencer row gets one, so any sound on the
// pads, synth or sample, can be shaped.
//   input -> low shelf (120 Hz) -> peaking mid (1.2 kHz) -> high shelf (6 kHz) -> level -> destination
export const EQ_RANGE = 12; // dB either way

export function createChannel(ac, destination) {
  const input = ac.createGain();
  const low = ac.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 120;
  const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1200; mid.Q.value = 0.9;
  const high = ac.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 6000;
  const vol = ac.createGain();
  const an = ac.createAnalyser(); an.fftSize = 256; // meter only, nothing after it
  input.connect(low).connect(mid).connect(high).connect(vol).connect(destination);
  vol.connect(an);
  return {
    input, an,
    set({ low: l = 0, mid: m = 0, high: h = 0, vol: v = 0.8, mute = false }) {
      const now = ac.currentTime;
      low.gain.setTargetAtTime(l * EQ_RANGE, now, 0.02);
      mid.gain.setTargetAtTime(m * EQ_RANGE, now, 0.02);
      high.gain.setTargetAtTime(h * EQ_RANGE, now, 0.02);
      vol.gain.setTargetAtTime(mute ? 0 : v, now, 0.02);
    },
  };
}
