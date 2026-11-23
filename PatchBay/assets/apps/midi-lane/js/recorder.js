// Record screen: its own full-screen mode that feeds the lanes.
//   Take  - a set number of bars, stops by itself at the end
//   Free  - no end; whatever comes in until you press Stop
// Click and count-in are optional; the song can play along (minus the track being recorded).
// Input: any USB MIDI device, the Android app bridge, or the on-screen keys / pads.
// After Stop you review the take and send it to a lane (merge or replace, optional quantize).
import * as M from './model.js';
import * as player from './player.js';
import { noteName } from './lanes.js';
import { KIT_ROWS, drumName } from './drumway.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OPT = (() => { try { return { mode: 'take', bars: 4, countIn: 1, click: true, song: true, monitor: true, inCh: -1, ...JSON.parse(localStorage.getItem('midilane.rec')) }; } catch { return { mode: 'take', bars: 4, countIn: 1, click: true, song: true, monitor: true, inCh: -1 }; } })();
const saveOpt = () => { try { localStorage.setItem('midilane.rec', JSON.stringify(OPT)); } catch { /* off */ } };

let picked = new Set(), box = null, layout = null, offMidi = null;
let el, hooks, state = 'setup', target = null, fromTick = 0, take = [], open = new Map(), raf = 0, offIn = null, endTick = 0, kbBase = 48;

export function initRecorder(h) {
  hooks = h;
  el = document.createElement('div'); el.id = 'recScreen'; el.className = 'rec'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Record');
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('pointerdown', padDown);
  el.addEventListener('pointerup', padUp); el.addEventListener('pointercancel', padUp); el.addEventListener('pointerleave', padUp, true);
  new ResizeObserver(() => draw()).observe(el);
  el.addEventListener('pointerdown', boxDown); el.addEventListener('pointermove', boxMove); el.addEventListener('pointerup', boxUp);
}
// review: drag a box over the take to pick part of it; tap to pick all again
function boxDown(e) {
  if (state !== 'review' || !e.target.closest('.rec-view')) return;
  const cv = $('#recCv', el), r = cv.getBoundingClientRect(); box = { x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top, id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
}
function boxMove(e) { if (!box || e.pointerId !== box.id) return; const r = $('#recCv', el).getBoundingClientRect(); box.x1 = e.clientX - r.left; box.y1 = e.clientY - r.top; draw(); }
function boxUp(e) {
  if (!box || e.pointerId !== box.id) return;
  const b = box; box = null;
  if (Math.abs(b.x1 - b.x0) + Math.abs(b.y1 - b.y0) < 8 || !layout) picked = new Set(take);
  else {
    const L = layout, xa = Math.min(b.x0, b.x1), xb = Math.max(b.x0, b.x1), ya = Math.min(b.y0, b.y1), yb = Math.max(b.y0, b.y1);
    picked = new Set(take.filter((x) => { const x1 = x.t * L.k, x2 = x1 + Math.max(2, x.d * L.k), y1 = L.yOf(x.n), y2 = y1 + L.rh; return x2 >= xa && x1 <= xb && y2 >= ya && y1 <= yb; }));
    if (!picked.size) picked = new Set(take);
  }
  render();
}

export function openRecorder() {
  target = hooks.track(); state = 'setup'; take = []; open.clear();
  fromTick = Math.floor(player.startTick / M.BAR) * M.BAR;
  if (player.isPlaying()) hooks.stopPlay();
  el.hidden = false; render();
  offIn = player.onMidiIn(onNote);
  offMidi = offMidi || player.onMidi(() => { if (!el.hidden && state !== 'rec') render(); });
  if (player.midi.state === 'off') player.connectMidi(); // quietly try; on-screen keys work regardless
}
function close() {
  if (state === 'rec' || state === 'count') stopRec(true);
  el.hidden = true; offIn?.(); offIn = null; cancelAnimationFrame(raf);
}

// ---------- render ----------
const trackOpts = () => M.P.tracks.map((t) => `<option value="${t.id}" ${t.id === target.id ? 'selected' : ''}>${esc(t.name)} · ch ${t.ch + 1}${t.drum ? ' · drums' : ''}</option>`).join('')
  + (M.P.tracks.length < M.MAX_TRACKS ? '<option value="new-keys">+ New keys track</option><option value="new-drums">+ New drum track</option>' : '');
function render() {
  const t = target, col = M.color(t), live = state === 'rec' || state === 'count';
  const ins = player.midi.inputs;
  const inMsg = player.midi.state === 'on' ? (ins.length ? `MIDI in: ${ins.map((i) => esc(i.name)).join(', ')}` : 'No MIDI input device found. Use the keys below, or plug one in and press Rescan.')
    : player.midi.state === 'error' ? esc(player.midi.msg) : 'Looking for MIDI input…';
  el.style.setProperty('--c', col);
  el.innerHTML = `
  <div class="rec-top">
    <h2>Record</h2>
    <label class="rec-target"><i></i><select data-k="target" ${live ? 'disabled' : ''} aria-label="Record onto">${trackOpts()}</select></label>
    <span class="rec-led" id="recLed" title="MIDI in"></span>
    <button class="ib" data-a="close" aria-label="Close record screen">×</button>
  </div>
  ${state === 'review' ? reviewHtml() : setupHtml(live)}
  <div class="rec-view"><canvas id="recCv"></canvas><div class="rec-big" id="recBig"></div></div>
  <div class="rec-input">${t.drum ? padsHtml() : keysHtml()}</div>
  <p class="note rec-in">${inMsg} <button class="sm" data-a="rescan">Rescan</button></p>`;
  draw();
}
function setupHtml(live) {
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${k}" data-v="${v}" class="${String(OPT[k]) === String(v) ? 'on' : ''}" ${live ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
  const tg = (k, l) => `<button class="tg ${OPT[k] ? 'on' : ''}" data-tog="${k}" ${live ? 'disabled' : ''}><i></i>${l}</button>`;
  const bars = Array.from({ length: M.P.bars }, (_, i) => `<option value="${i * M.BAR}" ${i * M.BAR === fromTick ? 'selected' : ''}>Bar ${i + 1}</option>`).join('');
  return `<div class="rec-setup"><div class="rec-opts">
    ${seg('mode', [['take', 'Take'], ['free', 'Free']])}
    ${OPT.mode === 'take' ? `<select data-k="bars" ${live ? 'disabled' : ''} aria-label="Take length">${[1, 2, 4, 8, 16].map((b) => `<option value="${b}" ${b === OPT.bars ? 'selected' : ''}>${b} bar${b > 1 ? 's' : ''}</option>`).join('')}</select>` : '<span class="note">until you press Stop</span>'}
    <select data-k="from" ${live ? 'disabled' : ''} aria-label="Start at">${bars}</select>
    ${seg('countIn', [[0, 'No count'], [1, 'Count 1 bar']])}
    ${tg('click', 'Click')}${tg('song', 'Play song')}${tg('monitor', 'Hear input')}
    <select data-k="inCh" ${live ? 'disabled' : ''} aria-label="Input channel"><option value="-1">In: all ch</option>${Array.from({ length: 16 }, (_, i) => `<option value="${i}" ${OPT.inCh === i ? 'selected' : ''}>In: ch ${i + 1}</option>`).join('')}</select>
  </div>
  <div class="rec-go">
    <button class="recbtn ${live ? 'live' : ''}" data-a="${live ? 'stop' : 'rec'}"><span></span>${live ? 'Stop' : 'Record'}</button>
    <div class="rec-pos"><b id="recPos">${barBeat(fromTick)}</b><small id="recSub">${live ? '' : OPT.mode === 'take' ? `${OPT.bars}-bar take onto ${esc(target.name)}` : `free take onto ${esc(target.name)}`}</small></div>
  </div></div>`;
}
function reviewHtml() {
  const n = take.length, len = takeLen(), bars = len / M.BAR, part = picked.size && picked.size < n;
  const startOpts = Array.from({ length: 64 }, (_, i) => `<option value="${i * M.BAR}" ${i * M.BAR === fromTick ? 'selected' : ''}>at bar ${i + 1}</option>`).join('');
  return `<div class="rec-review">
    <div class="rec-sum"><b>${n ? `${n} note${n > 1 ? 's' : ''}` : 'No notes'}</b><small>${bars} bar${bars > 1 ? 's' : ''} recorded${n ? ` · ${part ? `${picked.size} selected` : 'all selected'}. Drag a box over the take to send part of it.` : '. Play something while recording.'}</small></div>
    <label class="field mini"><small>Send to</small><select data-k="target">${trackOpts()}</select></label>
    <label class="field mini"><small>Place</small><select data-k="place">${startOpts}</select></label>
    <div class="field mini"><small>Into the lane</small><div class="seg"><button data-set="how" data-v="merge" class="${OPT.how !== 'replace' ? 'on' : ''}">Merge</button><button data-set="how" data-v="replace" class="${OPT.how === 'replace' ? 'on' : ''}">Replace bars</button></div></div>
    <label class="field mini"><small>Timing</small><select data-k="q">${[['', 'As played'], ['q120', 'Quantize 1/16'], ['q240', 'Quantize 1/8'], ['h120', 'Half quantize 1/16'], ['h240', 'Half quantize 1/8']].map(([v, l]) => `<option value="${v}" ${(OPT.q || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="rec-acts">
      <button class="tb" data-a="hear" ${n ? '' : 'disabled'}>Hear take</button>
      <button class="tb" data-a="again">Record again</button>
      <button class="tb danger" data-a="discard">Discard</button>
      <button class="tb accent big-send" data-a="send" ${n ? '' : 'disabled'}>${part ? `Send ${picked.size} selected` : 'Send to lane'}</button>
    </div>
  </div>`;
}
function keysHtml() {
  const k = [];
  for (let n = kbBase; n < kbBase + 25; n++) k.push(`<button class="pk ${[1, 3, 6, 8, 10].includes(n % 12) ? 'blk' : ''}" data-pad="${n}" aria-label="${noteName(n)}"></button>`);
  return `<div class="rec-kbhead"><button class="sm" data-oct="-12">Oct −</button><span class="note">${noteName(kbBase)}–${noteName(kbBase + 24)} · on-screen keys</span><button class="sm" data-oct="12">Oct +</button></div><div class="piano rec-piano">${k.join('')}</div>`;
}
function padsHtml() {
  const order = [49, 51, 56, 46, 50, 45, 42, 38, 36].reverse();
  return `<div class="pads">${order.map((n) => `<button class="pad" data-pad="${n}">${drumName(n)}</button>`).join('')}</div>`;
}
const barBeat = (t) => { if (t < 0) return `−${Math.ceil(-t / M.PPQ)}`; const b = Math.floor(t / M.PPQ); return `${Math.floor(b / 4) + 1}.${(b % 4) + 1}`; };

// ---------- events ----------
function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.set) { OPT[b.dataset.set] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; saveOpt(); render(); return; }
  if (b.dataset.tog) { OPT[b.dataset.tog] = !OPT[b.dataset.tog]; saveOpt(); render(); return; }
  if (b.dataset.oct) { kbBase = Math.max(12, Math.min(96, kbBase + +b.dataset.oct)); render(); return; }
  const a = b.dataset.a;
  if (a === 'close') close();
  else if (a === 'rec') startRec();
  else if (a === 'stop') stopRec();
  else if (a === 'rescan') { player.connectMidi().then(render); }
  else if (a === 'again' || a === 'discard') { take = []; state = 'setup'; render(); if (a === 'discard') hooks.say('Take discarded.'); }
  else if (a === 'hear') hear();
  else if (a === 'send') send();
}
function onChange(e) {
  const k = e.target.dataset.k; if (!k) return;
  const v = e.target.value;
  if (k === 'target') {
    if (v === 'new-keys' || v === 'new-drums') { const t = M.addTrack(v === 'new-drums'); if (t) target = t; }
    else target = M.P.tracks.find((t) => t.id === v) || target;
    hooks.selectTrack(target.id); render(); return;
  }
  if (k === 'from') { fromTick = +v; render(); return; }
  if (k === 'place') { fromTick = +v; draw(); return; }
  if (k === 'bars' || k === 'inCh') OPT[k] = +v; else OPT[k] = v;
  saveOpt(); render();
}
const padsDown = new Map();
function padDown(e) {
  const p = e.target.closest('[data-pad]'); if (!p) return;
  e.preventDefault(); try { p.setPointerCapture(e.pointerId); } catch { /* fine */ }
  const n = +p.dataset.pad, v = target.drum ? 110 : 100;
  padsDown.set(e.pointerId, n); p.classList.add('hit');
  player.virtualIn('on', n, v, OPT.inCh >= 0 ? OPT.inCh : 0);
}
function padUp(e) {
  const n = padsDown.get(e.pointerId); if (n == null) return;
  padsDown.delete(e.pointerId);
  el.querySelectorAll(`[data-pad="${n}"]`).forEach((x) => x.classList.remove('hit'));
  player.virtualIn('off', n, 0, OPT.inCh >= 0 ? OPT.inCh : 0);
}

// ---------- recording ----------
function onNote(ev) {
  if (el.hidden || (OPT.inCh >= 0 && ev.ch !== OPT.inCh)) return;
  const led = $('#recLed', el); if (led) { led.classList.add('on'); clearTimeout(led._t); led._t = setTimeout(() => led.classList.remove('on'), 90); }
  if (OPT.monitor || state !== 'rec') { if (ev.type === 'on') player.monitorOn(target, ev.n, ev.v); else player.monitorOff(target, ev.n); }
  if (state !== 'rec' && state !== 'count') return;
  let t = player.tickAt(ev.ts);
  if (ev.type === 'on') {
    if (t < fromTick - M.PPQ / 2) return;        // too early in the count-in
    t = Math.max(fromTick, t);                    // a hair early counts as the downbeat
    open.set(ev.n, { t, v: ev.v });
  } else {
    const o = open.get(ev.n); if (!o) return;
    open.delete(ev.n);
    take.push({ t: o.t, d: Math.max(15, t - o.t), n: ev.n, v: o.v });
  }
}
function startRec() {
  take = []; open.clear();
  endTick = OPT.mode === 'take' ? fromTick + OPT.bars * M.BAR : Infinity;
  if (!player.playRec({ from: fromTick, countIn: OPT.countIn ? 4 : 0, click: OPT.click, song: OPT.song, exclude: target.id })) { hooks.say('Audio isn’t available here.'); return; }
  state = 'rec'; recFrom = fromTick; // notes in the last half beat of the count-in still land on the downbeat
  render(); loop();
}
function stopRec(silent = false) {
  const now = Math.min(player.position(), endTick);
  for (const [n, o] of open) take.push({ t: o.t, d: Math.max(15, now - o.t), n, v: o.v });
  open.clear();
  hooks.stopPlay(); cancelAnimationFrame(raf);
  endTick = OPT.mode === 'take' ? fromTick + OPT.bars * M.BAR : Math.max(fromTick + M.BAR, Math.ceil(Math.max(now, ...take.map((x) => x.t + x.d)) / M.BAR) * M.BAR);
  take.forEach((x) => { x.t -= fromTick; if (x.t + x.d > endTick - fromTick) x.d = Math.max(15, endTick - fromTick - x.t); });
  take = take.filter((x) => x.t < endTick - fromTick).sort((a, b) => a.t - b.t);
  picked = new Set(take);
  if (!silent) { state = 'review'; render(); }
}
let recFrom = 0;
const takeLen = () => (state === 'review' ? endTick - recFrom : OPT.mode === 'take' ? OPT.bars * M.BAR : M.BAR * 4);
function loop() {
  const tick = () => {
    if (state !== 'rec') return;
    const p = player.position();
    const big = $('#recBig', el), pos = $('#recPos', el), sub = $('#recSub', el);
    if (p < fromTick) { big.textContent = String(Math.ceil((fromTick - p) / M.PPQ)); big.classList.add('show'); sub.textContent = 'count-in'; }
    else { big.classList.remove('show'); pos.textContent = barBeat(p); sub.textContent = OPT.mode === 'take' ? `recording · ends bar ${endTick / M.BAR + 1}` : 'recording · press Stop when done'; }
    draw(p);
    if (p >= endTick) { stopRec(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function hear() {
  // play the take once through the target's sound, from now
  const c = player.audioCtx(); if (!c) return;
  const src = picked.size ? take.filter((x) => picked.has(x)) : take;
  const s = 60 / (M.P.bpm * M.PPQ), t0 = c.currentTime + 0.05;
  src.forEach((x) => player.previewAt(target, x.n, x.v, t0 + x.t * s, x.d * s));
}

// ---------- send to lane ----------
function send() {
  const t = target, at = fromTick, src = picked.size ? take.filter((x) => picked.has(x)) : take;
  const part = src.length < take.length;
  // replacing with part of a take only clears the span that part covers
  const span0 = part ? Math.floor(Math.min(...src.map((x) => x.t)) / M.STEP) * M.STEP : 0;
  const len = part ? Math.ceil(Math.max(...src.map((x) => x.t + x.d)) / M.STEP) * M.STEP - span0 : endTick - recFrom;
  let notes = src.map((x) => ({ ...x, t: x.t + at }));
  const q = OPT.q || '';
  if (q) (q[0] === 'q' ? M.quantize : M.halfQuantize)(notes, +q.slice(1));
  M.pushUndo();
  if (OPT.how === 'replace') t.notes = t.notes.filter((x) => x.t < at + span0 || x.t >= at + span0 + len);
  t.notes.push(...notes);
  const needBars = Math.min(64, Math.ceil((at + span0 + len) / M.BAR));
  if (needBars > M.P.bars) M.P.bars = needBars;
  M.changed('all');
  fly(t, () => { el.hidden = true; offIn?.(); offIn = null; hooks.afterSend(t, notes, at + span0, len); });
}
function fly(t, done) {
  const cv = $('#recCv', el), row = hooks.trackRow(t.id);
  if (!cv || !row || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  const a = cv.getBoundingClientRect(), b = row.getBoundingClientRect();
  const ghost = document.createElement('img'); ghost.src = cv.toDataURL(); ghost.className = 'rec-fly';
  Object.assign(ghost.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.appendChild(ghost);
  el.classList.add('leaving');
  requestAnimationFrame(() => {
    const sx = b.width / a.width, sy = b.height / a.height;
    ghost.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${sx}, ${sy})`;
    ghost.style.opacity = '0.15';
  });
  setTimeout(() => { ghost.remove(); el.classList.remove('leaving'); done(); }, 620);
}

// ---------- live view ----------
function draw(pos = null) {
  const cv = $('#recCv', el); if (!cv || el.hidden) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const col = M.color(target), base = state === 'review' ? 0 : fromTick;
  const len = state === 'review' ? endTick - recFrom : OPT.mode === 'take' ? OPT.bars * M.BAR : Math.max(4 * M.BAR, Math.ceil(((pos ?? fromTick) - fromTick + M.BAR) / M.BAR) * M.BAR);
  const ns = state === 'review' ? take : [...take.map((x) => ({ ...x, t: x.t - (state === 'rec' ? fromTick : 0) })), ...[...open].map(([n, o]) => ({ n, v: o.v, t: o.t - fromTick, d: Math.max(15, (pos ?? o.t) - o.t) }))];
  g.fillStyle = '#0d0f11'; g.fillRect(0, 0, W, H);
  const k = W / len;
  for (let b = 0; b <= len / M.PPQ; b++) { g.fillStyle = b % 4 ? '#1c2127' : '#38414b'; g.fillRect(Math.round(b * M.PPQ * k), 0, 1, H); }
  g.fillStyle = '#6f7a85'; g.font = '600 11px "Chakra Petch", sans-serif';
  for (let b = 0; b < len / M.BAR; b++) g.fillText(String((state === 'review' ? fromTick : fromTick) / M.BAR + b + 1), b * M.BAR * k + 4, 13);
  let lo = 127, hi = 0; ns.forEach((x) => { lo = Math.min(lo, x.n); hi = Math.max(hi, x.n); });
  if (target.drum) { lo = 0; hi = KIT_ROWS.length - 1; } else if (!ns.length) { lo = 48; hi = 72; } else { lo -= 2; hi += 2; }
  const rows = hi - lo + 1, rh = Math.max(4, Math.min(18, (H - 22) / rows));
  const yOf = (n) => { const r = target.drum ? Math.max(0, KIT_ROWS.indexOf(n)) : hi - n; return 18 + r * rh; };
  const partial = state === 'review' && picked.size && picked.size < take.length;
  for (const x of ns) {
    const on = !partial || picked.has(x);
    g.globalAlpha = (0.4 + 0.6 * (x.v / 127)) * (on ? 1 : 0.25); g.fillStyle = col;
    g.fillRect(x.t * k, yOf(x.n), Math.max(2, x.d * k), Math.max(2, rh - 1));
    if (partial && on) { g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(x.t * k + 0.5, yOf(x.n) + 0.5, Math.max(2, x.d * k) - 1, Math.max(2, rh - 1) - 1); }
  }
  g.globalAlpha = 1;
  layout = { k, yOf, rh };
  if (box) { const xa = Math.min(box.x0, box.x1), ya = Math.min(box.y0, box.y1); g.fillStyle = 'rgba(143,240,207,.12)'; g.strokeStyle = 'rgba(143,240,207,.85)'; g.fillRect(xa, ya, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0)); g.strokeRect(xa + 0.5, ya + 0.5, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0)); }
  if (pos != null && pos >= fromTick) { g.fillStyle = '#ff5a4a'; g.fillRect((pos - fromTick) * k, 0, 2, H); }
  if (!ns.length && state !== 'rec') { g.fillStyle = '#56616c'; g.font = '500 14px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(state === 'review' ? 'Nothing came in during that take.' : W < 520 ? 'Press Record, then play.' : 'Press Record, then play your MIDI keyboard, pads or the keys below.', W / 2, H / 2); g.textAlign = 'start'; }
}
