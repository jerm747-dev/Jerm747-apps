// Microphone access, shared by the tape deck (recording) and the tuner (listening).
// Echo cancellation, noise suppression and auto gain are off: they are made for calls and
// they mangle instruments.
import { audio } from './audio.js';

let streamP = null, stream = null, source = null, analyser = null, recorder = null;
const users = new Set();
let visorOpen = false;
function syncCapture() {
  const muted = document.hidden || visorOpen;
  for (const track of stream?.getAudioTracks() || []) track.enabled = !muted;
  if (recorder?.state === 'recording' && muted) recorder.pause();
  if (recorder?.state === 'paused' && !muted) recorder.resume();
}
document.addEventListener('visibilitychange', syncCapture);
window.addEventListener('arcade-visor-hold', () => { visorOpen = true; syncCapture(); });
window.addEventListener('arcade-visor-resume', () => { visorOpen = false; syncCapture(); });

export function releaseMic(user) {
  users.delete(user);
  if (users.size || !stream) return;
  source?.disconnect();
  for (const track of stream.getTracks()) track.stop();
  stream = streamP = source = analyser = null;
}
async function getMic(user) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open Beat Room over HTTPS or localhost to use the microphone.');
  users.add(user);
  if (!streamP) {
    streamP = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(value => {
        stream = value;
        if (!users.size) { releaseMic(user); throw new Error('Microphone request canceled.'); }
        syncCapture();
        return value;
      }).catch(error => { streamP = null; throw error; });
  }
  try { return await streamP; } catch(error) { users.delete(user); throw error; }
}
export async function micAnalyser(user) {
  const ac = audio(), input = await getMic(user);
  if (!analyser) {
    source = ac.createMediaStreamSource(input);
    analyser = ac.createAnalyser(); analyser.fftSize = 2048;
    source.connect(analyser);
  }
  return analyser;
}

function pickType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

/** Start recording. Resolves to { stop(): Promise<AudioBuffer> }. */
export async function startRecording() {
  const stream = await getMic('tape');
  if (!window.MediaRecorder) throw new Error('Recording is not supported in this browser.');
  const type = pickType();
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(); recorder = rec; syncCapture();
  return {
    stop: () => new Promise((res, rej) => {
      rec.onstop = async () => {
        if (recorder === rec) recorder = null;
        releaseMic('tape');
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || type });
          res(await audio().decodeAudioData(await blob.arrayBuffer()));
        } catch (e) { rej(e); }
      };
      rec.state !== 'inactive' ? rec.stop() : rec.onstop();
    }),
  };
}

export function micError(e) {
  if (e?.name === 'NotAllowedError') return 'Microphone blocked. Allow mic access for this page and try again.';
  if (e?.name === 'NotFoundError') return 'No microphone found.';
  return e?.message || 'Could not open the microphone.';
}
