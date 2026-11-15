// Tempo stepper: − / + (tap for 1 BPM, hold to keep going), type a BPM in, or Tap it in.
// Shared by the rhythm composer and the song transport; both drive the one song tempo.
import { useEffect, useRef, useState } from 'react';
import { blip } from '../engine/audio.js';
import { getBpm, setBpm, onBpm } from '../engine/clock.js';
import { useExternal } from './parts.jsx';

const MIN = 40, MAX = 220;
const clamp = (v) => Math.max(MIN, Math.min(MAX, Math.round(v)));

export default function TempoStep({ id = 'bpm', tap = true }) {
  const bpm = useExternal(onBpm, getBpm);
  const [draft, setDraft] = useState(null);
  const rpt = useRef(0), taps = useRef([]);
  useEffect(() => () => clearInterval(rpt.current), []);

  const nudge = (d) => setBpm(clamp(getBpm() + d));
  const holdStart = (d) => {
    blip(d > 0 ? 980 : 760); nudge(d);
    clearInterval(rpt.current);
    const t0 = Date.now();
    rpt.current = setInterval(() => { const held = Date.now() - t0; if (held > 350) nudge(held > 1800 ? d * 5 : d); }, 90);
  };
  const holdEnd = () => clearInterval(rpt.current);
  const commit = () => { if (draft != null) { const n = parseInt(draft, 10); if (Number.isFinite(n)) setBpm(clamp(n)); setDraft(null); } };
  const tapIt = () => {
    blip(1320);
    const t = performance.now(), list = taps.current.filter((x) => t - x < 2500);
    list.push(t); taps.current = list.slice(-6);
    if (list.length >= 2) { const gaps = list.slice(1).map((x, i) => x - list[i]); setBpm(clamp(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length))); }
  };
  const stepBtn = (d, label) => (
    <button type="button" className="ts-step" aria-label={label} disabled={d < 0 ? bpm <= MIN : bpm >= MAX}
      onPointerDown={(e) => { e.preventDefault(); holdStart(d); }} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudge(d); } }}>{d < 0 ? '−' : '+'}</button>
  );
  return (
    <span className="tempo-step" role="group" aria-label="Tempo">
      {stepBtn(-1, 'Slower, 1 BPM')}
      <label className="ts-val" htmlFor={`ts-${id}`}>
        <input id={`ts-${id}`} type="text" inputMode="numeric" pattern="[0-9]*" value={draft ?? String(bpm)} aria-label={`Tempo in BPM, ${MIN} to ${MAX}`}
          onFocus={(e) => e.target.select()} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setDraft(null); nudge((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
          }} />
        <span aria-hidden="true">bpm</span>
      </label>
      {stepBtn(1, 'Faster, 1 BPM')}
      {tap && <button type="button" className="ts-tap" onClick={tapIt} title="Tap the beat to set the tempo">Tap</button>}
    </span>
  );
}
