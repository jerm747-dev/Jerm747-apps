import PadMapping from '../ui/PadMapping.jsx';
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
import { blip, level } from '../engine/audio.js';
import ClickCtl from '../ui/ClickCtl.jsx';
import TempoStep from '../ui/TempoStep.jsx';
import { VOICE_NAMES, EXTRA_NAMES, ALL_VOICE_NAMES } from '../engine/voices.js';
import { Knob, Led, useLibrary, useExternal, fmtDb, fmtPct, useFullscreen, FullBtn, useFold, FoldBtn, useRaf } from '../ui/parts.jsx';

const PAGE = 16;
const PAD_KEYS = ['1', '2', '3', '4', '5'];

export default function Sequencer() {
  const rows = useExternal(pads.subscribe, pads.getRows);
  const len = useExternal(pads.subscribe, pads.getLength);
  const recState = useExternal(pads.onRec, pads.getRec);
  const song = useExternal(pads.onSong, pads.getSong);
  const clips = useLibrary();
  const bpm = useExternal(onBpm, getBpm);
  const playing = useExternal(onRun, pads.isPlaying);
  const [now, setNow] = useState(-1);
  const [sel, setSel] = useState(null);
  const [page, setPage] = useState(0);
  const [velocity,setVelocity]=useState(false);
  const [follow, setFollow] = useState(true);
  const [flash, setFlash] = useState(-1);
  const [fsRef, full, toggleFull] = useFullscreen();
  const [folded, toggleFold] = useFold('pads');
  const pages = len / PAGE;

  useEffect(() => onStep((i, abs) => {
    const m = i >= 0 && pads.isPlaying() ? pads.posAt(abs) : null;
    setNow(m && m.sec === pads.getSong()?.edit ? m.pos : -1);
  }), []);
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

  const first = page * PAGE;
  const view = (steps) => steps.slice(first, first + PAGE);
  const goPage = (p) => { blip(600 + p * 120); setPage(p); setFollow(false); };
  const recLabel = recState === 'armed' ? 'Ready' : recState === 'rec' ? 'Rec ●' : 'Rec';

  return (
    <section ref={fsRef} className={`section pads-section ${full ? 'is-full' : ''} ${folded && !full ? 'is-folded' : ''}`} aria-labelledby="pads-h">
      <header className="sec-head"><h2 id="pads-h"><span className="sec-dot" style={{ background: 'var(--c-pads)' }} />Rhythm composer</h2><p>Section {pads.SECTIONS[song?.edit ?? 0]} · {len} steps. Every channel has its own sound, EQ and level below.</p><span className="sec-tools"><FoldBtn folded={folded} onClick={() => { blip(folded ? 880 : 440); toggleFold(); }} label="Rhythm composer" /><FullBtn full={full} onClick={toggleFull} label="Rhythm composer" /></span></header>
      <div className="pad-unit"><div className="pad">
        <div className="pad-top">
          <button className="btn primary" type="button" onClick={() => { blip(880); pads.play(!playing); }} aria-pressed={playing}>{playing ? 'Stop' : 'Play'}</button>
          <button className={`btn rec-btn ${recState}`} type="button" onClick={() => { blip(recState === 'off' ? 990 : 330); pads.toggleRec(); }} aria-pressed={recState !== 'off'}
            title="Loop record: plays one pass, then records your pad hits for one pass"><Led on={recState === 'rec'} color="#ff4b3a" />{recLabel}</button>
          <ClickCtl />
          <button className="btn" type="button" onClick={() => { blip(330); pads.clear(); }}>Clear</button>
          <label className="tempo">Tempo <input type="range" min="60" max="180" value={Math.min(180, Math.max(60, bpm))} onChange={(e) => setBpm(+e.target.value)} aria-label="Tempo slider" /></label>
          <TempoStep id="pads" />
          <div className="len-ctl sec-ctl" role="tablist" aria-label="Section">
            {pads.SECTIONS.map((n, i) => (
              <button key={n} type="button" role="tab" aria-selected={song?.edit === i} className={`len-btn ${song?.edit === i ? 'on' : ''} ${song?.info[i].notes ? '' : 'dim'}`} onClick={() => { blip(500 + i * 90); pads.setEdit(i); }}>{n}</button>
            ))}
          </div>
          <div className="len-ctl" role="radiogroup" aria-label="Pattern length in steps">
            <span className="engrave len-label">Steps</span>
            {pads.LENGTHS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={len === n} className={`len-btn ${len === n ? 'on' : ''}`} onClick={() => { blip(500 + n * 6); pads.setLength(n); }}>{n}</button>
            ))}
          </div>
        </div>

        {(
          <div className="page-bar" role="group" aria-label="Step pages" style={{ '--pages': pages }}>
            {pages>1 && Array.from({ length: pages }, (_, p) => (
              <button key={p} type="button" className={`page-btn ${page === p ? 'sel' : ''} ${now >= p * PAGE && now < (p + 1) * PAGE ? 'playing' : ''}`} aria-pressed={page === p} onClick={() => goPage(p)}>
                <Led on={now >= p * PAGE && now < (p + 1) * PAGE} color="var(--c-pads)" />{p * PAGE + 1}–{(p + 1) * PAGE}
              </button>
            ))}
            <button type="button" className={`switch ${follow ? 'on' : ''}`} aria-pressed={follow} onClick={() => setFollow(!follow)}>Follow</button>
            <button type="button" className={'switch '+(velocity?'on':'')} aria-pressed={velocity} onClick={()=>setVelocity(!velocity)}>Velocity</button>
          </div>
        )}

        {rows.map((r, ri) => (
          <div className={`pad-row ${r.mute ? 'muted' : ''} ${!r.src ? 'empty' : ''}`} key={r.id}>
            <button type="button" className={`row-name ${sel === ri ? 'sel' : ''}`} aria-pressed={sel === ri} aria-label={`${r.name}: select channel ${ri + 1}`} onClick={() => setSel(sel === ri ? null : ri)}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pads.loadFile(ri, f).catch(() => {}); }}>
              <Led on={sel === ri} />{r.src ? r.name : 'Empty'}
            </button>
            {view(r.steps).map((v, k) => {
              const i = first + k;
              return <button key={i} type="button" className={`step g${Math.floor(k / 4) + 1} ${v ? 'on' : ''} ${now === i ? 'now' : ''}`} aria-pressed={!!v} aria-label={`${r.name} step ${i + 1}`+(velocity?(v?' · '+v+'%':' · empty'):'')} onClick={() => velocity?pads.cycleVelocity(ri,i):pads.toggleStep(ri,i)}>{velocity&&v>0&&<span className="velocity-meter" aria-hidden="true">{[25,50,75,100].map(n=><i key={n} className={v>=n?'lit':''} style={{height:(28+n*.66)+'%'}}/>)}</span>}</button>;
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
        <p className="pad-hint">{recState === 'armed' ? 'Get ready: recording starts at the top of the loop.' : recState === 'rec' ? 'Recording this pass. Hit the pads (or keys 1–5).' : 'Live pads: tap to play. Hit REC to record them into the loop. Load your own sound on any channel in the mixer.'}</p>

        <PadMapping rows={rows} recState={recState} />
        <Mixer rows={rows} clips={clips} sel={sel} setSel={setSel} />
      </div></div>
    </section>
  );
}

// ---------- 5-channel mixer ----------
// One strip per row: sound source, Load (pick a file, or drop one on the strip), Low / Mid /
// High EQ, level, mute, solo and a meter.
const srcValue = (r) => (!r.src ? '' : r.src.type === 'synth' ? `synth:${r.src.voice}` : `clip:${r.src.clipId}`);
function setSrc(ri, v) {
  if (!v) { pads.setRow(ri, { src: null }); return; }
  const [type, id] = v.split(':');
  if (type === 'synth') pads.setRow(ri, { src: { type: 'synth', voice: id }, name: ALL_VOICE_NAMES[id].split(' ').pop().slice(0, 8) });
  else pads.loadClip(id, ri);
  setTimeout(() => pads.hit(ri), 30);
}

function Mixer({ rows, clips, sel, setSel }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('beatroom.mixer') !== '0'; } catch { return true; } });
  const [msg, setMsg] = useState('');
  const flip = () => { blip(open ? 440 : 880); setOpen(!open); try { localStorage.setItem('beatroom.mixer', open ? '0' : '1'); } catch { /* off */ } };
  const anySolo = rows.some((r) => r.solo);
  return (
    <div className={`mixer ${open ? '' : 'folded'}`}>
      <div className="mixer-head">
        <span className="engrave">Mixer · 5 channels</span>
        {anySolo && <button type="button" className="switch on" onClick={() => rows.forEach((r, i) => r.solo && pads.setRow(i, { solo: false }))}>Clear solo</button>}
        <button type="button" className="mini fold-btn" onClick={flip} aria-expanded={open} aria-label={open ? 'Fold the mixer' : 'Open the mixer'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{open ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>
        </button>
      </div>
      {open && (
        <div className="mixer-strips">
          {rows.map((r, ri) => <Strip key={r.id} r={r} ri={ri} clips={clips} sel={sel === ri} onSel={() => setSel(sel === ri ? null : ri)} setMsg={setMsg} dim={anySolo && !r.solo} />)}
        </div>
      )}
      {open && <p className="hint mix-hint" role="status" aria-live="polite">{msg || 'Load puts a sound file from your device on that channel (or drop a file on it). Double-tap a knob to reset it.'}</p>}
    </div>
  );
}

function Strip({ r, ri, clips, sel, onSel, setMsg, dim }) {
  const file = useRef(null), meter = useRef(null), lv = useRef(0);
  useRaf(() => {
    const an = pads.meter(ri), el = meter.current; if (!el) return;
    const v = an ? level(an) : 0;
    lv.current += (v - lv.current) * (v > lv.current ? 0.6 : 0.12);
    el.style.setProperty('--lv', Math.min(1, lv.current * 1.4).toFixed(3));
  });
  const load = async (f) => {
    if (!f) return;
    setMsg(`Loading ${f.name}…`);
    try { const c = await pads.loadFile(ri, f); setMsg(`${c.name} is on channel ${ri + 1} and in the library.`); }
    catch { setMsg('That file could not be read. Try an MP3, WAV, M4A or OGG.'); }
  };
  const setK = (k) => (v) => pads.setRow(ri, { [k]: v });
  const C = 'var(--c-pads)';
  return (
    <div className={`strip-ch ${sel ? 'sel' : ''} ${r.mute ? 'muted' : ''} ${dim ? 'dim' : ''}`} role="group" aria-label={`Channel ${ri + 1}, ${r.name}`}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }}>
      <button type="button" className="ch-top" onClick={onSel} aria-pressed={sel}>
        <span className="ch-num">{ri + 1}</span><span className="ch-name">{r.src ? r.name : 'Empty'}</span>
        <span className="ch-meter" ref={meter} aria-hidden="true" />
      </button>
      <select value={srcValue(r)} onChange={(e) => setSrc(ri, e.target.value)} aria-label={`Channel ${ri + 1} sound`}>
        <option value="">Empty</option>
        <optgroup label="Synth kit">{Object.entries(VOICE_NAMES).map(([k, n]) => <option key={k} value={`synth:${k}`}>{n}</option>)}</optgroup>
        <optgroup label="Extra kit">{Object.entries(EXTRA_NAMES).map(([k, n]) => <option key={k} value={`synth:${k}`}>{n}</option>)}</optgroup>
        {clips.length > 0 && <optgroup label="Library">{clips.map((c) => <option key={c.id} value={`clip:${c.id}`}>{c.name}</option>)}</optgroup>}
      </select>
      <button type="button" className="btn ch-load" onClick={() => file.current?.click()} title="Load a sound file onto this channel">Load</button>
      <input ref={file} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; load(f); }} />
      <div className="ch-eq">
        <Knob size="sm" label="High" value={r.high} min={-1} max={1} def={0} bipolar onChange={setK('high')} format={fmtDb} color={C} />
        <Knob size="sm" label="Mid" value={r.mid} min={-1} max={1} def={0} bipolar onChange={setK('mid')} format={fmtDb} color={C} />
        <Knob size="sm" label="Low" value={r.low} min={-1} max={1} def={0} bipolar onChange={setK('low')} format={fmtDb} color={C} />
        <Knob size="sm" label="Level" value={r.vol} min={0} max={1.2} def={0.8} onChange={setK('vol')} format={fmtPct} color={C} />
      </div>
      <div className="ch-btns">
        <button type="button" className={`ch-key ${r.mute ? 'on mute' : ''}`} aria-pressed={r.mute} onClick={() => { blip(r.mute ? 660 : 330); pads.setRow(ri, { mute: !r.mute }); }} title="Mute">M</button>
        <button type="button" className={`ch-key ${r.solo ? 'on solo' : ''}`} aria-pressed={!!r.solo} onClick={() => { blip(r.solo ? 660 : 990); pads.setRow(ri, { solo: !r.solo }); }} title="Solo">S</button>
        <button type="button" className="ch-key" onClick={() => pads.hit(ri)} disabled={!r.src} title="Hit">▶</button>
        <button type="button" className="ch-key" onClick={() => { blip(500); pads.setRow(ri, { low: 0, mid: 0, high: 0, vol: 0.8 }); }} title="Flat EQ, level back to 80%">0</button>
      </div>
    </div>
  );
}
