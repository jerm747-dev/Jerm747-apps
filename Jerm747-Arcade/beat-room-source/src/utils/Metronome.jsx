// Metronome on the handle strip. It rides the shared clock, so its BPM is the pattern's BPM:
// click alone to practice, or click along while the pattern plays.
import { useEffect, useRef, useState } from 'react';
import { audio, out, blip } from '../engine/audio.js';
import { definePart, arm, isArmed, getBpm, setBpm, onBpm, onRun, onStep } from '../engine/clock.js';
import { Led, useExternal } from '../ui/parts.jsx';

definePart('click', (step, time) => {
  if (step % 4) return;
  const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = step === 0 ? 1760 : 1175;
  g.gain.setValueAtTime(step === 0 ? 0.22 : 0.13, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  o.connect(g).connect(out()); o.start(time); o.stop(time + 0.05);
});

export default function Metronome() {
  const bpm = useExternal(onBpm, getBpm);
  const on = useExternal(onRun, () => isArmed('click'));
  const [beat, setBeat] = useState(-1);
  const taps = useRef([]);
  useEffect(() => onStep((i) => setBeat(i < 0 ? -1 : Math.floor(i / 4))), []);
  useEffect(() => () => arm('click', false), []);

  const tap = () => {
    blip(1320);
    const t = performance.now(), list = taps.current.filter((x) => t - x < 2500);
    list.push(t); taps.current = list.slice(-6);
    if (list.length >= 2) { const gaps = list.slice(1).map((x, i) => x - list[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); }
  };
  const nudge = (d) => { blip(980); setBpm(getBpm() + d); };

  return (
    <div className="util metro">
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-tools)' }} />Metronome</span><span className="beats" aria-hidden="true">{[0, 1, 2, 3].map((b) => <Led key={b} on={beat === b} color={b === 0 ? '#ff6a3d' : undefined} />)}</span></div>
      <div className="metro-body">
        <button type="button" className="mini-key" aria-label="Slower" onClick={() => nudge(-1)}>−</button>
        <div className="lcd" aria-live="off"><b>{bpm}</b><span>BPM</span></div>
        <button type="button" className="mini-key" aria-label="Faster" onClick={() => nudge(1)}>+</button>
      </div>
      <div className="util-btns">
        <button type="button" className={`btn ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => { audio(); arm('click', !on); }}>{on ? 'Stop' : 'Click'}</button>
        <button type="button" className="btn" onClick={tap}>Tap</button>
      </div>
    </div>
  );
}
