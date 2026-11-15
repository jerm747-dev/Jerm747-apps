// Web MIDI for the synth keyboard: note on/off with velocity, sustain pedal (CC 64),
// all-notes-off (CC 120/123) and pitch bend. Listens on every connected input, any channel.
// Works in Chrome / Edge / Opera on desktop and Android, over https or localhost.
// Safari (iPhone/iPad) has no Web MIDI.
// In the Android app, the WebView has no Web MIDI either, so the app reads USB/Bluetooth MIDI
// natively (android.media.midi) and hands each message to window.__beatRoomMidi.
import * as synth from './synth.js';

let access = null;
let status = { state: 'off', devices: [], msg: '' };
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const getStatus = () => status;
const native = () => typeof window !== 'undefined' && window.BeatRoomAndroid && typeof window.BeatRoomAndroid.midiConnect === 'function';
export const supported = () => native() || (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function');
const set = (s) => { status = { ...status, ...s }; subs.forEach((fn) => fn(status)); };

function onMessage(e) { handle(e.data[0], e.data[1] || 0, e.data[2] || 0); }
function handle(st, d1 = 0, d2 = 0) {
  const type = st & 0xf0;
  if (type === 0x90 && d2 > 0) synth.noteOn(d1, d2 / 127);
  else if (type === 0x80 || type === 0x90) synth.noteOff(d1);
  else if (type === 0xb0) {
    if (d1 === 64) synth.setSustain(d2 >= 64);
    else if (d1 === 120 || d1 === 123) synth.allOff();
  } else if (type === 0xe0) synth.setBend((((d2 << 7) | d1) - 8192) / 8192 * synth.BEND);
}

function attach() {
  if (!access) return;
  const devices = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = onMessage;
    if (input.state !== 'disconnected') devices.push(input.name || 'MIDI input');
  });
  set({ state: 'on', devices, msg: devices.length ? '' : 'No MIDI keyboard found yet. Plug one in and it shows up here.' });
}

// Android app: native MIDI calls these
if (typeof window !== 'undefined') {
  window.__beatRoomMidiPanic = () => { synth.setSustain(false); synth.allOff(); synth.setBend(0); };
  window.__beatRoomMidiBatch = (messages) => { for (const [st, d1, d2] of messages) handle(st, d1, d2); };
  window.__beatRoomMidi = (st, d1, d2) => handle(st, d1, d2);
  window.__beatRoomMidiDevices = (names) => {
    if (status.state === 'off') return;
    const devices = names || [];
    set({ state: 'on', devices, msg: devices.length ? '' : 'No MIDI keyboard found yet. Plug one in (USB OTG) or pair one over Bluetooth MIDI.' });
  };
}

export async function connect() {
  if (native()) {
    synth.warm();
    set({ state: 'wait', msg: 'Looking for MIDI keyboards…' });
    try { window.BeatRoomAndroid.midiConnect(); } catch { set({ state: 'error', msg: 'This phone has no MIDI support (Android 6 or newer with MIDI is needed).' }); }
    return;
  }
  if (!supported()) { set({ state: 'error', msg: 'This browser has no Web MIDI. Chrome or Edge (desktop or Android) has it.' }); return; }
  if (!window.isSecureContext) { set({ state: 'error', msg: 'MIDI needs the site on https (or localhost).' }); return; }
  set({ state: 'wait', msg: 'Asking for MIDI access…' });
  synth.warm(); // build the synth and wake audio now (this is a tap), so the first note plays at once
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = attach;
    attach();
  } catch {
    access = null;
    set({ state: 'error', msg: 'MIDI access was blocked. Allow MIDI for this site and try again.' });
  }
}

export function disconnect() {
  if (native()) { try { window.BeatRoomAndroid.midiDisconnect(); } catch { /* gone */ } }
  if (access) { access.inputs.forEach((i) => { i.onmidimessage = null; }); access.onstatechange = null; access = null; }
  synth.setSustain(false); synth.allOff(); synth.setBend(0);
  set({ state: 'off', devices: [], msg: '' });
}

export const bluetoothSupported = () => native() && typeof window.BeatRoomAndroid.midiBluetooth === 'function';
export function connectBluetooth() {
  if (!bluetoothSupported()) return;
  synth.warm();
  if (status.state === 'off') set({ state: 'wait', msg: 'Choose a Bluetooth MIDI keyboard.' });
  window.BeatRoomAndroid.midiBluetooth();
}
