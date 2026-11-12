// Sample bin: every sample in the room in one place, the same library the tape deck, turntable
// and pads already share. Takes, room recordings, prints, loaded files and bounces all land here.
// Preview, rename, put on the turntable, send to a pad channel, or delete. Saved in this browser.
// Open it from the top bar or the turntable (openBin() works from anywhere).
import { useEffect, useRef, useState } from 'react';
import * as library from '../engine/library.js';
import * as pads from '../engine/pads.js';
import { putOnPlatter } from '../engine/platter.js';
import { audio, out, blip } from '../engine/audio.js';
import { useLibrary, useExternal } from '../ui/parts.jsx';

let isOpen = false;
const subs = new Set();
const setOpen = (v) => { isOpen = v; subs.forEach((fn) => fn(v)); };
export const openBin = () => setOpen(true);
const onOpen = (fn) => (subs.add(fn), () => subs.delete(fn));

const KINDS = { all: 'All', tape: 'Takes', room: 'Room', print: 'Prints', file: 'Files', bounce: 'Bounces' };
const KIND_NAME = { tape: 'Take', room: 'Room', print: 'Print', file: 'File', bounce: 'Bounce' };
const fmtDur = (s) => (s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

/** Top-bar button with the sample count. */
export function BinBtn() {
  const clips = useLibrary();
  return (
    <button type="button" className="tool-btn bin-btn" onClick={() => { blip(760); openBin(); }} aria-haspopup="dialog">
      <span className="tool-name">Sample bin</span><b className="tool-read">{clips.length}<small>sample{clips.length === 1 ? '' : 's'}</small></b>
    </button>
  );
}

/** Mounted once; shows the bin when someone opens it. */
export default function SampleBinHost() {
  const open = useExternal(onOpen, () => isOpen);
  return open ? <Bin onClose={() => setOpen(false)} /> : null;
}

function Bin({ onClose }) {
  const clips = useLibrary();
  const rows = useExternal(pads.subscribe, pads.getRows);
  const [kind, setKind] = useState('all');
  const [playing, setPlaying] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState('');
  const src = useRef(null), card = useRef(null), file = useRef(null);

  useEffect(() => { library.loadAll(); card.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && !editing) onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [editing, onClose]);
  useEffect(() => () => stopPreview(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPreview() { if (src.current) { try { src.current.onended = null; src.current.stop(); } catch { /* ended */ } src.current = null; } setPlaying(null); }
  function preview(c) {
    if (playing === c.id) { stopPreview(); return; }
    stopPreview();
    const ac = audio(); if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = c.buffer; s.connect(out());
    s.onended = () => { if (src.current === s) { src.current = null; setPlaying(null); } };
    s.start(); src.current = s; setPlaying(c.id);
  }
  async function importFiles(e) {
    const files = [...(e.target.files || [])]; e.target.value = ''; if (!files.length) return;
    let ok = 0;
    for (const f of files) { try { await library.importFile(audio(), f); ok++; } catch { /* skip unreadable */ } }
    setMsg(ok === files.length ? `Added ${ok} sample${ok > 1 ? 's' : ''}.` : `Added ${ok} of ${files.length}. The rest couldn't be read (try MP3, WAV, M4A or OGG).`);
  }
  const shown = (kind === 'all' ? clips : clips.filter((c) => c.source === kind)).slice().reverse(); // newest first
  const counts = clips.reduce((m, c) => ((m[c.source] = (m[c.source] || 0) + 1), m), {});

  return (
    <div className="pop-scrim bin-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} className="pop-card bin-card" role="dialog" aria-modal="true" aria-label="Sample bin" tabIndex={-1}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); importFiles({ target: { files: e.dataTransfer.files, value: '' } }); }}>
        <div className="pop-head">
          <h3>Sample bin <span className="bin-count">{clips.length}</span></h3>
          <div className="pop-tools">
            <button type="button" className="btn" onClick={() => file.current?.click()}>Add files</button>
            <input ref={file} type="file" accept="audio/*" multiple hidden onChange={importFiles} />
            <button type="button" className="mini pop-x" onClick={() => { blip(440); onClose(); }} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <div className="bin-kinds" role="tablist" aria-label="Show">
          {Object.entries(KINDS).map(([k, n]) => (k === 'all' || counts[k]) && (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={`switch ${kind === k ? 'on' : ''}`} onClick={() => { blip(600); setKind(k); }}>{n}<em>{k === 'all' ? clips.length : counts[k]}</em></button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="hint bin-empty">{clips.length ? 'Nothing of that kind yet.' : 'Empty for now. Tape takes, room recordings, prints, loaded files and bounces all land here. Add files, or drop them on this window.'}</p>
        ) : (
          <ul className="bin-list">
            {shown.map((c) => (
              <li key={c.id} className={playing === c.id ? 'playing' : ''}>
                <button type="button" className={`bin-play ${playing === c.id ? 'on' : ''}`} onClick={() => preview(c)} aria-label={playing === c.id ? `Stop ${c.name}` : `Hear ${c.name}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing === c.id ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M8 5v14l11-7z" />}</svg>
                </button>
                <div className="bin-info">
                  {editing === c.id ? (
                    <input className="clip-name" id={`bin-name-${c.id}`} autoFocus defaultValue={c.name} maxLength={32} aria-label="Sample name"
                      onBlur={(e) => { library.rename(c.id, e.target.value); setEditing(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
                  ) : (
                    <button type="button" className="bin-name" onClick={() => setEditing(c.id)} title="Rename">{c.name}</button>
                  )}
                  <em><span className={`bin-kind k-${c.source}`}>{KIND_NAME[c.source] || c.source}</span>{fmtDur(c.duration)}</em>
                </div>
                {confirm === c.id ? (
                  <div className="bin-acts">
                    <span className="bin-ask">Delete it? Pads using it go quiet.</span>
                    <button type="button" className="btn primary" onClick={() => { blip(300); if (playing === c.id) stopPreview(); library.remove(c.id); setConfirm(null); }}>Delete</button>
                    <button type="button" className="btn" onClick={() => setConfirm(null)}>Keep</button>
                  </div>
                ) : (
                  <div className="bin-acts">
                    <button type="button" className="btn" onClick={() => { blip(1100); putOnPlatter(c.id); setMsg(`${c.name} is on the turntable.`); }}>Turntable</button>
                    <select value="" onChange={(e) => { const ri = +e.target.value; blip(900); pads.loadClip(c.id, ri); setTimeout(() => pads.hit(ri), 40); setMsg(`${c.name} is on pad channel ${ri + 1}.`); }} aria-label={`Send ${c.name} to a pad channel`}>
                      <option value="" disabled>To pad…</option>
                      {rows.map((r, i) => <option key={r.id} value={i}>Ch {i + 1} · {r.src ? r.name : 'empty'}</option>)}
                    </select>
                    <button type="button" className="mini" onClick={() => setConfirm(c.id)} aria-label={`Delete ${c.name}`}>×</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="hint bin-msg" role="status" aria-live="polite">{msg || 'One bin for the whole room: the tape deck, turntable and pads all pick from it. Saved in this browser.'}</p>
      </div>
    </div>
  );
}
