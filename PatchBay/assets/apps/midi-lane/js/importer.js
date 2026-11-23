// Import a .mid: choose a new project or add into this one, then map each part of the file
// (one per track + channel) to a destination: a new track on any channel, or an existing track.
// Parts sent to the same "new track · ch N" are merged into one track, so a file can be folded
// down onto a few channels, or spread out one track per channel.
import * as M from './model.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let el, hooks, file = null, into = 'new', dest = [], take = [], at = 0, useTempo = true;

export function initImporter(h) {
  hooks = h;
  el = document.createElement('div'); el.className = 'sheet'; el.id = 'importSheet'; el.hidden = true;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-close]')) { el.hidden = true; return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.into) { into = b.dataset.into; useTempo = into === 'new'; defaults(); render(); }
    else if (b.dataset.all) { const v = b.dataset.all === 'one' ? dest.find((d, i) => take[i]) || 'new:0' : null; dest = file.parts.map((p, i) => v || defFor(p, i)); render(); }
    else if (b.dataset.tempo != null) { useTempo = !useTempo; render(); }
    else if (b.dataset.go != null) go();
  });
  el.addEventListener('change', (e) => {
    const i = e.target.dataset.i;
    if (e.target.dataset.take != null) take[+e.target.dataset.take] = e.target.checked;
    else if (i != null) dest[+i] = e.target.value;
    else if (e.target.dataset.at != null) at = +e.target.value;
    render();
  });
}

/** m: result of readMidi; name: file name */
export function openImport(m, name) {
  file = { ...m, file: name }; into = 'new'; useTempo = true; at = 0;
  take = m.parts.map(() => true); defaults();
  el.hidden = false; render();
}
const defFor = (p, i) => {
  if (into === 'add') { const same = M.P.tracks.find((t) => t.ch === p.ch); if (same) return `trk:${same.id}`; }
  return `new:${p.ch}`;
};
function defaults() { dest = file.parts.map((p, i) => defFor(p, i)); }

function newCount() { return new Set(dest.filter((d, i) => take[i] && d.startsWith('new:'))).size; }
function render() {
  const room = M.MAX_TRACKS - (into === 'add' ? M.P.tracks.length : 0), need = newCount();
  const opts = (sel) => Array.from({ length: 16 }, (_, c) => `<option value="new:${c}" ${sel === `new:${c}` ? 'selected' : ''}>New track · ch ${c + 1}${c === 9 ? ' (drums)' : ''}</option>`).join('')
    + (into === 'add' ? M.P.tracks.map((t) => `<option value="trk:${t.id}" ${sel === `trk:${t.id}` ? 'selected' : ''}>Into ${esc(t.name)} (ch ${t.ch + 1})</option>`).join('') : '');
  const n = file.parts.reduce((s, p, i) => s + (take[i] ? p.notes.length : 0), 0);
  el.innerHTML = `<div class="sheet-card imp" role="dialog" aria-label="Import MIDI">
    <div class="sheet-head"><h2>Import ${esc(file.file)}</h2><button class="ib" data-close aria-label="Close">×</button></div>
    <div class="row">
      <div class="seg"><button data-into="new" class="${into === 'new' ? 'on' : ''}">New project</button><button data-into="add" class="${into === 'add' ? 'on' : ''}">Add to this project</button></div>
      ${into === 'add' ? `<select data-at aria-label="Place at">${Array.from({ length: 64 }, (_, b) => `<option value="${b * M.BAR}" ${b * M.BAR === at ? 'selected' : ''}>at bar ${b + 1}</option>`).join('')}</select>` : ''}
      ${file.bpm ? `<button class="tg ${useTempo ? 'on' : ''}" data-tempo><i></i>Use file tempo (${file.bpm} BPM)</button>` : ''}
    </div>
    <div class="row"><span class="note">Map parts:</span><button class="sm" data-all="keep">One track per channel</button><button class="sm" data-all="one">All into one track</button></div>
    <ol class="imp-list">${file.parts.map((p, i) => `<li class="${take[i] ? '' : 'off'}">
        <label class="imp-take"><input type="checkbox" data-take="${i}" ${take[i] ? 'checked' : ''}><span><b>${esc(p.name || `Part ${i + 1}`)}</b><small>ch ${p.ch + 1}${p.ch === 9 ? ' · drums' : ''} · ${p.notes.length} notes</small></span></label>
        <select data-i="${i}" ${take[i] ? '' : 'disabled'} aria-label="Destination for ${esc(p.name || `part ${i + 1}`)}">${opts(dest[i])}</select></li>`).join('')}</ol>
    <p class="note">${n} notes → ${need} new track${need === 1 ? '' : 's'}${into === 'add' ? ` (room for ${room})` : ''}. Parts sent to the same channel merge into one track. Channel 10 gets Drumway.${need > room ? ` <b class="warn">Too many new tracks: the extras fold into the last one.</b>` : ''}</p>
    <div class="row" style="justify-content:flex-end"><button class="tb" data-close>Cancel</button><button class="tb accent" data-go ${n ? '' : 'disabled'}>Import</button></div>
  </div>`;
}

function go() {
  const base = into === 'new' ? { name: (file.name || file.file.replace(/\.(mid|midi)$/i, '')).slice(0, 60), bpm: file.bpm || 120, bars: 1, tracks: [] }
    : JSON.parse(JSON.stringify(M.P));
  if (into === 'add' && useTempo && file.bpm) base.bpm = file.bpm;
  const offset = into === 'add' ? at : 0;
  const made = new Map(); let last = null, end = 0;
  file.parts.forEach((p, i) => {
    if (!take[i]) return;
    const d = dest[i]; let t;
    if (d.startsWith('trk:')) t = base.tracks.find((x) => x.id === d.slice(4));
    else if (made.has(d)) t = made.get(d);
    else if (base.tracks.length < M.MAX_TRACKS) {
      const ch = +d.slice(4);
      const merged = file.parts.filter((q, j) => take[j] && dest[j] === d).length > 1;
      t = M.makeTrack({ drum: ch === 9, ch, name: merged ? (ch === 9 ? 'Drums' : `Ch ${ch + 1} mix`) : p.name || (ch === 9 ? 'Drums' : `Ch ${ch + 1}`) });
      base.tracks.push(t); made.set(d, t);
    } else t = last;
    if (!t) return;
    last = t;
    for (const x of p.notes) { t.notes.push({ ...x, t: x.t + offset }); end = Math.max(end, x.t + offset + x.d); }
  });
  if (!base.tracks.length) base.tracks.push(M.makeTrack({ drum: true }), M.makeTrack());
  base.bars = Math.max(into === 'add' ? M.P.bars : 1, Math.min(64, Math.ceil(end / M.BAR)));
  el.hidden = true;
  hooks.done(base, `${file.file}: ${file.parts.filter((_, i) => take[i]).length} part${take.filter(Boolean).length === 1 ? '' : 's'} ${into === 'new' ? 'as a new project' : `added at bar ${at / M.BAR + 1}`}. Undo goes back.`, made.size ? [...made.values()][0].id : null);
}
