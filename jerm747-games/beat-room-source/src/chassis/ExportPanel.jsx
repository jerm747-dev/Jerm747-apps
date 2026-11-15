// Bounce: name the song, pick WAV or MP3 and what to bounce (the whole song in Song order with
// repeats, or the section you're editing), then Bounce. It plays through once in real time and
// lands on the Saved songs shelf on this device, with the room's settings, ready to save as a
// file, play back, send to the tape library, or Recall (puts the whole room back).
import { useEffect, useRef, useState } from 'react';
import * as exp from '../engine/export.js';
import * as pads from '../engine/pads.js';
import * as library from '../engine/library.js';
import { audio, blip } from '../engine/audio.js';
import { getBpm } from '../engine/clock.js';
import { Led, useExternal } from '../ui/parts.jsx';
import { putOnPlatter } from '../engine/platter.js';
import { openBin } from './SampleBin.jsx';

const NAME_KEY = 'beatroom.export';
const loadOpts = () => { try { return { name: '', format: 'wav', scope: 'song', ...JSON.parse(localStorage.getItem(NAME_KEY)) }; } catch { return { name: '', format: 'wav', scope: 'song' }; } };
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export function ExportBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn export-btn" onClick={() => { blip(820); setOpen(true); }} aria-haspopup="dialog">
        Bounce
      </button>
      {open && <ExportPop onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportPop({ onClose }) {
  const [opts, setOptsState] = useState(loadOpts);
  const setOpts = (c) => setOptsState((o) => { const n = { ...o, ...c }; try { localStorage.setItem(NAME_KEY, JSON.stringify(n)); } catch { /* off */ } return n; });
  const song = useExternal(pads.onSong, pads.getSong);
  const shelf = useExternal(exp.onShelf, exp.getShelf);
  const [job, setJob] = useState(null);     // { stage: 'bounce'|'encode', p }
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState(null);   // the song just made
  const [confirm, setConfirm] = useState(null); // { kind: 'recall'|'delete', rec }
  const bounceRef = useRef(null), card = useRef(null);
  const busy = !!job;

  useEffect(() => { exp.loadShelf(); card.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [busy, onClose]);
  useEffect(() => () => bounceRef.current?.cancel(), []);

  const plan = exp.plan(opts.scope);
  const secs = plan ? (plan.steps * 15) / getBpm() : 0;
  const name = opts.name.trim() || 'Untitled';

  async function go() {
    setMsg(''); setLast(null); blip(990);
    try {
      audio();
      const b = exp.bounce(opts.scope, (p) => setJob({ stage: 'bounce', p }));
      bounceRef.current = b; setJob({ stage: 'bounce', p: 0 });
      const buf = await b.done;
      bounceRef.current = null;
      setJob({ stage: 'encode', p: 0 });
      const blob = opts.format === 'mp3' ? await exp.toMp3(buf, 192, (p) => setJob({ stage: 'encode', p })) : exp.toWav(buf);
      const rec = await exp.saveSong({ name, format: opts.format, blob, duration: buf.duration });
      // every bounce also lands in the Sample bin, so the turntable, pads and tape can use it
      const clip = library.add({ buffer: buf, name: rec.name.slice(0, 32), source: 'bounce' });
      setLast({ ...rec, clipId: clip.id });
      setMsg(`“${rec.name}” is in the Sample bin and on your Bounced songs list (${fmtDur(buf.duration)}, ${fmtSize(blob.size)}).`);
    } catch (e) {
      setMsg(e.message === 'cancelled' ? 'Bounce cancelled.' : e.message || String(e));
    } finally { setJob(null); bounceRef.current = null; }
  }
  const cancel = () => { blip(330); bounceRef.current?.cancel(); };
  const save = async (rec) => {
    blip(1100);
    try { await exp.saveFile(rec.name, rec.format, rec.blob); setMsg(`Saved ${exp.fileName(rec.name, rec.format)}.`); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div className="pop-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={card} className="pop-card export-card" role="dialog" aria-modal="true" aria-label="Bounce song" tabIndex={-1}>
        <div className="pop-head">
          <h3>Bounce song</h3>
          <button type="button" className="mini pop-x" onClick={() => { if (!busy) { blip(440); onClose(); } }} disabled={busy} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="exp-form">
          <label className="exp-field" htmlFor="exp-name"><span className="engrave">Song name</span>
            <input id="exp-name" value={opts.name} maxLength={60} placeholder="Untitled" disabled={busy} onChange={(e) => setOpts({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && !busy && plan && go()} />
          </label>
          <div className="exp-field"><span className="engrave">Format</span>
            <div className="seg exp-seg" role="radiogroup" aria-label="Format">
              {[['wav', 'WAV', '16-bit, full quality'], ['mp3', 'MP3', '192 kbps, small']].map(([v, l, d]) => (
                <button key={v} type="button" role="radio" aria-checked={opts.format === v} disabled={busy} className={`switch ${opts.format === v ? 'on' : ''}`} onClick={() => { blip(640); setOpts({ format: v }); }}><Led on={opts.format === v} /><b>{l}</b><em>{d}</em></button>
              ))}
            </div>
          </div>
          <div className="exp-field"><span className="engrave">What to bounce</span>
            <div className="seg exp-seg" role="radiogroup" aria-label="What to bounce">
              <button type="button" role="radio" aria-checked={opts.scope === 'song'} disabled={busy} className={`switch ${opts.scope === 'song' ? 'on' : ''}`} onClick={() => { blip(600); setOpts({ scope: 'song' }); }}><Led on={opts.scope === 'song'} /><b>Whole song</b><em>{exp.plan('song')?.parts.join(' · ') || 'no sections yet'}</em></button>
              <button type="button" role="radio" aria-checked={opts.scope === 'section'} disabled={busy} className={`switch ${opts.scope === 'section' ? 'on' : ''}`} onClick={() => { blip(600); setOpts({ scope: 'section' }); }}><Led on={opts.scope === 'section'} /><b>Section {pads.SECTIONS[song?.edit ?? 0]}</b><em>{exp.plan('section')?.parts.join('')}</em></button>
            </div>
          </div>
        </div>

        {busy ? (
          <div className="exp-run">
            <div className="exp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.p * 100)}><i style={{ width: `${job.p * 100}%` }} /></div>
            <div className="exp-run-row">
              <span className="engrave">{job.stage === 'bounce' ? `Bouncing · ${fmtDur(job.p * (secs + 2))} / ${fmtDur(secs + 2)}` : `Encoding ${opts.format.toUpperCase()}…`}</span>
              {job.stage === 'bounce' && <button type="button" className="btn" onClick={cancel}>Cancel</button>}
            </div>
          </div>
        ) : (
          <div className="exp-go">
            <button type="button" className="btn primary" onClick={go} disabled={!plan}>Bounce “{name}”</button>
            <span className="hint">{plan ? `Plays through once in real time: about ${fmtDur(secs + 2)}. Clicks stay out.` : 'Add notes to a section first.'}</span>
          </div>
        )}
        {msg && <p className="hint exp-msg" role="status" aria-live="polite">{msg}</p>}
        {last && !busy && (
          <div className="btn-row exp-after">
            <button type="button" className="btn primary" onClick={() => save(last)}>Save {exp.fileName(last.name, last.format)}</button>
            <button type="button" className="btn" onClick={() => { blip(1200); putOnPlatter(last.clipId); setMsg(`“${last.name}” is on the turntable.`); }}>Put on turntable</button>
            <button type="button" className="btn" onClick={() => { blip(760); openBin(); }}>Open Sample bin</button>
          </div>
        )}

        <div className="shelf">
          <div className="panel-head"><span className="engrave">Bounced songs · {shelf.length}</span><span className="engrave dim">On this device</span></div>
          {shelf.length === 0 ? <p className="hint">Songs you bounce land here, with the room’s settings, so you can recall them later.</p> : (
            <ul className="shelf-list">
              {shelf.map((rec) => (
                <li key={rec.id}>
                  <div className="shelf-info">
                    <b>{rec.name}</b>
                    <em>{rec.format.toUpperCase()} · {fmtDur(rec.duration)} · {fmtSize(rec.blob.size)} · {fmtDate(rec.created)}</em>
                  </div>
                  {confirm?.rec.id === rec.id ? (
                    <div className="shelf-confirm">
                      <span>{confirm.kind === 'recall' ? 'Replace the room with this song’s settings?' : 'Delete this song?'}</span>
                      <button type="button" className="btn primary" onClick={() => { blip(900); if (confirm.kind === 'recall') { try { exp.recall(rec); } catch (e) { setMsg(e.message); } } else { exp.removeSong(rec.id); setConfirm(null); if (last?.id === rec.id) setLast(null); } }}>{confirm.kind === 'recall' ? 'Recall' : 'Delete'}</button>
                      <button type="button" className="btn" onClick={() => setConfirm(null)}>Keep</button>
                    </div>
                  ) : (
                    <div className="shelf-btns">
                      <Player rec={rec} />
                      <button type="button" className="btn" onClick={() => save(rec)} disabled={busy}>Save file</button>
                      <button type="button" className="btn" onClick={() => setConfirm({ kind: 'recall', rec })} disabled={busy} title="Put the patterns, notes, mixer, tempo and sounds back the way they were">Recall</button>
                      <button type="button" className="mini" onClick={() => setConfirm({ kind: 'delete', rec })} disabled={busy} aria-label={`Delete ${rec.name}`}>×</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Play / stop a saved song (plain <audio>, outside the room's mix). */
function Player({ rec }) {
  const [on, setOn] = useState(false);
  const el = useRef(null), url = useRef(null);
  useEffect(() => () => { el.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);
  const toggle = () => {
    if (!el.current) { url.current = URL.createObjectURL(rec.blob); el.current = new Audio(url.current); el.current.onended = () => setOn(false); }
    if (on) { el.current.pause(); el.current.currentTime = 0; setOn(false); }
    else { el.current.play().then(() => setOn(true)).catch(() => setOn(false)); }
  };
  return <button type="button" className={`btn ${on ? 'active' : ''}`} aria-pressed={on} onClick={toggle}>{on ? 'Stop' : 'Play'}</button>;
}
