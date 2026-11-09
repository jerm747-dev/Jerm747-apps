// The Returnity rhythm composer with a mixer bolted on: tap a row's name to open its channel
// strip (source, 3-band EQ, level, mute). Any row can play a synth voice or a library clip; the
// fifth row is the Tape row, where the tape deck's SEND button drops clips.
// Patterns run 16, 32 or 64 steps (going longer repeats what's there). The grid always shows
// 16 at a time, one page per 16, and Follow flips the pages with the playhead.
// Any row can load a sound file from the device (Load sound in its channel strip).
// Loop record: REC plays one pass as a count-in (or waits for the top if it's already looping),
// records pad hits for one pass, then stops recording and keeps the loop going.
import { useEffect, useRef, useState } from 'react';
import * as pads from '../engine/pads.js';
import { onStep, getBpm, setBpm, onBpm, onRun } from '../engine/clock.js';
import { audio, blip } from '../engine/audio.js';
import * as library from '../engine/library.js';
import { VOICE_NAMES, EXTRA_NAMES, ALL_VOICE_NAMES } from '../engine/voices.js';
import { Knob, Led, useLibrary, useExternal, fmtDb, fmtPct, useFullscreen, FullBtn } from '../ui/parts.jsx';

const PAGE = 16;
const PAD_KEYS = ['1', '2', '3', '4', '5'];

export default function Sequencer() {
  const rows = useExternal(pads.subscribe, pads.getRows);
  const len = useExternal(pads.subscribe, pads.getLength);
  const recState = useExternal(pads.onRec, pads.getRec);
  const clips = useLibrary();
  const bpm = useExternal(onBpm, getBpm);
  const playing = useExternal(onRun, pads.isPlaying);
  const [now, setNow] = useState(-1);
  const [sel, setSel] = useState(null);
  const [page, setPage] = useState(0);
  const [follow, setFollow] = useState(true);
  const [flash, setFlash] = useState(-1);
  const [fsRef, full, toggleFull] = useFullscreen();
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const pages = len / PAGE;

  async function loadSound(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f || sel == null) return;
    setMsg('Loading the sound…');
    try {
      const c = await library.importFile(audio(), f);
      pads.loadClip(c.id, sel); setTimeout(() => pads.hit(sel), 40);
      setMsg(`${c.name} is on row ${sel + 1} and in the library.`);
    } catch { setMsg('That file could not be read. Try an MP3, WAV, M4A or OGG.'); }
  }

  useEffect(() => onStep((i, abs) => setNow(pads.isPlaying() && i >= 0 ? abs % pads.getLength() : -1)), []);
  useEffect(() => { if (follow && now >= 0) setPage(Math.floor(now / PAGE)); }, [now, follow]);
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);

  // keys 1-5 play the pads (and record them while REC is on)
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const ri = PAD_KEYS.indexOf(e.key); if (ri < 0) return;
      perform(ri); e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const perform = (ri) => { pads.perform(ri); setFlash(ri); setTimeout(() => setFlash((f) => (f === ri ? -1 : f)), 110); };

  const row = sel != null ? rows[sel] : null;
  const srcValue = (r) => (!r.src ? '' : r.src.type === 'synth' ? `synth:${r.src.voice}` : `clip:${r.src.clipId}`);
  const setSrc = (ri, v) => {
    if (!v) { pads.setRow(ri, { src: null }); return; }
    const [type, id] = v.split(':');
    if (type === 'synth') pads.setRow(ri, { src: { type: 'synth', voice: id }, name: ALL_VOICE_NAMES[id].split(' ').pop().slice(0, 8) });
    else pads.loadClip(id, ri);
    setTimeout(() => pads.hit(ri), 30);
  };
  const setK = (k) => (v) => pads.setRow(sel, { [k]: v });
  const first = page * PAGE;
  const view = (steps) => steps.slice(first, first + PAGE);
  const goPage = (p) => { blip(600 + p * 120); setPage(p); setFollow(false); };
  const recLabel = recState === 'armed' ? 'Ready' : recState === 'rec' ? 'Rec ●' : 'Rec';

  return (
    <section ref={fsRef} className={`section pads-section ${full ? 'is-full' : ''}`} aria-labelledby="pads-h">
      <header className="sec-head"><h2 id="pads-h"><span className="sec-dot" style={{ background: 'var(--c-pads)' }} />Rhythm composer</h2><p>{len} steps. Tap a row name to EQ it or swap its sound.</p><FullBtn full={full} onClick={toggleFull} label="Rhythm composer" /></header>
      <div className="pad-unit"><div className="pad">
        <div className="pad-top">
          <button className="btn primary" type="button" onClick={() => { blip(880); pads.play(!playing); }} aria-pressed={playing}>{playing ? 'Stop' : 'Play'}</button>
          <button className={`btn rec-btn ${recState}`} type="button" onClick={() => { blip(recState === 'off' ? 990 : 330); pads.toggleRec(); }} aria-pressed={recState !== 'off'}
            title="Loop record: plays one pass, then records your pad hits for one pass"><Led on={recState === 'rec'} color="#ff4b3a" />{recLabel}</button>
          <button className="btn" type="button" onClick={() => { blip(330); pads.clear(); }}>Clear</button>
          <label className="tempo">Tempo <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(+e.target.value)} /> <output>{bpm}</output></label>
          <div className="len-ctl" role="radiogroup" aria-label="Pattern length in steps">
            <span className="engrave len-label">Steps</span>
            {pads.LENGTHS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={len === n} className={`len-btn ${len === n ? 'on' : ''}`} onClick={() => { blip(500 + n * 6); pads.setLength(n); }}>{n}</button>
            ))}
          </div>
        </div>

        {pages > 1 && (
          <div className="page-bar" role="group" aria-label="Step pages" style={{ '--pages': pages }}>
            {Array.from({ length: pages }, (_, p) => (
              <button key={p} type="button" className={`page-btn ${page === p ? 'sel' : ''} ${now >= p * PAGE && now < (p + 1) * PAGE ? 'playing' : ''}`} aria-pressed={page === p} onClick={() => goPage(p)}>
                <Led on={now >= p * PAGE && now < (p + 1) * PAGE} color="var(--c-pads)" />{p * PAGE + 1}–{(p + 1) * PAGE}
              </button>
            ))}
            <button type="button" className={`switch ${follow ? 'on' : ''}`} aria-pressed={follow} onClick={() => setFollow(!follow)}>Follow</button>
          </div>
        )}

        {rows.map((r, ri) => (
          <div className={`pad-row ${r.mute ? 'muted' : ''} ${!r.src ? 'empty' : ''}`} key={r.id}>
            <button type="button" className={`row-name ${sel === ri ? 'sel' : ''}`} aria-expanded={sel === ri} aria-label={`${r.name} channel strip`} onClick={() => setSel(sel === ri ? null : ri)}>
              <Led on={sel === ri} />{r.src ? r.name : 'Empty'}
            </button>
            {view(r.steps).map((v, k) => {
              const i = first + k;
              return <button key={i} type="button" className={`step g${Math.floor(k / 4) + 1} ${v ? 'on' : ''} ${now === i ? 'now' : ''}`} aria-pressed={!!v} aria-label={`${r.name} step ${i + 1}`} onClick={() => pads.toggleStep(ri, i)} />;
            })}
          </div>
        ))}
        <div className="steps-index"><span />{Array.from({ length: PAGE }, (_, k) => <i key={k}>{first + k + 1}</i>)}</div>

        <div className={`perf-pads ${recState}`} role="group" aria-label="Live pads">
          {rows.map((r, ri) => (
            <button key={r.id} type="button" className={`perf-pad ${flash === ri ? 'hit' : ''}`} disabled={!r.src}
              onPointerDown={(e) => { e.preventDefault(); perform(ri); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); perform(ri); } }}
              aria-label={`Play ${r.name}`}>
              <span>{r.src ? r.name : '—'}</span><kbd>{PAD_KEYS[ri]}</kbd>
            </button>
          ))}
        </div>
        <p className="pad-hint">{recState === 'armed' ? 'Get ready: recording starts at the top of the loop.' : recState === 'rec' ? 'Recording this pass. Hit the pads (or keys 1–5).' : 'Live pads: tap to play. Hit REC to record them into the loop. Tap a row name to load your own sound.'}</p>

        {row && (
          <div className="chstrip" role="group" aria-label={`${row.name} channel strip`}>
            <div className="chstrip-src">
              <span className="engrave">Ch {sel + 1} · Source</span>
              <select value={srcValue(row)} onChange={(e) => setSrc(sel, e.target.value)} aria-label="Row sound">
                <option value="">Empty</option>
                <optgroup label="Synth kit">{Object.entries(VOICE_NAMES).map(([k, n]) => <option key={k} value={`synth:${k}`}>{n}</option>)}</optgroup>
                <optgroup label="Extra kit">{Object.entries(EXTRA_NAMES).map(([k, n]) => <option key={k} value={`synth:${k}`}>{n}</option>)}</optgroup>
                {clips.length > 0 && <optgroup label="Library">{clips.map((c) => <option key={c.id} value={`clip:${c.id}`}>{c.name}</option>)}</optgroup>}
              </select>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => pads.hit(sel)} disabled={!row.src}>Hit</button>
                <button type="button" className={`btn ${row.mute ? 'active' : ''}`} aria-pressed={row.mute} onClick={() => pads.setRow(sel, { mute: !row.mute })}>Mute</button>
                <button type="button" className="btn" onClick={() => pads.setRow(sel, { low: 0, mid: 0, high: 0, vol: 0.8 })}>Flat</button>
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Load sound</button>
                <input ref={fileRef} type="file" accept="audio/*" hidden onChange={loadSound} />
              </div>
              {msg && <p className="hint" role="status" aria-live="polite">{msg}</p>}
            </div>
            <div className="knob-row">
              <Knob label="Low" value={row.low} min={-1} max={1} def={0} bipolar onChange={setK('low')} format={fmtDb} color="var(--c-pads)" />
              <Knob label="Mid" value={row.mid} min={-1} max={1} def={0} bipolar onChange={setK('mid')} format={fmtDb} color="var(--c-pads)" />
              <Knob label="High" value={row.high} min={-1} max={1} def={0} bipolar onChange={setK('high')} format={fmtDb} color="var(--c-pads)" />
              <Knob label="Level" value={row.vol} min={0} max={1.2} def={0.8} onChange={setK('vol')} format={fmtPct} color="var(--c-pads)" />
            </div>
          </div>
        )}
      </div></div>
    </section>
  );
}
