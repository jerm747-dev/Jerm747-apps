// Arrange mode UI. ModeSwitch flips the room between Sections (the rhythm composer and song
// strip) and Arrange (loops end to end). ArrangePanel is the track: add loop files or Sample bin
// sounds, drag blocks to reorder, set repeats, play from any block, and export MP3 through
// 747 Drive and Punch.
import { useEffect, useRef, useState } from 'react';
import * as arrange from '../engine/arrange.js';
import * as pads from '../engine/pads.js';
import * as project from '../engine/project.js';
import { toMp3, toWav, saveFile, saveSong } from '../engine/export.js';
import { blip } from '../engine/audio.js';
import { Led, useExternal, useLibrary } from '../ui/parts.jsx';

const C = 'var(--c-tape, #e98a3a)';
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function ModeSwitch() {
  const v = useExternal(arrange.subscribe, arrange.get);
  const pick = (m) => { if (m === v.mode) return; blip(m === 'arrange' ? 900 : 640); if (m === 'arrange' && pads.isPlaying()) pads.play(false); arrange.setMode(m); };
  return (
    <div className="mode-switch seg" role="radiogroup" aria-label="Room mode">
      <button type="button" role="radio" aria-checked={v.mode === 'sections'} className={`switch ${v.mode === 'sections' ? 'on' : ''}`} onClick={() => pick('sections')} title="Sections A–D with the rhythm composer">Sections</button>
      <button type="button" role="radio" aria-checked={v.mode === 'arrange'} className={`switch ${v.mode === 'arrange' ? 'on' : ''}`} onClick={() => pick('arrange')} title="Loops end to end on one track">Arrange</button>
    </div>
  );
}

export function ArrangePanel() {
  const v = useExternal(arrange.subscribe, arrange.get);
  const clips = useLibrary();
  const cur = useExternal(project.subscribe, project.getCurrent);
  const [sel, setSel] = useState(-1);
  const [pick, setPick] = useState('');
  const [msg, setMsg] = useState('');
  const [job, setJob] = useState(null);
  const [dragging, setDragging] = useState(null); // { from, to }
  const fileIn = useRef(null), track = useRef(null), head = useRef(null), dragRef = useRef(null);
  const blocks = v.blocks, total = v.total;

  useEffect(() => { if (sel >= blocks.length) setSel(blocks.length - 1); }, [blocks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // playhead
  useEffect(() => {
    if (!v.playing) { if (head.current) head.current.style.opacity = 0; return; }
    let raf = 0;
    const tick = () => {
      const el = head.current, t = arrange.position(), from = blocks[sequenceStart.current]?.start || 0;
      if (el && total) { el.style.opacity = 1; el.style.left = `${Math.min(100, ((from + t) / total) * 100)}%`; }
      raf = requestAnimationFrame(tick);
    };
    tick(); return () => cancelAnimationFrame(raf);
  }, [v.playing, total]); // eslint-disable-line react-hooks/exhaustive-deps
  const sequenceStart = useRef(0);
  const playFrom = (i) => { sequenceStart.current = i; blip(880); arrange.start(i); };

  async function addFiles(e) {
    const files = [...(e.target.files || e.dataTransfer?.files || [])]; if (e.target.value !== undefined) e.target.value = '';
    if (!files.length) return;
    setMsg('Loading…');
    try { const n = await arrange.addFiles(files); blip(n ? 980 : 300); setMsg(n ? `Added ${n} loop${n === 1 ? '' : 's'} to the end. They’re in the Sample bin too.` : 'Those files could not be read as audio.'); }
    catch (err) { setMsg(err.message); }
  }
  async function exportMp3() {
    if (!blocks.length) return;
    arrange.stop();
    const name = cur.name && cur.name !== 'Untitled' ? cur.name : 'Arrangement';
    try {
      setJob({ stage: 'Rendering', p: 0 });
      const buf = await arrange.render((p) => setJob({ stage: 'Rendering', p }));
      setJob({ stage: 'Encoding MP3', p: 0 });
      // MP3 needs its encoder; if it can't load (offline), fall back to WAV rather than fail
      let blob, format = 'mp3', note = '';
      try { blob = await toMp3(buf, 192, (p) => setJob({ stage: 'Encoding MP3', p })); }
      catch { blob = toWav(buf); format = 'wav'; note = ' The MP3 encoder couldn’t load here, so it was saved as WAV.'; }
      setJob({ stage: 'Saving', p: 1 });
      await saveSong({ name, format, blob, duration: buf.duration }).catch(() => {});
      const where = await saveFile(name, format, blob);
      blip(1100); setMsg(`Exported ${name}.${format} (${mmss(buf.duration)}) with 747 Drive${typeof where === 'string' && where !== 'saved' ? ` to ${where}` : ''}. It’s on your Bounced songs list too.${note}`);
    } catch (err) { setMsg(err?.message || 'Export failed.'); }
    finally { setJob(null); }
  }

  // drag to reorder
  function blockDown(e, i) {
    if (e.button !== undefined && e.button !== 0) return;
    setSel(i);
    const startX = e.clientX, el = track.current;
    let moved = false;
    const kids = () => [...el.querySelectorAll('.ar-block')].map((b) => { const r = b.getBoundingClientRect(); return r.left + r.width / 2; });
    const mid = kids();
    const onMove = (ev) => {
      if (!moved && Math.abs(ev.clientX - startX) < 8) return;
      moved = true;
      let to = mid.filter((x) => x < ev.clientX).length; if (to > i) to -= 1;
      dragRef.current = { from: i, to }; setDragging(dragRef.current);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      // side effects stay outside state updaters (React may run those twice)
      const d = dragRef.current; dragRef.current = null; setDragging(null);
      if (d && d.to !== d.from) { arrange.move(d.from, d.to); setSel(d.to); blip(620); }
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  }
  const order = blocks.map((_, i) => i);
  if (dragging) { const [b] = order.splice(dragging.from, 1); order.splice(dragging.to, 0, b); }
  const s = blocks[sel];

  return (
    <section className="section arrange-section" aria-labelledby="arrange-h">
      <header className="sec-head"><h2 id="arrange-h"><span className="sec-dot" style={{ background: C }} />Arrange</h2>
        <p>Loops end to end on one track. {blocks.length ? `${blocks.length} block${blocks.length === 1 ? '' : 's'} · ${mmss(total)}` : 'Add your loops to start.'}</p></header>
      <div className="ar-tools">
        <button type="button" className="btn primary" disabled={!blocks.length} aria-pressed={v.playing} onClick={() => (v.playing ? (blip(440), arrange.stop()) : playFrom(0))}>{v.playing ? 'Stop' : 'Play'}</button>
        <button type="button" className="btn" onClick={() => fileIn.current?.click()}>Add loop files</button>
        <input ref={fileIn} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" multiple hidden onChange={addFiles} />
        <span className="ar-bin">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Sound from the Sample bin">
            <option value="">From the Sample bin…</option>
            {clips.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.duration.toFixed(1)}s</option>)}
          </select>
          <button type="button" className="switch" disabled={!pick} onClick={() => { arrange.addClip(pick, sel >= 0 ? sel + 1 : blocks.length); blip(900); setPick(''); }}>{sel >= 0 ? 'Add after' : 'Add'}</button>
        </span>
        <button type="button" className="btn export-mp3" disabled={!blocks.length || !!job} onClick={exportMp3}>Export MP3</button>
        <button type="button" className="switch" disabled={!blocks.length} onClick={() => { blip(330); arrange.clear(); setSel(-1); }}>Clear</button>
      </div>
      <div ref={track} className={`ar-track ${blocks.length ? '' : 'empty'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e); }}>
        {!blocks.length && <p className="hint">Drop loop files here, or use Add loop files. They line up end to end in the order you add them.</p>}
        {order.map((i) => {
          const b = blocks[i], w = total ? (b.dur * b.reps) / total : 0;
          return (
            <button key={b.uid} type="button" className={`ar-block ${sel === i ? 'sel' : ''} ${v.playing && v.at === i ? 'now' : ''} ${b.missing ? 'missing' : ''} ${dragging?.from === i ? 'lifted' : ''}`}
              style={{ flexGrow: Math.max(0.0001, w), flexBasis: 0 }} onPointerDown={(e) => blockDown(e, i)} onDoubleClick={() => playFrom(i)} aria-pressed={sel === i}
              aria-label={`${b.name}, ${b.reps} time${b.reps === 1 ? '' : 's'}, ${mmss(b.dur * b.reps)}`}>
              <span className="ar-reps" aria-hidden="true">{Array.from({ length: Math.min(b.reps, 16) }, (_, k) => <i key={k} />)}</span>
              <b>{b.name}</b><em>{b.reps > 1 ? `×${b.reps} · ` : ''}{mmss(b.dur * b.reps)}</em>
            </button>
          );
        })}
        <span ref={head} className="ar-head" style={{ opacity: 0 }} aria-hidden="true" />
      </div>
      <div className="lane-foot ar-foot">
        <p className="hint">{job ? `${job.stage}… ${Math.round(job.p * 100)}%` : msg || (s ? `${s.name}: ${s.dur.toFixed(2)}s a pass, plays ${s.reps} time${s.reps === 1 ? '' : 's'}, starts at ${mmss(s.start)}. Drag blocks to reorder.` : 'Tap a block to select it; drag to reorder; double-tap to play from it.')}</p>
        {s && <span className="note-tools" role="group" aria-label="Selected block">
          <button type="button" className="switch" onClick={() => playFrom(sel)}>Play from here</button>
          <button type="button" className="switch" disabled={sel <= 0} onClick={() => { arrange.move(sel, sel - 1); setSel(sel - 1); }} aria-label="Move earlier">◀</button>
          <button type="button" className="switch" disabled={sel >= blocks.length - 1} onClick={() => { arrange.move(sel, sel + 1); setSel(sel + 1); }} aria-label="Move later">▶</button>
          <button type="button" className="switch" disabled={s.reps <= 1} onClick={() => arrange.setReps(sel, s.reps - 1)} aria-label="Fewer repeats">−</button>
          <span className="ar-count"><Led on color={C} />×{s.reps}</span>
          <button type="button" className="switch" disabled={s.reps >= 32} onClick={() => arrange.setReps(sel, s.reps + 1)} aria-label="More repeats">+</button>
          <button type="button" className="switch" onClick={() => { arrange.duplicate(sel); setSel(sel + 1); }}>Duplicate</button>
          <button type="button" className="btn" onClick={() => { arrange.remove(sel); blip(300); }}>Remove</button>
        </span>}
      </div>
    </section>
  );
}
