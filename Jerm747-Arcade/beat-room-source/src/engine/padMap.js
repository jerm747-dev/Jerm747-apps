// Bind to a rhythm row so replacing its sound also replaces what that button plays.
const storageKey = 'beatroom.controller.rows.v1';
const defaults = [0, 1, 2, 3, 4];
const names = ['A / ×', 'B / ○', 'X / □', 'Y / △', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
export const buttonName = (i) => names[i] || `Button ${i + 1}`;
export const assignable = (i) => Number.isInteger(i) && i >= 0 && i < 128 && ![8, 9, 16].includes(i);

function load() {
  try {
    const map = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(map) && map.length === 5 && map.every(assignable) && new Set(map).size === 5) return map;
  } catch { /* storage is optional */ }
  return [...defaults];
}

let state = { buttons: load(), learning: null, performing: false, message: '' };
const listeners = new Set();
export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function update(change) { state = { ...state, ...change }; listeners.forEach(fn => fn()); }
export function performMode(on) { update({ performing: on, learning: null, message: '' }); }
export function learn(row) { update({ performing: false, learning: row, message: '' }); }
export function cancelLearn(message = '') { update({ learning: null, message }); }
function save(buttons, message) {
  try { localStorage.setItem(storageKey, JSON.stringify(buttons)); }
  catch { message += ' This mapping lasts for this session.'; }
  update({ buttons, learning: null, message });
}
export function bind(button) {
  const row = state.learning;
  if (row == null) return;
  if (!assignable(button)) { update({ message: 'Choose a face button, shoulder, trigger, stick click or D-pad direction.' }); return; }
  const buttons = [...state.buttons], other = buttons.indexOf(button);
  if (other >= 0) buttons[other] = buttons[row];
  buttons[row] = button;
  save(buttons, other >= 0 && other !== row ? 'Assignments swapped.' : 'Assignment saved.');
}
export function reset() { save([...defaults], 'Default assignments restored.'); }
