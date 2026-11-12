// Chromatic tuner. Listens to the mic (never to the speakers) and shows the nearest note with a
// cents needle styled like the deck's VU meters. The listening runs in tunerStore, so it keeps
// going while the pop-up is closed and the top-bar button shows the note.
import { useRef } from 'react';
import { blip } from '../engine/audio.js';
import * as tuner from '../engine/tunerStore.js';
import { Led, useRaf, useExternal } from '../ui/parts.jsx';

export default function Tuner({ big = false }) {
  const { on, read, err } = useExternal(tuner.subscribe, tuner.get);
  const needle = useRef(null), cents = useRef(0), live = useRef(null);
  live.current = read && on ? read.cents : 0;
  useRaf(() => {
    cents.current += (live.current - cents.current) * 0.25;
    needle.current?.setAttribute('transform', `rotate(${(cents.current / 50) * 48} 50 52)`);
  });
  const inTune = on && read && Math.abs(read.cents) <= 5;

  return (
    <div className={`util tuner ${big ? 'big' : ''}`}>
      <div className="util-head"><span className="engrave"><span className="sec-dot sm" style={{ background: 'var(--c-tools)' }} />Tuner</span><Led on={!!inTune} color="#5fd38a" /></div>
      <div className="tuner-body">
        <div className="vu tuner-vu"><svg viewBox="0 0 100 48" aria-hidden="true">
          <path d="M14 40 A40 40 0 0 1 86 40" fill="none" stroke="#2a241a" strokeWidth="1" />
          <path d="M46 12.2 A40 40 0 0 1 54 12.2" fill="none" stroke="#2f9e5c" strokeWidth="4" />
          <g stroke="#2a241a" strokeWidth="1"><path d="M18 33l3 2M28 24l2 3M40 18l1 3M50 14v4M60 18l-1 3M72 24l-2 3M82 33l-3 2" /></g>
          <text x="16" y="45" fontFamily="Share Tech Mono, monospace" fontSize="6" fill="#2a241a">−50</text>
          <text x="84" y="45" textAnchor="end" fontFamily="Share Tech Mono, monospace" fontSize="6" fill="#2a241a">+50</text>
          <line ref={needle} x1="50" y1="52" x2="50" y2="12" stroke="#151515" strokeWidth="1.2" />
        </svg></div>
        <div className={`lcd note ${inTune ? 'in-tune' : ''}`} aria-live="polite"><b>{on && read ? read.name : '–'}<sup>{on && read ? read.octave : ''}</sup></b><span>{on && read ? `${read.hz.toFixed(1)} Hz · ${read.cents > 0 ? '+' : ''}${read.cents}¢` : on ? 'Play a note' : 'Off'}</span></div>
      </div>
      <div className="util-btns">
        <button type="button" className={`btn ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => { blip(on ? 520 : 1040); tuner.toggle(); }}>{on ? 'Stop' : 'Listen'}</button>
      </div>
      {err && <p className="hint err" role="alert">{err}</p>}
    </div>
  );
}
