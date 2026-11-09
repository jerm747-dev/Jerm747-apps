/* Controller reader: browser Gamepad API plus the Encore Android bridge.
   Both report the standard mapping, so one table covers every pad. */
(() => {
'use strict';
let androidPads = [];
window.EncoreAndroidPads = {update(list) { androidPads = Array.isArray(list) ? list : []; }};
try { window.EncoreAndroid?.requestPads?.(); } catch {}

const B = {a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15};
function pads() {
 const list = [...androidPads];
 try { for (const p of navigator.getGamepads?.() || []) if (p && p.connected) list.push(p); } catch {}
 return list;
}
const value = b => typeof b === 'number' ? b : (b?.value ?? (b?.pressed ? 1 : 0));
const down = b => typeof b === 'number' ? b > .5 : !!(b?.pressed || value(b) > .5);

/* Combined snapshot of every connected pad (any pad can play). */
function read() {
 const all = pads(), s = {connected: all.length > 0, name: all[0]?.id || '', active: false};
 for (const k of Object.keys(B)) s[k] = false;
 let ax = 0, ay = 0;
 for (const p of all) {
  for (const [k, i] of Object.entries(B)) if (down(p.buttons?.[i])) s[k] = true;
  const x = p.axes?.[0] || 0, y = p.axes?.[1] || 0;
  if (Math.abs(x) > Math.abs(ax)) ax = x;
  if (Math.abs(y) > Math.abs(ay)) ay = y;
 }
 s.ax = Math.abs(ax) < .25 ? 0 : ax; s.ay = Math.abs(ay) < .25 ? 0 : ay;
 s.L = s.left || s.ax < -.45; s.R = s.right || s.ax > .45;
 s.U = s.up || s.ay < -.55; s.D = s.down || s.ay > .55;
 s.active = Object.keys(B).some(k => s[k]) || s.ax !== 0 || s.ay !== 0;
 return s;
}
globalThis.EncorePads = {read};
})();
