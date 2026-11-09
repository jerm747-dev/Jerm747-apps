// Pitch detection for the tuner: autocorrelation over the mic waveform (the ACF2+ approach).
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function detectPitch(buf, sampleRate) {
  let size = buf.length, rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / size) < 0.012) return null; // too quiet

  // trim the quiet edges so the correlation locks onto the steady part
  let r1 = 0, r2 = size - 1;
  const th = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < th) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < th) { r2 = size - i; break; }
  const b = buf.subarray(r1, r2); size = b.length;
  if (size < 64) return null;

  const c = new Float32Array(size);
  for (let lag = 0; lag < size; lag++) { let s = 0; for (let j = 0; j < size - lag; j++) s += b[j] * b[j + lag]; c[lag] = s; }
  let d = 0; while (d < size - 1 && c[d] > c[d + 1]) d++;
  let maxV = -1, maxP = -1;
  for (let i = d; i < size; i++) if (c[i] > maxV) { maxV = c[i]; maxP = i; }
  if (maxP <= 0 || maxP >= size - 1) return null;
  const x1 = c[maxP - 1], x2 = c[maxP], x3 = c[maxP + 1];
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  const T0 = a ? maxP - bb / (2 * a) : maxP;
  const hz = sampleRate / T0;
  return hz > 30 && hz < 2000 ? hz : null;
}

export function noteFor(hz, a4 = 440) {
  const n = 12 * Math.log2(hz / a4) + 69, nearest = Math.round(n);
  return { name: NOTES[((nearest % 12) + 12) % 12], octave: Math.floor(nearest / 12) - 1, cents: Math.round((n - nearest) * 100) };
}
