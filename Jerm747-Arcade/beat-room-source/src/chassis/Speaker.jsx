// Boombox speakers that move with the music: the woofer cone pumps with the low end of the
// master output and the tweeter ring glows with the highs. Both speakers share one reading.
import { useRef } from 'react';
import { masterAnalyser } from '../engine/audio.js';
import { useRaf, reduce } from '../ui/parts.jsx';

let shared = { t: -1, low: 0, high: 0, rms: 0 };
let bins = null;
export function readBands(now) {
  if (shared.t === now) return shared;
  const an = masterAnalyser();
  if (!an) return (shared = { t: now, low: 0, high: 0, rms: 0 });
  if (!bins || bins.length !== an.frequencyBinCount) bins = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(bins);
  const hzPer = an.context.sampleRate / an.fftSize;
  const avg = (a, b) => { let s = 0, n = 0; for (let i = Math.max(1, Math.floor(a / hzPer)); i <= Math.floor(b / hzPer); i++) { s += bins[i]; n++; } return n ? s / n / 255 : 0; };
  const low = avg(30, 160), high = avg(4000, 12000), mid = avg(300, 2500);
  shared = { t: now, low, high, rms: Math.min(1, (low * 0.5 + mid * 0.35 + high * 0.15) * 1.15) };
  return shared;
}

export default function Speaker({ side = 'L' }) {
  const cone = useRef(null), cap = useRef(null), tw = useRef(null);
  const st = useRef({ x: 0, h: 0 });
  useRaf((dt, now) => {
    const b = readBands(now), S = st.current;
    const tgt = reduce() ? 0 : Math.pow(b.low, 1.6);
    S.x += (tgt - S.x) * (tgt > S.x ? 0.7 : 0.18);
    S.h += (b.high - S.h) * 0.3;
    cone.current?.setAttribute('transform', `translate(100 212) scale(${(1 + S.x * 0.07).toFixed(4)}) translate(-100 -212)`);
    cap.current?.setAttribute('transform', `translate(100 212) scale(${(1 + S.x * 0.16).toFixed(4)}) translate(-100 -212)`);
    if (tw.current) tw.current.style.opacity = (0.15 + S.h * 1.8).toFixed(3);
  });
  const id = `spk${side}`;
  return (
    <div className={`speaker speaker-${side}`} aria-hidden="true">
      <svg viewBox="0 0 200 320">
        <defs>
          <radialGradient id={`${id}-ring`} cx=".5" cy=".42" r=".55"><stop offset=".8" stopColor="#d9dade" /><stop offset=".93" stopColor="#8d8e94" /><stop offset="1" stopColor="#4a4b50" /></radialGradient>
          <radialGradient id={`${id}-cone`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#2a2a2f" /><stop offset=".55" stopColor="#141417" /><stop offset=".9" stopColor="#202024" /><stop offset="1" stopColor="#0a0a0c" /></radialGradient>
          <radialGradient id={`${id}-cap`} cx=".38" cy=".32" r=".7"><stop offset="0" stopColor="#5a5a62" /><stop offset=".6" stopColor="#1d1d22" /><stop offset="1" stopColor="#0b0b0d" /></radialGradient>
          <radialGradient id={`${id}-tw`} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#f4f4f6" /><stop offset=".7" stopColor="#9fa0a6" /><stop offset="1" stopColor="#55565b" /></radialGradient>
          <pattern id={`${id}-grill`} width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.25" fill="#050506" /></pattern>
        </defs>
        <rect x="4" y="4" width="192" height="312" rx="18" fill="#0d0d10" stroke="#2c2c32" strokeWidth="2" />
        <rect x="4" y="4" width="192" height="312" rx="18" fill={`url(#${id}-grill)`} opacity=".9" />
        {/* tweeter */}
        <circle cx="100" cy="62" r="30" fill={`url(#${id}-ring)`} />
        <circle cx="100" cy="62" r="22" fill="#111114" />
        <circle cx="100" cy="62" r="14" fill={`url(#${id}-tw)`} />
        <circle ref={tw} cx="100" cy="62" r="24" fill="none" stroke="var(--c-vinyl)" strokeWidth="2" style={{ opacity: 0.15 }} />
        {/* woofer */}
        <circle cx="100" cy="212" r="86" fill={`url(#${id}-ring)`} />
        <circle cx="100" cy="212" r="76" fill="#09090b" />
        <g ref={cone}>
          <circle cx="100" cy="212" r="72" fill="#1a1a1e" stroke="#2c2c32" strokeWidth="3" />
          <circle cx="100" cy="212" r="64" fill={`url(#${id}-cone)`} />
          {[56, 46, 36].map((r) => <circle key={r} cx="100" cy="212" r={r} fill="none" stroke="rgba(255,255,255,.035)" strokeWidth="1" />)}
        </g>
        <g ref={cap}><circle cx="100" cy="212" r="22" fill={`url(#${id}-cap)`} /></g>
        {[[22, 22], [178, 22], [22, 298], [178, 298]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="#3a3a42" />)}
      </svg>
      <span className="engrave spk-tag">{side === 'L' ? 'Left' : 'Right'} · 2-way</span>
    </div>
  );
}
