// The Returnity rhythm composer with a mixer bolted on: tap a row's name to open its channel
// strip (source, 3-band EQ, level, mute). Any row can play a synth voice or a library clip; the
// fifth row is the Tape row, where the tape deck's SEND button drops clips.
import { useEffect, useState } from 'react';
import * as pads from '../engine/pads.js';
import { onStep, getBpm, setBpm, onBpm, onRun } from '../engine/clock.js';
import { blip } from '../engine/audio.js';
import { VOICE_NAMES } from '../engine/voices.js';
import { Knob, Led, useLibrary, useExternal, fmtDb, fmtPct } from '../ui/parts.jsx';

export default function Sequencer() {
  const rows = useExternal(pads.subscribe, pads.getRows);
  const clips = useLibrary();
  const bpm = useExternal(onBpm, getBpm);
  const playing = useExternal(onRun, pads.isPlaying);
  const [now, setNow] = useState(-1);
  const [sel, setSel] = useState(null);
  useEffect(() => onStep((i) => setNow(pads.isPlaying() ? i : -1)), []);

  const row = sel != null ? rows[sel] : null;
  const srcValue = (r) => (!r.src ? '' : r.src.type === 'synth' ? `synth:${r.src.voice}` : `clip:${r.src.clipId}`);
  const setSrc = (ri, v) => {
    if (!v) { pads.setRow(ri, { src: null }); return; }
    const [type, id] = v.split(':');
    if (type === 'synth') pads.setRow(ri, { src: { type: 'synth', voice: id }, name: VOICE_NAMES[id].split(' ')[0] });
    else pads.loadClip(id, ri);
    setTimeout(() => pads.hit(ri), 30);
  };
  const setK = (k) => (v) => pads.setRow(sel, { [k]: v });

  return (
    <section className="section pads-section" aria-labelledby="pads-h">
      <header className="sec-head"><h2 id="pads-h"><span className="sec-dot" style={{ background: 'var(--c-pads)' }} />Rhythm composer</h2><p>16 steps. Tap a row name to EQ it or swap its sound.</p></header>
      <div className="pad-unit"><div className="pad">
        <div className="pad-top">
          <button className="btn primary" type="button" onClick={() => { blip(880); pads.play(!playing); }} aria-pressed={playing}>{playing ? 'Stop' : 'Play'}</button>
          <button className="btn" type="button" onClick={() => { blip(330); pads.clear(); }}>Clear</button>
          <label className="tempo">Tempo <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(+e.target.value)} /> <output>{bpm}</output></label>
          <span className="engrave pad-engrave">Rhythm composer · 16 step</span>
        </div>
        {rows.map((r, ri) => (
          <div className={`pad-row ${r.mute ? 'muted' : ''} ${!r.src ? 'empty' : ''}`} key={r.id}>
            <button type="button" className={`row-name ${sel === ri ? 'sel' : ''}`} aria-expanded={sel === ri} aria-label={`${r.name} channel strip`} onClick={() => setSel(sel === ri ? null : ri)}>
              <Led on={sel === ri} />{r.src ? r.name : 'Empty'}
            </button>
            {r.steps.map((v, i) => (
              <button key={i} type="button" className={`step g${Math.floor(i / 4) + 1} ${v ? 'on' : ''} ${now === i ? 'now' : ''}`} aria-pressed={!!v} aria-label={`${r.name} step ${i + 1}`} onClick={() => pads.toggleStep(ri, i)} />
            ))}
          </div>
        ))}
        <div className="steps-index"><span />{Array.from({ length: 16 }, (_, i) => <i key={i}>{i + 1}</i>)}</div>

        {row && (
          <div className="chstrip" role="group" aria-label={`${row.name} channel strip`}>
            <div className="chstrip-src">
              <span className="engrave">Ch {sel + 1} · Source</span>
              <select value={srcValue(row)} onChange={(e) => setSrc(sel, e.target.value)} aria-label="Row sound">
                <option value="">Empty</option>
                <optgroup label="Synth kit">{Object.entries(VOICE_NAMES).map(([k, n]) => <option key={k} value={`synth:${k}`}>{n}</option>)}</optgroup>
                {clips.length > 0 && <optgroup label="Library">{clips.map((c) => <option key={c.id} value={`clip:${c.id}`}>{c.name}</option>)}</optgroup>}
              </select>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => pads.hit(sel)} disabled={!row.src}>Hit</button>
                <button type="button" className={`btn ${row.mute ? 'active' : ''}`} aria-pressed={row.mute} onClick={() => pads.setRow(sel, { mute: !row.mute })}>Mute</button>
                <button type="button" className="btn" onClick={() => pads.setRow(sel, { low: 0, mid: 0, high: 0, vol: 0.8 })}>Flat</button>
              </div>
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
