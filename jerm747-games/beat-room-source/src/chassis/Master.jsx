// Output: the LED ladder (a slim one lives in the top bar), the master knob, the speakers
// switch and the audio latency the browser reports.
import { useRef } from 'react';
import { getMaster, setMaster, onMaster, getSettings, onSettings, setSetting, latencyMs, blip } from '../engine/audio.js';
import { readBands } from './Speaker.jsx';
import { Knob, Led, useRaf, useExternal, fmtPct } from '../ui/parts.jsx';

/** LED ladder that follows the master output. */
export function Ladder({ segs = 12, className = '' }) {
  const ladder = useRef(null), lv = useRef(0), peak = useRef({ v: 0, t: 0 });
  useRaf((dt, now) => {
    const v = readBands(now).rms;
    lv.current += (v - lv.current) * (v > lv.current ? 0.6 : 0.15);
    if (lv.current > peak.current.v || now - peak.current.t > 900) peak.current = { v: lv.current, t: now };
    const n = Math.round(lv.current * segs), p = Math.min(segs - 1, Math.round(peak.current.v * segs) - 1);
    const kids = ladder.current?.children; if (!kids) return;
    for (let i = 0; i < segs; i++) {
      const cls = `seg ${i < n || i === p ? 'on' : ''} ${i >= segs - segs / 6 ? 'hot' : i >= segs - segs / 3 ? 'warm' : ''}`;
      if (kids[i].className !== cls) kids[i].className = cls;
    }
  });
  return <div className={`ladder ${className}`} ref={ladder} style={{ '--segs': segs }} aria-hidden="true">{Array.from({ length: segs }, (_, i) => <span key={i} className="seg" />)}</div>;
}

export const useMasterVol = () => [useExternal(onMaster, getMaster), setMaster];

export default function Master({ big = false }) {
  const [vol, setVol] = useMasterVol();
  const set = useExternal(onSettings, getSettings);
  const lat = latencyMs();
  return (
    <div className={`util master ${big ? 'big' : ''}`}>
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-vinyl)' }} />Output</span></div>
      <div className="master-body">
        <Ladder segs={big ? 24 : 12} />
        <Knob label="Master" value={vol} max={1} def={0.8} onChange={setVol} format={fmtPct} color="var(--c-vinyl)" />
      </div>
      <div className="util-btns">
        <button type="button" className={`switch ${set.speakers ? 'on' : ''}`} aria-pressed={set.speakers} onClick={() => { blip(700); setSetting('speakers', !set.speakers); }}><Led on={set.speakers} />Speakers {set.speakers ? 'shown' : 'hidden'}</button>
      </div>
      <p className="hint">{lat != null ? `Audio out latency: about ${lat} ms (what this device reports).` : 'Latency shows once audio has started.'} Wired headphones are quicker than Bluetooth.</p>
    </div>
  );
}
