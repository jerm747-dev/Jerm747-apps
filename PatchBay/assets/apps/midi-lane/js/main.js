// MIDI Lane: wiring. Transport, tabs, edit tools, track list, rack, file and MIDI sheets.
import * as M from './model.js';
import * as player from './player.js';
import { Lane, V, sel, noteName } from './lanes.js';
import { renderRack, bindRack } from './rack.js';
import { readMidi, writeMidi } from './smf.js';
import { saveFile, encodeMp3 } from './files.js';
import { initRecorder, openRecorder } from './recorder.js';
import { initImporter, openImport } from './importer.js';
import { initLive, openLive } from './live.js';

const $ = (s) => document.querySelector(s);
const ui = { tab: load('tab', 'keys'), trackId: null, tool: 'draw', snap: +load('snap', 2), vel: 100 };
function load(k, d) { try { return localStorage.getItem('midilane.ui.' + k) ?? d; } catch { return d; } }
function keep(k, v) { try { localStorage.setItem('midilane.ui.' + k, v); } catch { /* off */ } }
const track = () => M.P.tracks.find((t) => t.id === ui.trackId) || M.P.tracks[Math.min(1, M.P.tracks.length - 1)] || M.P.tracks[0];
const say = (s) => { $('#status').textContent = s; };

// ---------- lanes ----------
const hooks = {
  track, snap: () => M.SNAPS[ui.snap].t, tool: () => ui.tool, vel: () => ui.vel,
  start: () => player.startTick, setStart: (t) => { player.setStart(t); redraw(); },
  preview: (n, v) => player.preview(track(), n, v),
  edited: (final) => { if (final) M.changed('notes'); },
  selChanged: () => selUI(), redraw: () => redraw(),
  velLane: () => focus, toggleFocus: () => setFocus(!focus),
  manual: () => { if (ui.auto) { ui.auto = false; autoUI(); } },
};
// ---------- Auto view ----------
// On: the view fits the track's notes. Pinch / scroll / zoom switches it off and keeps your view.
// Tapping Auto off again (after it was turned on by hand) goes back to the view you had.
let manualView = null;
function autoUI() { const b = $('#autoBtn'); b.classList.toggle('on', ui.auto); b.setAttribute('aria-pressed', ui.auto); }
function refit() { if (!ui.auto) return; requestAnimationFrame(() => { lane().fit(); redraw(); }); }
function setAuto(on) {
  if (on) { manualView = { ...V }; ui.auto = true; refit(); }
  else { ui.auto = false; if (manualView) { Object.assign(V, manualView); manualView = null; } redraw(); }
  autoUI();
}
ui.auto = true;
// ---------- full-screen lane ----------
let focus = false, focusPpx = null, fsByUs = false;
function setFocus(on) {
  if (on === focus) return;
  const L0 = lane(), vis0 = (L0.cv.clientWidth - L0.gut) / V.ppx;
  focus = on; document.body.classList.toggle('focus', on);
  const ft = $('#focusTools'), ed = $('#edit'), parts = [$('#toolSeg'), $('#snap'), document.querySelector('.qpair')];
  (on ? ft : ed).append(...parts);
  if (on) focusPpx = V.ppx;
  requestAnimationFrame(() => {
    const L = lane(), W1 = L.cv.clientWidth - L.gut;
    // landscape full screen shows about twice the bars; portrait keeps the same span
    if (ui.auto) L.fit();
    else if (on) V.ppx = Math.max(0.02, Math.min(1.6, W1 / ((innerWidth > innerHeight ? 2 : 1) * vis0)));
    else if (focusPpx) V.ppx = focusPpx;
    editUI(); redraw();
  });
  if (on && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => { fsByUs = true; }).catch(() => {});
  if (!on && fsByUs && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (!on) fsByUs = false;
  say(on ? 'Full-screen lane. Slide the bars under the notes to set velocity. Tap the corner to come back.' : '');
}
const lanes = { rhythm: new Lane($('#cvR'), 'rhythm', hooks), keys: new Lane($('#cvK'), 'keys', hooks) };
const lane = () => lanes[ui.tab];
function redraw() { lane().draw(player.isPlaying() ? player.position() : null); }

// ---------- tabs + tools ----------
function setTab(tab) {
  ui.tab = tab; keep('tab', tab);
  $('#tabR').setAttribute('aria-selected', tab === 'rhythm'); $('#tabK').setAttribute('aria-selected', tab === 'keys');
  $('#cvR').hidden = tab !== 'rhythm'; $('#cvK').hidden = tab !== 'keys';
  editUI(); requestAnimationFrame(redraw); refit();
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#toolSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) { ui.tool = b.dataset.tool; editUI(); redraw(); } });
$('#snap').innerHTML = M.SNAPS.map((s, i) => `<option value="${i}">Snap ${s.id === 'Off' ? 'off' : s.id}</option>`).join('');
$('#snap').value = ui.snap;
$('#snap').addEventListener('change', (e) => { ui.snap = +e.target.value; keep('snap', ui.snap); redraw(); });
$('#vel').addEventListener('input', (e) => {
  ui.vel = +e.target.value; $('#velVal').textContent = ui.vel;
  const s = selected(); if (s.length) { if (!velUndo) { M.pushUndo(); velUndo = true; } s.forEach((n) => (n.v = ui.vel)); redraw(); }
});
let velUndo = false;
$('#vel').addEventListener('change', () => { velUndo = false; M.changed('notes'); });
function editUI() {
  const keys = ui.tab === 'keys', t = track();
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === ui.tool));
  ['#dup', '#octDn', '#octUp'].forEach((s) => ($(s).style.display = keys ? '' : 'none'));
  $('#rowAdd').style.display = !keys && !t.drum ? '' : 'none';
  if (!keys && !t.drum) {
    const have = new Set(M.rowsFor(t)), opts = ['<option value="">+ Add row</option>'];
    for (let n = 96; n >= 24; n--) if (!have.has(n)) opts.push(`<option value="${n}">${noteName(n)}</option>`);
    $('#rowAdd').innerHTML = opts.join('');
  }
  selUI();
}
$('#rowAdd').addEventListener('change', (e) => { const n = +e.target.value; if (!e.target.value) return; M.pushUndo(); track().rows.push(n); M.changed('notes'); editUI(); redraw(); });

// ---------- edit ops ----------
const selected = () => track().notes.filter((n) => sel.has(n));
const scope = () => { const s = selected(); return s.length ? s : track().notes; };
function selUI() {
  const s = selected();
  $('#del').disabled = $('#dup').disabled = $('#octUp').disabled = $('#octDn').disabled = !s.length;
  $('#clear').disabled = $('#shL').disabled = $('#shR').disabled = !track().notes.length;
  if (s.length) { const v = Math.round(s.reduce((a, n) => a + n.v, 0) / s.length); $('#vel').value = v; $('#velVal').textContent = v; }
  else { $('#vel').value = ui.vel; $('#velVal').textContent = ui.vel; }
  const t = track();
  say(s.length ? `${s.length} note${s.length > 1 ? 's' : ''} selected · ${ui.tab === 'rhythm' ? 'shift a beat with ◀ Beat / Beat ▶, or Delete' : 'drag to move, drag the right edge to resize'}` :
    ui.tab === 'rhythm' ? (ui.tool === 'select' ? `${t.name}: drag a box over steps to highlight them, then shift them a beat or delete.` : `${t.name}: tap a step to toggle, drag to paint. Slide along the bottom strip to scroll.`) :
    `${t.name}: ${ui.tool === 'draw' ? 'tap to add a note, drag to draw its length' : 'drag a box to select'}. Two fingers pinch and pan; drag the ruler or the keys to scroll.`);
}
function quant(half) {
  const s = scope(); if (!s.length) return; M.pushUndo();
  (half ? M.halfQuantize : M.quantize)(s, M.SNAPS[ui.snap].t);
  M.changed('notes'); redraw();
  say(`${half ? 'Half quantized' : 'Quantized'} ${s.length} note${s.length > 1 ? 's' : ''} to ${M.SNAPS[ui.snap].id}${half ? '. Press again to creep closer.' : '.'}`);
}
$('#quant').addEventListener('click', () => quant(false));
$('#half').addEventListener('click', () => quant(true));
function del() { const s = selected(); if (!s.length) return; M.pushUndo(); const t = track(); t.notes = t.notes.filter((n) => !sel.has(n)); sel.clear(); M.changed('notes'); redraw(); selUI(); }
function dup() {
  const s = selected(); if (!s.length) return; M.pushUndo();
  const a = Math.min(...s.map((n) => n.t)), b = Math.max(...s.map((n) => n.t + n.d));
  // a phrase of half a bar or more repeats on the next bar line; shorter bits on the next beat
  const span = b - a, shift = span >= M.BAR / 2 ? Math.ceil(span / M.BAR) * M.BAR : Math.max(M.PPQ, Math.ceil(span / M.PPQ) * M.PPQ);
  sel.clear(); const t = track();
  s.forEach((n) => { const c = { ...n, t: n.t + shift }; t.notes.push(c); sel.add(c); });
  M.changed('notes'); redraw(); selUI();
}
function octave(d) { const s = selected(); if (!s.length) return; M.pushUndo(); s.forEach((n) => (n.n = Math.max(0, Math.min(127, n.n + d)))); M.changed('notes'); redraw(); player.preview(track(), s[0].n, s[0].v); }
function shift(dir) {
  const t = track(), s = scope(); if (!s.length) return;
  M.pushUndo();
  s.forEach((n) => (n.t += dir * M.PPQ));
  const gone = s.filter((n) => n.t < 0);
  if (gone.length) { t.notes = t.notes.filter((n) => n.t >= 0); gone.forEach((n) => sel.delete(n)); }
  const past = s.filter((n) => n.t >= M.lenTicks()).length;
  M.changed('notes'); redraw(); selUI();
  say(`Shifted ${s.length - gone.length} note${s.length - gone.length === 1 ? '' : 's'} a beat ${dir > 0 ? 'right' : 'left'}` +
    (gone.length ? `. ${gone.length} fell off the start (undo brings them back).` : past ? `. ${past} past the last bar, kept: shift back or add bars to see them.` : '.'));
}
function clearTrack() { const t = track(); if (!t.notes.length) return; M.pushUndo(); const n = t.notes.length; t.notes = []; sel.clear(); M.changed('notes'); redraw(); selUI(); say(`Cleared ${n} note${n === 1 ? '' : 's'} from ${t.name}. Undo brings them back.`); }
$('#shL').addEventListener('click', () => shift(-1)); $('#shR').addEventListener('click', () => shift(1));
$('#clear').addEventListener('click', clearTrack);
$('#del').addEventListener('click', del); $('#dup').addEventListener('click', dup);
$('#octUp').addEventListener('click', () => octave(12)); $('#octDn').addEventListener('click', () => octave(-12));
$('#selAll').addEventListener('click', () => { track().notes.forEach((n) => sel.add(n)); redraw(); selUI(); });
$('#zIn').addEventListener('click', () => lane().zoom(1.35)); $('#zOut').addEventListener('click', () => lane().zoom(1 / 1.35));

// ---------- transport ----------
function setPlay(on) {
  if (on) player.play(); else player.stop();
  $('#play').classList.toggle('on', on); $('#play').setAttribute('aria-label', on ? 'Stop' : 'Play');
  $('#playIcon').setAttribute('d', on ? 'M6 5h12v14H6z' : 'M7 4.5v15l12-7.5z');
  if (!on) redraw();
}
$('#play').addEventListener('click', () => setPlay(!player.isPlaying()));
$('#toStart').addEventListener('click', () => { player.setStart(0); V.x0 = 0; redraw(); posUI(0); });
$('#bpm').addEventListener('change', (e) => { const old = M.P.bpm, v = Math.max(30, Math.min(300, +e.target.value || old)); M.pushUndo(); M.P.bpm = v; e.target.value = v; player.tempoChanged(old); M.changed('song'); });
$('#bars').addEventListener('change', (e) => { const v = Math.max(1, Math.min(64, Math.round(+e.target.value || M.P.bars))); M.pushUndo(); M.P.bars = v; e.target.value = v; if (player.startTick >= M.lenTicks()) player.setStart(0); M.changed('song'); redraw(); });
function posUI(p) { const beat = Math.floor(p / M.PPQ); $('#pos').textContent = `${Math.floor(beat / 4) + 1}.${(beat % 4) + 1}`; }
(function loop() {
  if (player.isPlaying()) { const p = player.position(); lane().follow(p); lane().draw(p); posUI(p); }
  requestAnimationFrame(loop);
})();
$('#undo').addEventListener('click', () => M.undo()); $('#redo').addEventListener('click', () => M.redo());

// ---------- tracks ----------
function renderTracks() {
  const cur = track(); ui.trackId = cur.id;
  $('#trkCount').textContent = `${M.P.tracks.length}/${M.MAX_TRACKS}`;
  $('#addKeys').disabled = $('#addDrums').disabled = M.P.tracks.length >= M.MAX_TRACKS;
  $('#tracks').innerHTML = M.P.tracks.map((t) => {
    const on = t.id === cur.id;
    return `<li class="trk ${on ? 'cur' : ''}" data-id="${t.id}" style="--c:${M.color(t)}">
      <div class="trk-l1"><span class="trk-dot"></span><input class="trk-name" value="${t.name.replace(/"/g, '&quot;')}" aria-label="Track name" ${on ? '' : 'readonly tabindex="-1"'}>
        <span class="trk-ch">${t.drum ? 'DR · ' : ''}CH ${t.ch + 1}</span>
        <button class="ms m ${t.mute ? 'on' : ''}" data-mute aria-pressed="${t.mute}" aria-label="Mute">M</button>
        <button class="ms s ${t.solo ? 'on' : ''}" data-solo aria-pressed="${t.solo}" aria-label="Solo">S</button></div>
      ${on ? `<div class="trk-l2">
        <select data-ch aria-label="MIDI channel">${Array.from({ length: 16 }, (_, i) => `<option value="${i}" ${i === t.ch ? 'selected' : ''}>Ch ${i + 1}${i === 9 ? ' (drums)' : ''}</option>`).join('')}</select>
        <button class="tg ${t.drum ? 'on' : ''}" data-drum aria-pressed="${t.drum}"><i></i>Drum</button>
        <select data-inst aria-label="Sound"><option value="avionyx" ${t.inst === 'avionyx' ? 'selected' : ''}>Avionyx</option><option value="drumway" ${t.inst === 'drumway' ? 'selected' : ''}>Drumway</option><option value="none" ${t.inst === 'none' ? 'selected' : ''}>MIDI only</option></select>
        <button class="tg ${t.midiOut ? 'on' : ''}" data-out aria-pressed="${t.midiOut}"><i></i>Out</button>
        ${M.P.tracks.length > 1 ? '<button class="x" data-rm aria-label="Delete track">×</button>' : ''}</div>` : ''}</li>`;
  }).join('');
}
$('#tracks').addEventListener('click', (e) => {
  const li = e.target.closest('.trk'); if (!li) return;
  const t = M.P.tracks.find((x) => x.id === li.dataset.id);
  if (e.target.closest('[data-mute]')) { t.mute = !t.mute; player.refreshAll(); M.changed('tracks'); return; }
  if (e.target.closest('[data-solo]')) { t.solo = !t.solo; player.refreshAll(); M.changed('tracks'); return; }
  if (e.target.closest('[data-drum]')) { M.setDrum(t, !t.drum); say(t.drum ? `${t.name} is a drum track on channel 10 with Drumway.` : `${t.name} is a keys track on channel ${t.ch + 1} with Avionyx.`); return; }
  if (e.target.closest('[data-out]')) { t.midiOut = !t.midiOut; M.changed('tracks'); return; }
  if (e.target.closest('[data-rm]')) { const name = t.name; M.removeTrack(t.id); say(`Deleted ${name}. Undo brings it back.`); return; }
  if (t.id !== ui.trackId) { ui.trackId = t.id; sel.clear(); renderAll(); refit(); }
});
$('#tracks').addEventListener('change', (e) => {
  const t = track();
  if (e.target.matches('[data-ch]')) { M.pushUndo(); t.ch = +e.target.value; M.changed('tracks'); }
  if (e.target.matches('[data-inst]')) { M.pushUndo(); t.inst = e.target.value; if (t.inst === 'drumway' && !t.patch.voices) t.patch = M.makeTrack({ drum: true }).patch; if (t.inst === 'avionyx' && !t.patch.osc) t.patch = M.makeTrack().patch; player.refresh(t); M.changed('tracks'); }
  if (e.target.matches('.trk-name')) { M.pushUndo(); t.name = e.target.value.trim().slice(0, 40) || t.name; M.changed('tracks'); }
});
$('#tracks').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.trk-name')) e.target.blur(); });
$('#addKeys').addEventListener('click', () => { const t = M.addTrack(false); if (t) { ui.trackId = t.id; sel.clear(); renderAll(); refit(); } });
$('#addDrums').addEventListener('click', () => { const t = M.addTrack(true); if (t) { ui.trackId = t.id; sel.clear(); setTab('rhythm'); renderAll(); } });

// ---------- rack ----------
const rackEl = $('#rack');
bindRack(rackEl, { track, refresh: (t) => player.refresh(t), preview: (t, n, v) => player.preview(t, n, v, 0.5), rerender: () => renderRack(rackEl, track()) });

// ---------- file sheet ----------
const openSheet = (id) => { $(id).hidden = false; };
document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) s.hidden = true; }));
$('#fileBtn').addEventListener('click', () => { $('#projName').value = M.P.name; $('#fileMsg').textContent = ''; openSheet('#fileSheet'); });
$('#projName').addEventListener('change', (e) => { M.P.name = e.target.value.trim().slice(0, 60) || 'Untitled'; M.changed('song'); });
const fname = (ext) => `${(M.P.name || 'MIDI Lane').replace(/[\\/:*?"<>|]+/g, '').trim() || 'MIDI Lane'}.${ext}`;
const fileMsg = (s) => { $('#fileMsg').textContent = s; say(s); };
async function guard(fn) { try { fileMsg(await fn()); } catch (e) { fileMsg(e.message || String(e)); } }
$('#newBtn').addEventListener('click', () => { if (player.isPlaying()) setPlay(false); M.replaceProject(M.newProject(true)); ui.trackId = null; V.x0 = 0; renderAll(); refit(); fileMsg('New project. Undo brings the last one back.'); });
$('#demoBtn').addEventListener('click', () => { if (player.isPlaying()) setPlay(false); M.replaceProject(M.newProject(false)); ui.trackId = null; V.x0 = 0; renderAll(); refit(); fileMsg('Demo loaded. Undo brings your project back.'); });
$('#saveBtn').addEventListener('click', () => guard(() => saveFile(fname('mlane'), new TextEncoder().encode(M.projectJson()))));
$('#midBtn').addEventListener('click', () => guard(() => saveFile(fname('mid'), writeMidi(M.P, M.lenTicks()))));
$('#mp3Btn').addEventListener('click', () => guard(async () => {
  if (!M.P.tracks.some((t) => t.notes.length && t.inst !== 'none')) throw new Error('Nothing to bounce yet: no notes on a built-in sound.');
  fileMsg('Bouncing…');
  const buf = await player.render((f) => fileMsg(`Bouncing… ${Math.round(f * 100)}%`));
  const mp3 = await encodeMp3(buf, (f) => fileMsg(`Encoding MP3… ${Math.round(f * 100)}%`));
  return saveFile(fname('mp3'), mp3);
}));
$('#openInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) openFile(f); });
async function openFile(f) {
  try {
    if (player.isPlaying()) setPlay(false);
    const buf = await f.arrayBuffer(), head = new Uint8Array(buf.slice(0, 4));
    if (String.fromCharCode(...head) === 'MThd') {
      const m = readMidi(buf); if (!m.parts.length) throw new Error('No notes in that file.');
      $('#fileSheet').hidden = true; openImport(m, f.name); return;
    }
    M.replaceProject(JSON.parse(new TextDecoder().decode(buf)));
    ui.trackId = null; sel.clear(); V.x0 = 0; player.setStart(0); renderAll(); lanes.keys.centerOn(64); refit();
    $('#fileSheet').hidden = true;
    say(`Opened ${f.name}: ${M.P.tracks.length} track${M.P.tracks.length > 1 ? 's' : ''}, ${M.P.bars} bars at ${M.P.bpm} BPM. Undo goes back.`);
  } catch (e) { fileMsg(`Couldn’t open ${f.name}: ${e.message}`); }
}
// ---------- import + record ----------
initImporter({ done: (p, msg, selId) => {
  M.replaceProject(p); ui.trackId = selId; sel.clear(); V.x0 = 0; player.setStart(0);
  renderAll(); lanes.keys.centerOn(64); refit(); say(msg);
} });
initRecorder({
  track, say, stopPlay: () => setPlay(false),
  selectTrack: (id) => { ui.trackId = id; sel.clear(); renderAll(); },
  trackRow: (id) => document.querySelector(`.trk[data-id="${id}"]`),
  afterSend: (t, notes, at) => {
    ui.trackId = t.id; sel.clear(); notes.forEach((n) => sel.add(n));
    V.x0 = Math.max(0, at - M.PPQ); player.setStart(at);
    setTab(t.drum ? 'rhythm' : 'keys'); renderAll();
    if (!t.drum && notes.length) lanes.keys.centerOn(Math.round(notes.reduce((a, n) => a + n.n, 0) / notes.length));
    redraw(); selUI();
    const row = document.querySelector(`.trk[data-id="${t.id}"]`); row?.classList.add('landed'); setTimeout(() => row?.classList.remove('landed'), 1600);
    say(`Sent ${notes.length} note${notes.length === 1 ? '' : 's'} to ${t.name} at bar ${Math.floor(at / M.BAR) + 1}. They're highlighted. Pick the next track and press Rec to layer another part.`);
  },
});
$('#recBtn').addEventListener('click', openRecorder);
$('#focusExit').addEventListener('click', () => setFocus(false));
$('#autoBtn').addEventListener('click', () => setAuto(!ui.auto));
let rsz = 0; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(refit, 120); });
initLive();
const goLive = () => { if (player.isPlaying()) setPlay(false); $('#midiSheet').hidden = true; openLive(); };
$('#liveBtn').addEventListener('click', goLive); $('#liveOpen').addEventListener('click', goLive);

// ---------- MIDI sheet ----------
$('#midiBtn').addEventListener('click', () => { midiUI(); openSheet('#midiSheet'); });
$('#connect').addEventListener('click', () => player.connectMidi());
$('#outSel').addEventListener('change', (e) => player.chooseOut(e.target.value));
$('#sBuiltIn').addEventListener('click', () => { player.setSetting('builtIn', !player.settings.builtIn); if (!player.settings.builtIn) player.panic(); midiUI(); });
$('#sMidiOut').addEventListener('click', () => { player.setSetting('midiOut', !player.settings.midiOut); midiUI(); });
$('#panic').addEventListener('click', () => { player.panic(); say('All notes off sent.'); });
function midiUI() {
  const m = player.midi;
  $('#midiLed').className = 'led' + (m.state === 'on' && m.outputs.length ? ' on' : m.state === 'error' ? ' err' : '');
  $('#outSel').innerHTML = m.outputs.length ? m.outputs.map((o) => `<option value="${o.id}" ${o.id === player.settings.outId ? 'selected' : ''}>${o.name}</option>`).join('') : '<option>No output</option>';
  $('#outSel').disabled = !m.outputs.length;
  $('#connect').textContent = m.state === 'on' ? 'Rescan' : 'Connect USB MIDI';
  if (m.msg) $('#midiMsg').textContent = m.msg; else if (m.state === 'on') $('#midiMsg').textContent = `Sending to ${m.outputs.find((o) => o.id === player.settings.outId)?.name || 'MIDI out'}.`;
  $('#sBuiltIn').classList.toggle('on', player.settings.builtIn); $('#sMidiOut').classList.toggle('on', player.settings.midiOut);
}
player.onMidi(midiUI);

// ---------- full screen ----------
$('#fsBtn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); try { await screen.orientation.lock('landscape'); } catch { /* phone may refuse */ } }
  } catch { say('Full screen isn’t allowed here. Add MIDI Lane to your home screen, or open it from your site.'); }
});

// ---------- keys ----------
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || !document.getElementById('recScreen')?.hidden || !document.getElementById('liveScreen')?.hidden) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') { e.preventDefault(); setPlay(!player.isPlaying()); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? M.redo() : M.undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); M.redo(); }
  else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); track().notes.forEach((n) => sel.add(n)); redraw(); selUI(); }
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dup(); }
  else if (e.key.toLowerCase() === 'q' && !mod) quant(e.shiftKey);
  else if (e.key.toLowerCase() === 'r' && !mod) openRecorder();
  else if (e.key.toLowerCase() === 'l' && !mod) goLive();
  else if (e.key === '[') shift(-1);
  else if (e.key === ']') shift(1);
  else if (e.key.toLowerCase() === 'f' && !mod) setFocus(!focus);
  else if (e.key === 'Escape') { if (focus && !sel.size) setFocus(false); sel.clear(); redraw(); selUI(); }
});

// ---------- render ----------
function renderAll() {
  renderTracks(); renderRack(rackEl, track()); editUI();
  $('#bpm').value = M.P.bpm; $('#bars').value = M.P.bars;
  $('#undo').disabled = !M.canUndo(); $('#redo').disabled = !M.canRedo();
  document.title = `${M.P.name} · MIDI Lane ${M.VERSION}`;
  redraw();
}
M.onChange((what) => {
  if (what === 'all') { sel.clear(); if (player.isPlaying()) player.refreshAll(); renderAll(); return; }
  $('#undo').disabled = !M.canUndo(); $('#redo').disabled = !M.canRedo();
  if (what === 'tracks') { renderTracks(); renderRack(rackEl, track()); editUI(); player.refreshAll(); redraw(); }
  if (what === 'song') { $('#bpm').value = M.P.bpm; $('#bars').value = M.P.bars; document.title = `${M.P.name} · MIDI Lane`; redraw(); }
  if (what === 'notes' && ui.tab === 'rhythm') editUI();
});
$('#ver').textContent = M.VERSION; $('#verAbout').textContent = M.VERSION;
setTab(ui.tab);
renderAll();
lanes.keys.centerOn(64);
autoUI(); refit();
midiUI();
say('Pick a track, then draw notes or tap steps. File opens .mid and .mlane.');
