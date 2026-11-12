// Click on REC: while any take is armed or recording (pads, synth lane, tape), make sure the
// metronome is clicking. If it was already on, it stays on; if this turned it on, it goes back
// off when the last take ends. The click is on the monitor path, so it never lands on tape.
// Setting: Settings.clickOnRec (default on).
import { getSettings } from './audio.js';
import { arm, isArmed } from './clock.js';

const owners = new Set();
let autoOn = false;

/** A take is starting (owner: 'pads' | 'synth' | 'tape'). at = audio time the transport starts. */
export function begin(owner, at) {
  if (!getSettings().clickOnRec) return;
  owners.add(owner);
  if (!isArmed('click')) { autoOn = true; arm('click', true, at); }
}
/** That take is over. */
export function end(owner) {
  if (!owners.delete(owner) || owners.size) return;
  if (autoOn) { autoOn = false; if (isArmed('click')) arm('click', false); }
}
/** The player turned the click off by hand: don't switch it off again for them later. */
export const forget = () => { autoOn = false; };
