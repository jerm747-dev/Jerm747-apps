// The synth note lane: record what you play into the section you're editing, then it plays with
// the song. Edit mode turns it into a small piano-roll editor:
//  - Draw tool: tap empty space to add a note, drag empty space to scroll.
//  - Select tool: drag empty space to box-select, tap empty space to clear the selection.
//  - Either tool: tap a note to select it (Shift/Ctrl adds), drag it to move the selection in
//    time and pitch, drag its right edge to change length. Snaps to the grid while Quantize is on.
//  - Two fingers: pinch sideways to zoom time, up-and-down to zoom pitch, diagonally for both;
//    move both fingers to scroll.
//  - Cut / Copy / Paste: Paste shows the notes as a ghost you drag into place, then Place.
//    Notes past the end of the section are left out; the clipboard survives switching sections.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as synth from '../engine/synth.js';
import * as lane from '../engine/notes.js';
import * as pads from '../engine/pads.js';
import ClickCtl from '../ui/ClickCtl.jsx';
import { saveFile } from '../engine/export.js';
import { onStep, onRun, getBpm } from '../engine/clock.js';
import { blip } from '../engine/audio.js';
import { Led, useExternal, useFullscreen, FullBtn } from '../ui/parts.jsx';

const C = 'var(--c-synth)';
const ZOOM_KEY = 'beatroom.lane.zoom';
const RULER = 46; // px, note-name column in Edit mode
const BLACK = [1, 3, 6, 8, 10];
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const fmt = (x) => x.toFixed(2).replace(/\.?0+$/, '');

export default function NoteLane() {
  const v = useExternal(lane.subscribe, lane.get);
  const clip = useExternal(lane.subscribeClip, lane.getClip);
  const playing = useExternal(onRun, pads.isPlaying);
  const [fsRef, full, toggleFull] = useFullscreen();
  const [sel, setSel] = useState([]);
  const [laneMsg, setLaneMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState('draw');
  const [placing, setPlacing] = useState(null);   // paste ghost: { p, dn }
  const [box, setBox] = useState(null);           // select marquee in steps/notes
  const [zoom, setZoomState] = useState(() => store.get(ZOOM_KEY, { x: 1, y: 1 }));
  const head = useRef(null), midiFile = useRef(null), rollRef = useRef(null), scrollRef = useRef(null);
  const drag = useRef(null), range = useRef(null), zoomAnchor = useRef(null), editRange = useRef(null), gesture = useRef({ pts: new Map() });

  const notes = v.notes, len = v.len, g = lane.gridSteps();
  const pick = sel.length === 1 ? sel[0] : -1;

  // ----- MIDI files -----
  async function importMidi(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const r = lane.importMidi(await f.arrayBuffer());
      blip(1000); setSel([]);
      setLaneMsg(`${r.name || f.name}: ${r.count} note${r.count === 1 ? '' : 's'}, ${r.bars} bar${r.bars === 1 ? '' : 's'}, section set to ${r.len} steps${r.dropped ? ` (${r.dropped} past step 64 left out)` : ''}${r.fileBpm && Math.round(r.fileBpm) !== getBpm() ? `. The file was at ${Math.round(r.fileBpm)} BPM` : ''}. Undo puts the old notes back.`);
    } catch (err) { setLaneMsg(err.message || 'That MIDI file could not be read.'); }
  }
  async function exportMidi() {
    const blob = lane.exportMidi(); if (!blob) return;
    blip(1100);
    try { await saveFile(`Beat Room ${pads.SECTIONS[v.edit]} notes`, 'mid', blob); setLaneMsg(`Saved Beat Room ${pads.SECTIONS[v.edit]} notes.mid.`); }
    catch (err) { setLaneMsg(/preview page|can’t save files/.test(err.message) ? 'This preview page can’t save .mid files. Your own Beat Room build and the app save them.' : err.message); }
  }

  // a new section or a different note count (recording, undo, delete) drops stale selections
  useEffect(() => { if (!drag.current) setSel((s) => s.filter((k) => k < v.notes.length)); }, [v.notes.length]);
  useEffect(() => { setSel([]); setPlacing((p) => (p ? { p: 0, dn: p.dn } : null)); editRange.current = null; }, [v.edit]);
  useEffect(() => { if (!editing) { setPlacing(null); setBox(null); if (full) toggleFull(); } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onStep((i, abs) => {
    const el = head.current; if (!el) return;
    const m = i >= 0 && pads.isPlaying() ? pads.posAt(abs) : null;
    if (!m || m.sec !== pads.getEdit()) { el.style.opacity = 0; return; }
    el.style.opacity = 1; el.setAttribute('x', ((m.pos / m.len) * 1000).toFixed(1));
  }), []);

  // ----- pitch range -----
  let lo = notes.length ? Math.min(...notes.map((n) => n.n)) - 2 : 58, hi = notes.length ? Math.max(...notes.map((n) => n.n)) + 2 : 74;
  if (hi - lo < 12) { const mid = Math.round((hi + lo) / 2); lo = mid - 6; hi = mid + 6; }
  const plan = placing ? lane.pastePlan(placing.p, placing.dn) : null;
  if (editing) {
    // at least three octaves; the range only grows, so rows hold still while you work
    const all = [...notes, ...(plan ? plan.fit : [])];
    const nlo = all.length ? Math.min(...all.map((n) => n.n)) : 60, nhi = all.length ? Math.max(...all.map((n) => n.n)) : 72;
    const r = editRange.current || (() => { const mid = Math.round((nlo + nhi) / 2); return { lo: Math.min(nlo - 6, mid - 18), hi: Math.max(nhi + 6, mid + 18) }; })();
    r.lo = Math.max(0, Math.min(r.lo, nlo - 3)); r.hi = Math.min(127, Math.max(r.hi, nhi + 3));
    editRange.current = r; ({ lo, hi } = r);
  }
  if (drag.current && range.current) ({ lo, hi } = range.current);
  const rows = hi - lo + 1, rowPx = Math.round(11 * zoom.y);
  const H = editing ? rows * 10 : 120, rowH = H / rows;
  const y = (n) => H - (n - lo + 1) * rowH;

  // ----- zoom -----
  function setZoom(z, anchor) {
    const next = { x: Math.max(1, Math.min(8, z.x)), y: Math.max(0.6, Math.min(3, z.y)) };
    const el = scrollRef.current;
    if (el) {
      const a = anchor || { cx: el.clientWidth / 2, cy: el.clientHeight / 2 };
      zoomAnchor.current = { fx: (el.scrollLeft + a.cx) / el.scrollWidth, fy: (el.scrollTop + a.cy) / el.scrollHeight, ...a };
    }
    setZoomState(next); store.set(ZOOM_KEY, next);
  }
  useLayoutEffect(() => {
    const el = scrollRef.current, A = zoomAnchor.current; if (!el || !A) return;
    zoomAnchor.current = null;
    el.scrollLeft = A.fx * el.scrollWidth - A.cx; el.scrollTop = A.fy * el.scrollHeight - A.cy;
  }, [zoom]);
  // opening the editor (or the full view) centres the notes
  useLayoutEffect(() => {
    const el = scrollRef.current, r = editRange.current; if (!editing || !el || !r) return;
    const ns = lane.get().notes;
    const mid = ns.length ? (Math.min(...ns.map((n) => n.n)) + Math.max(...ns.map((n) => n.n))) / 2 : 66;
    el.scrollTop = ((r.hi - mid) / (r.hi - r.lo + 1)) * el.scrollHeight - el.clientHeight / 2;
  }, [editing, full]);

  // ----- pointer → step / note -----
  const at = (e) => {
    const r = rollRef.current.getBoundingClientRect();
    return { step: ((e.clientX - r.left) / r.width) * len, note: lo - 1 + Math.ceil(((r.bottom - e.clientY) / r.height) * rows), px: r.width / len };
  };

  // ----- notes: select, move (whole selection), resize -----
  function notePointerDown(e, k) {
    e.stopPropagation();
    if (placing) return gDown(e);
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    let group = sel.includes(k) ? sel : [k];
    if (multi) { group = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]; setSel(group); return; }
    setSel(group); lane.audition(notes[k]);
    if (!editing) return;
    e.preventDefault();
    const n = notes[k], p0 = at(e);
    const edgePx = Math.min(12, (n.d * p0.px) / 3);
    const mode = p0.step * p0.px > (n.p + n.d) * p0.px - edgePx ? 'len' : 'move';
    range.current = { lo, hi };
    drag.current = { k, mode, start: p0, group, orig: group.map((i) => ({ ...notes[i] })), moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  function noteDragMove(e) {
    const d = drag.current; if (!d) return false;
    const p = at(e), ds = p.step - d.start.step, dn = p.note - d.start.note;
    if (!d.moved) { if (Math.abs(ds * p.px) < 3 && dn === 0) return true; d.moved = true; lane.beginEdit(); }
    if (d.mode === 'move') {
      // snap the grabbed note, carry the rest by the same amount so chords keep their shape
      const lead = d.orig[d.group.indexOf(d.k)], shift = lane.snapStep(lead.p + ds) - lead.p;
      lane.setMany(d.group.map((i, j) => [i, { p: d.orig[j].p + shift, n: d.orig[j].n + dn }]));
    } else {
      const lead = d.orig[d.group.indexOf(d.k)], dd = Math.max(0.25, lane.snapStep(lead.p + lead.d + ds) - lead.p) - lead.d;
      lane.setMany(d.group.map((i, j) => [i, { d: Math.max(0.25, d.orig[j].d + dd) }]));
    }
    return true;
  }
  function noteDragEnd() {
    const d = drag.current; drag.current = null; range.current = null;
    if (d?.moved) { blip(620); lane.audition(lane.get().notes[d.k]); }
  }

  function addAt(pt) {
    const p = at(pt);
    if (p.note < lo || p.note > hi || p.step < 0 || p.step >= len) return;
    const step = Math.max(0, Math.min(len - g, Math.floor(p.step / g) * g));
    const k = lane.add({ p: step, d: g, n: p.note, v: 0.8 });
    blip(880); setSel([k]); lane.audition({ n: p.note, v: 0.8 });
  }
  // dragging the paste ghost moves it from where it is by however far you drag
  function placeGhostAt(pt) {
    lane.audition({ n: (clip.notes[0]?.n || 60) + placing.dn, v: 0.8 });
    return { p: placing.p, dn: placing.dn, s: at(pt) };
  }

  // ----- empty-space and paste gestures -----
  function gDown(e) {
    const G = gesture.current, el = scrollRef.current;
    G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (G.pts.size === 2) {
      const [a, b] = [...G.pts.values()];
      G.pinch = { dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y), z: { ...zoom }, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, l: el.scrollLeft, t: el.scrollTop };
      G.tap = null; G.pan = null; G.ghost = null; setBox(null);
      if (drag.current) noteDragEnd();
      return;
    }
    if (G.pts.size !== 1 || drag.current) return;
    const pt = { clientX: e.clientX, clientY: e.clientY };
    G.tap = { x: e.clientX, y: e.clientY, pt };
    if (placing) { G.ghost = placeGhostAt(pt); return; }
    if (tool === 'select') { const p = at(pt); G.box = { s: p.step, n: p.note }; return; }
    G.pan = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
  }
  function gMove(e) {
    if (noteDragMove(e)) return;
    const G = gesture.current, el = scrollRef.current; if (!G.pts.has(e.pointerId)) return;
    G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (G.pinch && G.pts.size >= 2) {
      const [a, b] = [...G.pts.values()], r = el.getBoundingClientRect();
      const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const zx = G.pinch.dx > 40 ? G.pinch.z.x * dx / G.pinch.dx : zoom.x, zy = G.pinch.dy > 40 ? G.pinch.z.y * dy / G.pinch.dy : zoom.y;
      if (Math.abs(zx - zoom.x) > 0.01 || Math.abs(zy - zoom.y) > 0.01) setZoom({ x: zx, y: zy }, { cx: mx - r.left, cy: my - r.top });
      else { el.scrollLeft = G.pinch.l - (mx - G.pinch.mx); el.scrollTop = G.pinch.t - (my - G.pinch.my); }
      return;
    }
    const moved = G.tap && Math.hypot(e.clientX - G.tap.x, e.clientY - G.tap.y) > 6;
    if (moved) G.tap = null;
    const pt = { clientX: e.clientX, clientY: e.clientY };
    if (G.ghost) {
      const p = at(pt);
      const np = Math.max(0, Math.min(len - g, lane.snapStep(G.ghost.p + (p.step - G.ghost.s.step), true)));
      const ndn = G.ghost.dn + (p.note - G.ghost.s.note);
      if (np !== placing.p || ndn !== placing.dn) { setPlacing({ p: np, dn: ndn }); if (ndn !== placing.dn) lane.audition({ n: (clip.notes[0]?.n || 60) + ndn, v: 0.8 }); }
      return;
    }
    if (G.box && !G.tap) { const p = at(pt); setBox({ s0: G.box.s, n0: G.box.n, s1: p.step, n1: p.note }); return; }
    if (G.pan && !G.tap) { el.scrollLeft = G.pan.l - (e.clientX - G.pan.x); el.scrollTop = G.pan.t - (e.clientY - G.pan.y); }
  }
  function gUp(e) {
    if (drag.current) { noteDragEnd(); }
    const G = gesture.current;
    G.pts.delete(e.pointerId);
    const tap = G.tap && !G.pinch && e.type === 'pointerup';
    if (placing && tap) {
      // a tap drops the paste's first note where you tapped
      const p = at(G.tap.pt), first = clip.notes[0];
      setPlacing({ p: Math.max(0, Math.min(len - g, Math.floor(p.step / g) * g)), dn: first ? p.note - first.n : placing.dn });
    } else if (tool === 'select' && G.box) {
      if (tap) setSel([]);
      else {
        // measure from the release point, not the last drawn box (it can lag a frame behind)
        const end = at({ clientX: e.clientX, clientY: e.clientY });
        const s0 = Math.min(G.box.s, end.step), s1 = Math.max(G.box.s, end.step), n0 = Math.min(G.box.n, end.note), n1 = Math.max(G.box.n, end.note);
        const hit = notes.map((n, k) => (n.p < s1 && n.p + n.d > s0 && n.n >= n0 && n.n <= n1 ? k : -1)).filter((k) => k >= 0);
        setSel(e.shiftKey ? [...new Set([...sel, ...hit])] : hit);
        if (hit.length) blip(760);
      }
    } else if (tap && !placing && tool === 'draw') addAt(G.tap.pt);
    G.tap = null; G.pan = null; G.box = null; G.ghost = null; setBox(null);
    if (G.pts.size < 2) G.pinch = null;
  }

  // ----- clipboard -----
  function doCopy() { const n = lane.copy(sel); if (n) { blip(900); setLaneMsg(`Copied ${n} note${n === 1 ? '' : 's'} from section ${pads.SECTIONS[v.edit]}.`); } }
  function doCut() { const n = lane.cut(sel); if (n) { blip(500); setSel([]); setLaneMsg(`Cut ${n} note${n === 1 ? '' : 's'}. Paste puts them back where you choose.`); } }
  function startPaste() {
    if (!clip) return;
    // start the ghost at the playhead's step if it's in view, else at the first selected note, else the top
    const startAt = sel.length ? Math.min(...sel.map((k) => notes[k]?.p ?? 0)) : 0;
    setSel([]); setTool('draw');
    setPlacing({ p: Math.max(0, Math.min(len - g, lane.snapStep(startAt, true))), dn: 0 });
    blip(820);
  }
  function placePaste() {
    const r = lane.paste(placing.p, placing.dn);
    blip(r.idxs.length ? 980 : 300); setSel(r.idxs); setPlacing(null);
    setLaneMsg(r.idxs.length ? `Pasted ${r.idxs.length} note${r.idxs.length === 1 ? '' : 's'} at step ${fmt(placing.p + 1)}${r.dropped ? `. ${r.dropped} didn’t fit in the ${len}-step section` : ''}.` : `Nothing fits there: the section ends at step ${len}.`);
  }
  function del() { if (!sel.length) return; blip(300); lane.removeMany(sel); setSel([]); }
  function key(e) {
    if (!editing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); doCopy(); return; }
    if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); doCut(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); startPaste(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(notes.map((_, k) => k)); return; }
    if (placing) {
      if (e.key === 'Enter') { e.preventDefault(); placePaste(); } else if (e.key === 'Escape') { e.preventDefault(); setPlacing(null); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setPlacing({ ...placing, p: Math.max(0, Math.min(len - g, placing.p + (e.key === 'ArrowLeft' ? -g : g))) }); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setPlacing({ ...placing, dn: placing.dn + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1) }); }
      return;
    }
    if (!sel.length) return;
    const map = { ArrowLeft: { dp: -g }, ArrowRight: { dp: g }, ArrowUp: { dn: e.shiftKey ? 12 : 1 }, ArrowDown: { dn: e.shiftKey ? -12 : -1 } };
    if (map[e.key]) { e.preventDefault(); lane.nudgeMany(sel, map[e.key]); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
    else if (e.key === 'Escape') setSel([]);
  }

  // ----- render -----
  const recLbl = v.rec === 'armed' ? 'Ready' : v.rec === 'rec' ? 'Rec ●' : 'Rec';
  const selSet = new Set(sel);
  const hint = laneMsg && v.rec === 'off' && !sel.length && !placing ? laneMsg
    : v.rec === 'armed' ? (playing ? 'Get ready: the take starts at the top of the section.' : 'Counting in…')
    : v.rec === 'rec' ? 'Recording this pass. Play the keys or your MIDI keyboard.'
    : placing ? `Drag to place ${clip.notes.length} note${clip.notes.length === 1 ? '' : 's'} (from ${clip.from}) at step ${fmt(placing.p + 1)}${placing.dn ? `, ${placing.dn > 0 ? '+' : ''}${placing.dn} semitone${Math.abs(placing.dn) === 1 ? '' : 's'}` : ''}.${plan.dropped ? ` ${plan.dropped} won’t fit in this ${len}-step section.` : ''}`
    : sel.length > 1 ? `${sel.length} notes selected. Drag one to move them all.`
    : pick >= 0 && notes[pick] ? `${synth.noteName(notes[pick].n)} at step ${fmt(notes[pick].p + 1)}${editing ? ` · ${fmt(notes[pick].d)} step${notes[pick].d === 1 ? '' : 's'} long` : ''}`
    : editing ? (tool === 'select' ? 'Drag across notes to select them. Tap a note to pick it; Shift adds more.' : `Tap to add a note, drag a note to move it, drag its right edge for length. Pinch to zoom. ${v.quant ? `Snaps to ${v.grid}.` : 'Quantize is off: moves are free.'}`)
    : notes.length ? 'Plays with the song. REC again to add another take on top.' : 'Press Rec, wait for the count-in, then play. One pass of the section records.';

  const roll = (
    <svg ref={rollRef} className={`roll ${editing ? 'editing' : ''} ${placing ? 'placing' : ''}`} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" role="img" tabIndex={editing ? 0 : undefined}
      style={editing ? { height: rows * rowPx } : undefined}
      aria-label={`Piano roll, ${notes.length} notes over ${len} steps${editing ? '. Editing: drag notes to move, drag the right edge to change length, tap to add, arrow keys nudge, pinch to zoom.' : ''}`}
      onPointerMove={editing ? undefined : noteDragMove} onPointerUp={editing ? undefined : noteDragEnd} onKeyDown={key}>
      {Array.from({ length: len }, (_, i) => <rect key={i} x={(i / len) * 1000} y="0" width={1000 / len} height={H} className={`roll-col ${Math.floor(i / 4) % 2 ? 'b' : 'a'}`} />)}
      {editing && Array.from({ length: rows }, (_, r) => { const n = lo + r; return BLACK.includes(n % 12) ? <rect key={'r' + n} className="roll-row" x="0" y={y(n)} width="1000" height={rowH} /> : null; })}
      {editing && Array.from({ length: Math.round(len / g) }, (_, k) => { const x = k * g; if (!k || Math.abs(x % 16) < 1e-6) return null; const beat = Math.abs(x % 4) < 1e-6;
        return <rect key={'tk' + k} className={`roll-tick ${beat ? 'beat' : 'sub'}`} x={(x / len) * 1000 - 0.5} y="0" width="1" height={H} />; })}
      {editing && Array.from({ length: Math.floor(len / 16) }, (_, b) => b > 0 && <rect key={'bar' + b} className="roll-bar" x={(b * 16 / len) * 1000 - 0.75} y="0" width="1.5" height={H} />)}
      {notes.map((n, k) => (
        <g key={k}>
          <rect className={`roll-note ${selSet.has(k) ? 'pick' : ''}`} x={(n.p / len) * 1000} y={y(n.n)} width={Math.max(4, (n.d / len) * 1000)} height={Math.max(3, rowH - 1)} rx="2"
            style={{ opacity: 0.45 + n.v * 0.55 }} onPointerDown={(e) => notePointerDown(e, k)} />
          {editing && <rect className="roll-grip" x={((n.p + n.d) / len) * 1000 - 3} y={y(n.n) + rowH * 0.2} width="2" height={Math.max(2, rowH * 0.6 - 1)} />}
        </g>
      ))}
      {plan && plan.fit.map((n, k) => <rect key={'gh' + k} className="roll-ghost" x={(n.p / len) * 1000} y={y(n.n)} width={Math.max(4, (n.d / len) * 1000)} height={Math.max(3, rowH - 1)} rx="2" />)}
      {plan && <rect className="roll-ghost-line" x={(placing.p / len) * 1000 - 1} y="0" width="2" height={H} />}
      {box && (() => { const s0 = Math.min(box.s0, box.s1), s1 = Math.max(box.s0, box.s1), n0 = Math.min(box.n0, box.n1), n1 = Math.max(box.n0, box.n1);
        return <rect className="roll-box" x={(s0 / len) * 1000} y={y(n1)} width={((s1 - s0) / len) * 1000} height={(n1 - n0 + 1) * rowH} />; })()}
      <rect ref={head} className="roll-head" x="0" y="0" width="3" height={H} style={{ opacity: 0 }} />
    </svg>
  );
  const picked = new Set(sel.map((k) => notes[k]?.n));
  const every = rowPx >= 10;
  const editor = (
    <div ref={scrollRef} className="roll-scroll" onPointerDown={gDown} onPointerMove={gMove} onPointerUp={gUp} onPointerCancel={gUp}>
      <div className="roll-canvas" style={{ width: `calc(${RULER}px + (100% - ${RULER}px) * ${zoom.x})` }}>
        <div className="roll-ruler" aria-hidden="true" style={{ gridAutoRows: `${rowPx}px` }}>
          {Array.from({ length: rows }, (_, r) => {
            const n = hi - r;
            return <span key={n} className={`${BLACK.includes(n % 12) ? 'blk' : ''} ${n % 12 === 0 ? 'oct' : ''} ${picked.has(n) ? 'pick' : ''}`}>{every || n % 12 === 0 || picked.has(n) ? synth.noteName(n) : ''}</span>;
          })}
        </div>
        {roll}
      </div>
    </div>
  );

  return (
    <div ref={fsRef} className={`panel lane ${v.rec} ${full ? 'lane-full' : ''}`}>
      <div className="lane-head">
        <span className="engrave">Note lane · Section {pads.SECTIONS[v.edit]} · {notes.length} note{notes.length === 1 ? '' : 's'}</span>
        <div className="lane-btns">
          <button type="button" className={`btn rec-btn ${v.rec}`} aria-pressed={v.rec !== 'off'} onClick={() => { blip(v.rec === 'off' ? 990 : 330); lane.toggleRec(); }}
            title="Record one pass of the section from the keys or MIDI"><Led on={v.rec === 'rec'} color="#ff4b3a" />{recLbl}</button>
          <ClickCtl compact />
          <button type="button" className={`switch ${v.on ? 'on' : ''}`} aria-pressed={v.on} onClick={() => { blip(700); lane.setOn(!v.on); }}><Led on={v.on} color={C} />{v.on ? 'Lane on' : 'Lane off'}</button>
          <button type="button" className={`switch ${v.quant ? 'on' : ''}`} aria-pressed={v.quant} onClick={() => { blip(640); lane.setQuant(!v.quant); }} title="Snap starts to the grid while recording and editing"><Led on={v.quant} color={C} />Quantize</button>
          <select className="grid-pick" value={v.grid} onChange={(e) => { blip(660); lane.setGrid(e.target.value); }} aria-label="Quantize grid" title="Grid for Quantize, Snap and editing">
            {Object.keys(lane.GRIDS).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <button type="button" className="switch" onClick={() => { blip(800); lane.snap(); }} disabled={!notes.length} title={`Snap every note in this section to ${v.grid} now`}>Snap {v.grid}</button>
          <button type="button" className={`switch ${editing ? 'on' : ''}`} aria-pressed={editing} onClick={() => { blip(editing ? 520 : 900); setEditing(!editing); }}
            title="Move notes, change their length, copy and paste, or tap the roll to add one"><Led on={editing} color={C} />Edit notes</button>
          <button type="button" className="switch" onClick={() => { blip(520); lane.undo(); setSel([]); }} disabled={!v.canUndo}>Undo</button>
          <button type="button" className="switch" onClick={() => { blip(330); lane.clear(); setSel([]); }} disabled={!notes.length}>Clear</button>
          <button type="button" className="switch" onClick={() => midiFile.current?.click()} title="Load a .mid phrase into this section">Import MIDI</button>
          <input ref={midiFile} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={importMidi} />
          <button type="button" className="switch" onClick={exportMidi} disabled={!notes.length} title="Save this section's notes as a .mid file">Export MIDI</button>
          {editing && <FullBtn full={full} onClick={toggleFull} label="Note editor" />}
        </div>
      </div>
      {editing && (
        <div className="edit-bar" role="toolbar" aria-label="Note editor">
          <span className="seg" role="group" aria-label="Section">
            {pads.SECTIONS.map((s, i) => (
              <button key={s} type="button" className={`switch ${v.edit === i ? 'on' : ''}`} aria-pressed={v.edit === i} title={`Edit section ${s}`} onClick={() => { blip(700); pads.setEdit(i); }}>{s}</button>
            ))}
          </span>
          <label className="len-pick"><span className="engrave">Length</span>
            <select value={len} onChange={(e) => { blip(660); pads.setLength(Number(e.target.value)); }} aria-label="Section length in steps" title="Section length (16 steps = 1 bar)">
              {pads.LENGTHS.map((n) => <option key={n} value={n}>{n} steps · {n / 16} bar{n > 16 ? 's' : ''}</option>)}
            </select>
          </label>
          <span className="seg" role="group" aria-label="Tool">
            <button type="button" className={`switch ${tool === 'draw' ? 'on' : ''}`} aria-pressed={tool === 'draw'} onClick={() => setTool('draw')} title="Tap to add notes; drag empty space to scroll">Draw</button>
            <button type="button" className={`switch ${tool === 'select' ? 'on' : ''}`} aria-pressed={tool === 'select'} onClick={() => setTool('select')} title="Drag across notes to select them">Select</button>
          </span>
          <span className="seg" role="group" aria-label="Clipboard">
            <button type="button" className="switch" onClick={() => setSel(notes.map((_, k) => k))} disabled={!notes.length}>All</button>
            <button type="button" className="switch" onClick={doCut} disabled={!sel.length}>Cut</button>
            <button type="button" className="switch" onClick={doCopy} disabled={!sel.length}>Copy</button>
            <button type="button" className={`switch ${placing ? 'on' : ''}`} onClick={() => (placing ? setPlacing(null) : startPaste())} disabled={!clip} title={clip ? `Paste ${clip.notes.length} note${clip.notes.length === 1 ? '' : 's'} from section ${clip.from}` : 'Copy notes first'}>Paste{clip ? ` (${clip.notes.length})` : ''}</button>
          </span>
          <span className="zoom-tools" role="group" aria-label="Zoom">
            <span className="engrave">Time</span>
            <button type="button" className="switch" aria-label="Zoom out time" onClick={() => setZoom({ ...zoom, x: zoom.x / 1.4 })} disabled={zoom.x <= 1}>−</button>
            <button type="button" className="switch" aria-label="Zoom in time" onClick={() => setZoom({ ...zoom, x: zoom.x * 1.4 })} disabled={zoom.x >= 8}>+</button>
            <span className="engrave">Pitch</span>
            <button type="button" className="switch" aria-label="Zoom out pitch" onClick={() => setZoom({ ...zoom, y: zoom.y / 1.25 })} disabled={zoom.y <= 0.6}>−</button>
            <button type="button" className="switch" aria-label="Zoom in pitch" onClick={() => setZoom({ ...zoom, y: zoom.y * 1.25 })} disabled={zoom.y >= 3}>+</button>
            <button type="button" className="switch" onClick={() => setZoom({ x: 1, y: 1 })}>Fit</button>
          </span>
        </div>
      )}
      {editing ? editor : roll}
      <div className="lane-foot">
        <p className="hint">{hint}</p>
        {placing && <>
          <button type="button" className="btn" onClick={() => { blip(330); setPlacing(null); }}>Cancel</button>
          <button type="button" className="btn primary place-btn" onClick={placePaste} disabled={!plan.fit.length}>Place {plan.fit.length} here</button>
        </>}
        {!placing && sel.length > 0 && editing && (
          <span className="note-tools" role="group" aria-label="Selected notes">
            <button type="button" className="switch" title={`Earlier by ${v.grid}`} onClick={() => lane.nudgeMany(sel, { dp: -g })}>◀</button>
            <button type="button" className="switch" title={`Later by ${v.grid}`} onClick={() => lane.nudgeMany(sel, { dp: g })}>▶</button>
            <button type="button" className="switch" title="Up a semitone" onClick={() => { lane.nudgeMany(sel, { dn: 1 }); if (pick >= 0) lane.audition({ ...notes[pick], n: notes[pick].n + 1 }); }}>▲</button>
            <button type="button" className="switch" title="Down a semitone" onClick={() => { lane.nudgeMany(sel, { dn: -1 }); if (pick >= 0) lane.audition({ ...notes[pick], n: notes[pick].n - 1 }); }}>▼</button>
            <button type="button" className="switch" title={`Shorter by ${v.grid}`} onClick={() => lane.nudgeMany(sel, { dd: -g })}>Shorter</button>
            <button type="button" className="switch" title={`Longer by ${v.grid}`} onClick={() => lane.nudgeMany(sel, { dd: g })}>Longer</button>
          </span>
        )}
        {!placing && sel.length > 0 && <button type="button" className="btn" onClick={del}>Delete{sel.length > 1 ? ` ${sel.length}` : ' note'}</button>}
      </div>
    </div>
  );
}
