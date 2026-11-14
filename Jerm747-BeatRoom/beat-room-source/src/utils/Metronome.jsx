// Tempo and metronome, split into two pop-ups off the top bar. Both ride the shared clock, so the
// BPM is the song's BPM. The click (and the count-in) go to the monitor path: you hear them,
// the tape never records them.
import { useEffect, useRef, useState } from 'react';
import { audio, monitorOut, blip, getSettings, onSettings, setSetting } from '../engine/audio.js';
import { definePart, arm, isArmed, getBpm, setBpm, onBpm, onRun, onStep } from '../engine/clock.js';
import { Led, useExternal } from '../ui/parts.jsx';
import * as recclick from '../engine/recclick.js';

definePart('click', (step, time) => {
  if (step % 4) return;
  const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = step === 0 ? 1760 : 1175;
  g.gain.setValueAtTime(step === 0 ? 0.22 : 0.13, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  o.connect(g).connect(monitorOut()); o.start(time); o.stop(time + 0.05);
});

export const metroOn = () => isArmed('click');
export const toggleMetro = () => { audio(); recclick.forget(); arm('click', !isArmed('click')); };

/** Beat LEDs that follow the transport. */
export function Beats() {
  const [beat, setBeat] = useState(-1);
  useEffect(() => onStep((i) => setBeat(i < 0 ? -1 : Math.floor(i / 4))), []);
  return <span className="beats" aria-hidden="true">{[0, 1, 2, 3].map((b) => <Led key={b} on={beat === b} color={b === 0 ? '#ff6a3d' : undefined} />)}</span>;
}

export function Tempo({ big = false }) {
  const bpm = useExternal(onBpm, getBpm);
  const taps = useRef([]);
  const tap = () => {
    blip(1320);
    const t = performance.now(), list = taps.current.filter((x) => t - x < 2500);
    list.push(t); taps.current = list.slice(-6);
    if (list.length >= 2) { const gaps = list.slice(1).map((x, i) => x - list[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); }
  };
  const nudge = (d) => { blip(980); setBpm(getBpm() + d); };
  return (
    <div className={`util metro ${big ? 'big' : ''}`}>
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-tools)' }} />Tempo</span><Beats /></div>
      <div className="metro-body">
        <button type="button" className="mini-key" aria-label="Slower" onClick={() => nudge(-1)}>−</button>
        <div className="lcd" aria-live="off"><b>{bpm}</b><span>BPM</span></div>
        <button type="button" className="mini-key" aria-label="Faster" onClick={() => nudge(1)}>+</button>
      </div>
      <input className="bpm-slider" type="range" min="40" max="220" value={bpm} onChange={(e) => setBpm(+e.target.value)} aria-label="Tempo" />
      <div className="util-btns">
        <button type="button" className="btn" onClick={() => { blip(700); setBpm(getBpm() / 2); }}>½×</button>
        <button type="button" className="btn tap-btn" onClick={tap}>Tap</button>
        <button type="button" className="btn" onClick={() => { blip(900); setBpm(getBpm() * 2); }}>2×</button>
      </div>
    </div>
  );
}

export default function Metronome({ big = false }) {
  const bpm = useExternal(onBpm, getBpm);
  const on = useExternal(onRun, metroOn);
  const set = useExternal(onSettings, getSettings);
  return (
    <div className={`util metro ${big ? 'big' : ''}`}>
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-tools)' }} />Metronome</span><Beats /></div>
      <div className="lcd metro-lcd" aria-live="off"><b>{bpm}</b><span>{on ? 'Clicking' : 'Click off'}</span></div>
      <div className="util-btns">
        <button type="button" className={`btn ${on ? 'active' : ''}`} aria-pressed={on} onClick={toggleMetro}>{on ? 'Stop click' : 'Click'}</button>
      </div>
      <div className="ci-row" role="radiogroup" aria-label="Count-in before recording">
        <span className="engrave">Count-in</span>
        {[[0, 'Off'], [1, '1 bar'], [2, '2 bars']].map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={set.countIn === v} className={`switch ${set.countIn === v ? 'on' : ''}`} onClick={() => { blip(600 + v * 200); setSetting('countIn', v); }}><Led on={set.countIn === v} />{l}</button>
        ))}
      </div>
      <p className="hint">The count-in plays before any REC (tape, pads, synth) when the song is stopped. Clicks never land on tape.</p>
    </div>
  );
}
