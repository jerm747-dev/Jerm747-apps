// Chromatic tuner on the handle strip. Listens to the mic (never to the speakers) and shows the
// nearest note with a cents needle styled like the deck's VU meters.
import { useEffect, useRef, useState } from 'react';
import { audio, blip } from '../engine/audio.js';
import { micAnalyser, micError, releaseMic } from '../engine/mic.js';
import { detectPitch, noteFor } from '../engine/pitch.js';
import { Led, useRaf } from '../ui/parts.jsx';

export default function Tuner() {
  const [on, setOn] = useState(false);
  const [read, setRead] = useState(null); // { name, octave, cents, hz }
  const [err, setErr] = useState('');
  const an = useRef(null), buf = useRef(null), frame = useRef(0), hist = useRef([]), needle = useRef(null), cents = useRef(0);

  useEffect(() => () => { an.current = null; releaseMic('tuner'); }, []);
  useRaf(() => {
    const target = read && on ? read.cents : 0;
    cents.current += (target - cents.current) * 0.25;
    needle.current?.setAttribute('transform', `rotate(${(cents.current / 50) * 48} 50 52)`);
    if (!on || !an.current || ++frame.current % 3) return;
    an.current.getFloatTimeDomainData(buf.current);
    const hz = detectPitch(buf.current, audio().sampleRate);
    if (!hz) { hist.current = []; return; }
    hist.current = [...hist.current, hz].slice(-5);
    const med = [...hist.current].sort((a, b) => a - b)[Math.floor(hist.current.length / 2)];
    setRead({ ...noteFor(med), hz: med });
  });

  async function toggle() {
    blip(on ? 520 : 1040); setErr('');
    if (on) { releaseMic('tuner'); an.current = null; setOn(false); setRead(null); return; }
    try { an.current = await micAnalyser('tuner'); buf.current = new Float32Array(an.current.fftSize); setOn(true); }
    catch (e) { setErr(micError(e)); }
  }
  const inTune = read && Math.abs(read.cents) <= 5;

  return (
    <div className="util tuner">
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
        <div className="lcd note" aria-live="polite"><b>{on && read ? read.name : '–'}<sup>{on && read ? read.octave : ''}</sup></b><span>{on && read ? `${read.hz.toFixed(1)} Hz · ${read.cents > 0 ? '+' : ''}${read.cents}¢` : on ? 'Play a note' : 'Off'}</span></div>
      </div>
      <div className="util-btns">
        <button type="button" className={`btn ${on ? 'active' : ''}`} aria-pressed={on} onClick={toggle}>{on ? 'Stop' : 'Listen'}</button>
      </div>
      {err && <p className="hint err" role="alert">{err}</p>}
    </div>
  );
}
