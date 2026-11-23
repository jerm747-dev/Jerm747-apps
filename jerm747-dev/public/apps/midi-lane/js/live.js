// Live: a MIDI routing board. Each route takes one input (a device, the on-screen keys, or any)
// on one channel or all, and sends it to one output (a device, or a MIDI Lane built-in sound)
// on the same or another channel. Routes stack: A→B and B→A can run side by side.
// A monitor logs every message; Test fires a note at an output; a runaway route (a feedback
// loop between two machines) switches itself off. Route sets save as named presets.
import * as M from './model.js';
import * as player from './player.js';
import { noteName } from './lanes.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'midilane.live';
const uid = () => Math.random().toString(36).slice(2, 8);
const store = (() => { try { return { routes: [], presets: {}, bg: false, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { routes: [], presets: {}, bg: false }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ routes: store.routes.map(({ err, ...r }) => r), presets: store.presets, bg: store.bg })); } catch { /* off */ } };
const newRoute = (o = {}) => ({ id: uid(), on: true, in: 'any', inName: '', inCh: -1, out: '', outName: '', outCh: -1, pass: 'all', clock: true, ...o });

let el, open = false, paused = false, log = [], logDirty = false, kbBase = 48;
const rate = new Map(); // route id -> { t, n }
const leds = new Set();

export function initLive() {
  el = document.createElement('div'); el.id = 'liveScreen'; el.className = 'live'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Live MIDI routing');
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('pointerdown', keyDown); el.addEventListener('pointerup', keyUp); el.addEventListener('pointercancel', keyUp);
  player.onMidiRaw(route);
  player.onMidi(() => { if (open) render(); });
  requestAnimationFrame(tick);
}
export function openLive() {
  open = true; el.hidden = false;
  if (player.midi.state === 'off') player.connectMidi();
  if (!store.routes.length) store.routes.push(newRoute({ out: defaultOut() }));
  render();
}
function close() { open = false; el.hidden = true; if (!store.bg) player.panic(false); }
const active = () => open || store.bg;
const defaultOut = () => player.midi.outputs[0]?.id || (M.P.tracks[0] ? `lane:${M.P.tracks[0].id}` : '');

// ---------- routing ----------
function route(bytes, from) {
  if (!active() || !bytes.length) return;
  const b0 = bytes[0];
  for (const r of store.routes) {
    if (!r.on || !r.out) continue;
    if (r.in !== 'any' && r.in !== from) continue;
    let out;
    if (b0 >= 0xf8) { if (!r.clock) continue; out = [b0]; }        // clock / start / stop / continue
    else if (b0 >= 0xf0) continue;                                // sysex and the rest: not routed
    else {
      const type = b0 & 0xf0, ch = b0 & 15;
      if (r.inCh >= 0 && ch !== r.inCh) continue;
      if (r.pass === 'notes' && type !== 0x80 && type !== 0x90) continue;
      out = [type | (r.outCh >= 0 ? r.outCh : ch), ...bytes.slice(1, type === 0xc0 || type === 0xd0 ? 2 : 3)];
    }
    if (guard(r)) continue;
    let ok = true;
    if (r.out.startsWith('lane:')) ok = toLane(r.out.slice(5), out);
    else ok = player.sendTo(r.out, out);
    if (!ok && !r.err) { r.err = 'That output isn’t connected right now. Plug it in and press Rescan.'; if (open) render(); }
    leds.add(`${r.id}:in`); if (ok) leds.add(`${r.id}:out`);
    if (b0 < 0xf8) addLog(r, from, out);
  }
}
function toLane(trackId, b) {
  const t = M.P.tracks.find((x) => x.id === trackId); if (!t) return false;
  const type = b[0] & 0xf0;
  if (type === 0x90 && b[2] > 0) player.monitorOn(t, b[1], b[2]);
  else if (type === 0x80 || type === 0x90) player.monitorOff(t, b[1]);
  return true;
}
// a route passing more than 1500 messages a second is almost surely a loop between two machines
function guard(r) {
  const now = performance.now(), g = rate.get(r.id) || { t: now, n: 0 };
  if (now - g.t > 1000) { g.t = now; g.n = 0; }
  g.n++; rate.set(r.id, g);
  if (g.n > 1500) {
    r.on = false; r.err = 'Switched off: over 1500 messages a second, which looks like a MIDI loop. Check that the two machines aren’t echoing each other (MIDI thru), then switch it back on.';
    save(); player.panic(false); if (open) render(); return true;
  }
  return false;
}

// ---------- monitor ----------
const nameOf = (id) => id === 'virtual' ? 'On-screen keys' : id === 'android' ? 'Android MIDI' : player.midi.inputs.find((i) => i.id === id)?.name || 'MIDI in';
const outName = (id) => id.startsWith('lane:') ? `MIDI Lane · ${M.P.tracks.find((t) => t.id === id.slice(5))?.name || 'track'}` : id === 'android' ? 'Android MIDI' : player.midi.outputs.find((o) => o.id === id)?.name || 'MIDI out';
function decode(b) {
  const type = b[0] & 0xf0, ch = (b[0] & 15) + 1;
  if (b[0] === 0xf8) return 'Clock';
  if (b[0] === 0xfa) return 'Start'; if (b[0] === 0xfb) return 'Continue'; if (b[0] === 0xfc) return 'Stop';
  if (type === 0x90 && b[2] > 0) return `Note on ${noteName(b[1])} vel ${b[2]} · ch ${ch}`;
  if (type === 0x80 || type === 0x90) return `Note off ${noteName(b[1])} · ch ${ch}`;
  if (type === 0xb0) return `CC ${b[1]} = ${b[2]} · ch ${ch}`;
  if (type === 0xe0) return `Pitch bend ${((b[2] << 7) | b[1]) - 8192} · ch ${ch}`;
  if (type === 0xc0) return `Program ${b[1] + 1} · ch ${ch}`;
  if (type === 0xd0) return `Pressure ${b[1]} · ch ${ch}`;
  if (type === 0xa0) return `Poly pressure ${noteName(b[1])} ${b[2]} · ch ${ch}`;
  return b.map((x) => x.toString(16)).join(' ');
}
function addLog(r, from, out) {
  if (paused || !open) return;
  const i = store.routes.indexOf(r) + 1;
  log.unshift({ t: new Date(), txt: decode(out), path: `${i}: ${nameOf(from)} → ${outName(r.out)}` });
  if (log.length > 80) log.length = 80;
  logDirty = true;
}
function tick() {
  if (open) {
    for (const k of leds) { const d = el.querySelector(`[data-led="${k}"]`); if (d) { d.classList.add('on'); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('on'), 80); } }
    if (logDirty) { const ul = $('#liveLog', el); if (ul) ul.innerHTML = logHtml(); logDirty = false; }
  }
  leds.clear();
  requestAnimationFrame(tick);
}
const logHtml = () => log.length ? log.map((x) => `<li><time>${x.t.toLocaleTimeString([], { hour12: false })}.${String(x.t.getMilliseconds()).padStart(3, '0')}</time><b>${esc(x.txt)}</b><small>${esc(x.path)}</small></li>`).join('')
  : '<li class="empty">Nothing yet. Play something on an input, or press Test on a route.</li>';

// ---------- render ----------
function render() {
  if (!open) return;
  const m = player.midi, ins = m.inputs, outs = m.outputs;
  // a saved route keeps working when a device comes back with a new id but the same name
  for (const r of store.routes) {
    if (r.in !== 'any' && r.in !== 'virtual' && r.in !== 'android' && !ins.some((i) => i.id === r.in)) { const same = ins.find((i) => i.name === r.inName); if (same) r.in = same.id; }
    if (r.out && !r.out.startsWith('lane:') && r.out !== 'android' && !outs.some((o) => o.id === r.out)) { const same = outs.find((o) => o.name === r.outName); if (same) { r.out = same.id; r.err = ''; } }
  }
  const status = m.state === 'on' ? `${ins.length} input${ins.length === 1 ? '' : 's'}: ${ins.map((i) => esc(i.name)).join(', ') || 'none'} · ${outs.length} output${outs.length === 1 ? '' : 's'}: ${outs.map((o) => esc(o.name)).join(', ') || 'none'}`
    : m.state === 'error' ? esc(m.msg) : 'Connecting to MIDI…';
  const chOpts = (v, first) => `<option value="-1">${first}</option>` + Array.from({ length: 16 }, (_, i) => `<option value="${i}" ${v === i ? 'selected' : ''}>ch ${i + 1}</option>`).join('');
  const inOpts = (v, name) => [['any', 'Any input'], ...ins.map((i) => [i.id, i.name]), ['virtual', 'On-screen keys'], ...(window.MidiLaneAndroid ? [['android', 'Android MIDI']] : [])]
    .map(([id, n]) => `<option value="${esc(id)}" ${id === v ? 'selected' : ''}>${esc(n)}</option>`).join('')
    + (v !== 'any' && v !== 'virtual' && v !== 'android' && !ins.some((i) => i.id === v) ? `<option value="${esc(v)}" selected>${esc(name || 'Missing input')} (not connected)</option>` : '');
  const outOpts = (v, name) => `<option value="" ${v ? '' : 'selected'}>Choose output…</option>` + `<optgroup label="Devices">${outs.map((o) => `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}${window.MidiLaneAndroid ? `<option value="android" ${v === 'android' ? 'selected' : ''}>Android MIDI</option>` : ''}${v && !v.startsWith('lane:') && v !== 'android' && !outs.some((o) => o.id === v) ? `<option value="${esc(v)}" selected>${esc(name || 'Missing output')} (not connected)</option>` : ''}</optgroup>`
    + `<optgroup label="MIDI Lane sounds">${M.P.tracks.map((t) => `<option value="lane:${t.id}" ${v === `lane:${t.id}` ? 'selected' : ''}>${esc(t.name)} (${t.inst === 'drumway' ? 'Drumway' : t.inst === 'avionyx' ? 'Avionyx' : 'MIDI only'})</option>`).join('')}</optgroup>`;
  const presets = Object.keys(store.presets);
  el.innerHTML = `
  <div class="rec-top"><h2 class="live-h">Live</h2><span class="note live-sub">MIDI routing: plug things in, route them, watch it flow</span>
    <button class="ib" data-a="close" aria-label="Close Live">×</button></div>
  <div class="live-bar">
    <button class="tb" data-a="rescan">${m.state === 'on' ? 'Rescan' : 'Connect MIDI'}</button>
    <select data-k="preset" aria-label="Presets"><option value="">Presets${presets.length ? '' : ' (none yet)'}</option>${presets.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
    <input data-k="pname" placeholder="Preset name" maxlength="40" aria-label="Preset name"><button class="tb" data-a="psave">Save</button>
    <button class="tb danger" data-a="pdel" ${presets.length ? '' : 'disabled'}>Delete preset</button>
    <button class="tg ${store.bg ? 'on' : ''}" data-a="bg"><i></i>Keep routing when closed</button>
  </div>
  <p class="note live-status">${status}</p>
  <div class="live-body">
    <div class="routes">
      ${store.routes.map((r, i) => `<div class="route ${r.on ? '' : 'off'}" data-id="${r.id}">
        <b class="rt-n">${i + 1}</b>
        <button class="tg ${r.on ? 'on' : ''}" data-k="on" aria-pressed="${r.on}"><i></i>${r.on ? 'On' : 'Off'}</button>
        <div class="rt-end"><small>From</small><select data-k="in" aria-label="Route ${i + 1} input">${inOpts(r.in, r.inName)}</select><select data-k="inCh" aria-label="Input channel">${chOpts(r.inCh, 'All ch')}</select></div>
        <span class="rt-arrow" aria-hidden="true"><i class="led" data-led="${r.id}:in"></i><svg viewBox="0 0 24 24"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/></svg><i class="led" data-led="${r.id}:out"></i></span>
        <div class="rt-end"><small>To</small><select data-k="out" aria-label="Route ${i + 1} output">${outOpts(r.out, r.outName)}</select><select data-k="outCh" aria-label="Output channel">${chOpts(r.outCh, 'Same ch')}</select></div>
        <select data-k="pass" aria-label="What passes"><option value="all" ${r.pass === 'all' ? 'selected' : ''}>Everything</option><option value="notes" ${r.pass === 'notes' ? 'selected' : ''}>Notes only</option></select>
        <button class="tg ${r.clock ? 'on' : ''}" data-k="clock" title="Pass clock, start and stop"><i></i>Clock</button>
        <button class="sm" data-a="test" ${r.out ? '' : 'disabled'} title="Send a C4 note to this output">Test</button>
        <button class="x" data-a="del" aria-label="Remove route ${i + 1}">×</button>
        ${r.err ? `<p class="rt-err">${esc(r.err)}</p>` : ''}
      </div>`).join('')}
      <button class="tb add-route" data-a="add">+ Add route</button>
      <div class="live-keys"><div class="rec-kbhead"><button class="sm" data-oct="-12">Oct −</button><span class="note">On-screen keys (input) · ${noteName(kbBase)}–${noteName(kbBase + 24)}</span><button class="sm" data-oct="12">Oct +</button></div>
        <div class="piano">${Array.from({ length: 25 }, (_, k) => `<button class="pk ${[1, 3, 6, 8, 10].includes((kbBase + k) % 12) ? 'blk' : ''}" data-key="${kbBase + k}" aria-label="${noteName(kbBase + k)}"></button>`).join('')}</div></div>
    </div>
    <div class="monitor"><div class="mon-head"><h2>Monitor</h2><button class="sm" data-a="pause">${paused ? 'Resume' : 'Pause'}</button><button class="sm" data-a="clear">Clear</button></div>
      <ol id="liveLog" class="mon-log">${logHtml()}</ol></div>
  </div>`;
}

// ---------- events ----------
const findR = (e) => store.routes.find((r) => r.id === e.target.closest('.route')?.dataset.id);
function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.oct) { kbBase = Math.max(12, Math.min(96, kbBase + +b.dataset.oct)); render(); return; }
  const r = findR(e), a = b.dataset.a, k = b.dataset.k;
  if (r && (k === 'on' || k === 'clock')) { r[k] = !r[k]; if (k === 'on') { r.err = ''; rate.delete(r.id); if (!r.on) player.panic(false); } save(); render(); return; }
  if (a === 'close') close();
  else if (a === 'rescan') player.connectMidi().then(render);
  else if (a === 'add') { const last = store.routes.at(-1); store.routes.push(newRoute(last ? { in: last.out && !last.out.startsWith('lane:') ? 'any' : 'any', out: defaultOut() } : { out: defaultOut() })); save(); render(); }
  else if (a === 'del' && r) { store.routes = store.routes.filter((x) => x !== r); player.panic(false); save(); render(); }
  else if (a === 'test' && r) test(r);
  else if (a === 'pause') { paused = !paused; render(); }
  else if (a === 'clear') { log = []; logDirty = true; }
  else if (a === 'bg') { store.bg = !store.bg; save(); render(); }
  else if (a === 'psave') {
    const name = ($('[data-k=pname]', el).value || '').trim() || `Preset ${Object.keys(store.presets).length + 1}`;
    store.presets[name] = store.routes.map(({ err, ...x }) => x); save(); render(); flash(`Saved preset “${name}”.`);
  } else if (a === 'pdel') {
    const name = $('[data-k=preset]', el).value; if (!name) { flash('Pick a preset in the list first.'); return; }
    delete store.presets[name]; save(); render(); flash(`Deleted preset “${name}”.`);
  }
}
function onChange(e) {
  const k = e.target.dataset.k; if (!k) return;
  if (k === 'preset') {
    const p = store.presets[e.target.value]; if (!p) return;
    player.panic(false); store.routes = p.map((x) => ({ ...x, id: uid() })); save(); render(); flash(`Loaded preset “${e.target.value}”.`); return;
  }
  if (k === 'pname') return;
  const r = findR(e); if (!r) return;
  const v = e.target.value;
  if (k === 'inCh' || k === 'outCh') r[k] = +v;
  else if (k === 'in') { r.in = v; r.inName = player.midi.inputs.find((i) => i.id === v)?.name || ''; }
  else if (k === 'out') { player.panic(false); r.out = v; r.outName = player.midi.outputs.find((o) => o.id === v)?.name || ''; r.err = ''; }
  else r[k] = v;
  save(); render();
}
function test(r) {
  const ch = r.outCh >= 0 ? r.outCh : 0, on = [0x90 | ch, 60, 100], off = [0x80 | ch, 60, 0];
  const send = (b) => (r.out.startsWith('lane:') ? toLane(r.out.slice(5), b) : player.sendTo(r.out, b));
  const ok = send(on); setTimeout(() => send(off), 400);
  leds.add(`${r.id}:out`);
  paused || (log.unshift({ t: new Date(), txt: ok ? `Test: Note on C4 vel 100 · ch ${ch + 1}` : 'Test failed: output not connected', path: `${store.routes.indexOf(r) + 1}: test → ${outName(r.out)}` }), logDirty = true);
  if (!ok) { r.err = 'That output isn’t connected right now. Plug it in and press Rescan.'; render(); }
}
function flash(msg) { const s = $('.live-status', el); if (s) { s.textContent = msg; setTimeout(() => render(), 1800); } }
const keysDown = new Map();
function keyDown(e) {
  const k = e.target.closest('[data-key]'); if (!k) return;
  e.preventDefault(); try { k.setPointerCapture(e.pointerId); } catch { /* fine */ }
  keysDown.set(e.pointerId, +k.dataset.key); k.classList.add('hit');
  player.virtualIn('on', +k.dataset.key, 100, 0);
}
function keyUp(e) {
  const n = keysDown.get(e.pointerId); if (n == null) return;
  keysDown.delete(e.pointerId); el.querySelectorAll(`[data-key="${n}"]`).forEach((x) => x.classList.remove('hit'));
  player.virtualIn('off', n, 0, 0);
}
