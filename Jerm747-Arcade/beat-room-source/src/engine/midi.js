// Web MIDI for the synth keyboard: note on/off with velocity, sustain pedal (CC 64),
// all-notes-off (CC 120/123) and pitch bend. Listens on every connected input, any channel.
// Works in Chrome / Edge / Opera on desktop and Android, over https or localhost.
// Safari (iPhone/iPad) has no Web MIDI.
import * as synth from './synth.js';

let access = null;
let status = { state: 'off', devices: [], msg: '' };
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const getStatus = () => status;
export const supported = () => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
const set = (s) => { status = { ...status, ...s }; subs.forEach((fn) => fn(status)); };

function onMessage(e) {
  const [st, d1 = 0, d2 = 0] = e.data;
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

export async function connect() {
  if (!supported()) { set({ state: 'error', msg: 'This browser has no Web MIDI. Chrome or Edge (desktop or Android) has it.' }); return; }
  if (!window.isSecureContext) { set({ state: 'error', msg: 'MIDI needs the site on https (or localhost).' }); return; }
  set({ state: 'wait', msg: 'Asking for MIDI access…' });
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
  if (access) { access.inputs.forEach((i) => { i.onmidimessage = null; }); access.onstatechange = null; access = null; }
  synth.allOff(); synth.setBend(0);
  set({ state: 'off', devices: [], msg: '' });
}
