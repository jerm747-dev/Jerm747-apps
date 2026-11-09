// Master section on the handle strip: output level ladder + master volume knob.
import { useRef, useState } from 'react';
import { getMaster, setMaster } from '../engine/audio.js';
import { readBands } from './Speaker.jsx';
import { Knob, useRaf, fmtPct } from '../ui/parts.jsx';

const SEGS = 12;
export default function Master() {
  const [vol, setVol] = useState(getMaster);
  const ladder = useRef(null), lv = useRef(0), peak = useRef({ v: 0, t: 0 });
  useRaf((dt, now) => {
    const v = readBands(now).rms;
    lv.current += (v - lv.current) * (v > lv.current ? 0.6 : 0.15);
    if (lv.current > peak.current.v || now - peak.current.t > 900) peak.current = { v: lv.current, t: now };
    const n = Math.round(lv.current * SEGS), p = Math.min(SEGS - 1, Math.round(peak.current.v * SEGS) - 1);
    const kids = ladder.current?.children; if (!kids) return;
    for (let i = 0; i < SEGS; i++) kids[i].className = `seg ${i < n || i === p ? 'on' : ''} ${i >= SEGS - 2 ? 'hot' : i >= SEGS - 4 ? 'warm' : ''}`;
  });
  return (
    <div className="util master">
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-vinyl)' }} />Output</span></div>
      <div className="master-body">
        <div className="ladder" ref={ladder} aria-hidden="true">{Array.from({ length: SEGS }, (_, i) => <span key={i} className="seg" />)}</div>
        <Knob label="Master" value={vol} max={1} def={0.8} onChange={(v) => { setVol(v); setMaster(v); }} format={fmtPct} color="var(--c-vinyl)" />
      </div>
    </div>
  );
}
