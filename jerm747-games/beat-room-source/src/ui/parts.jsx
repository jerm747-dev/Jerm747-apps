// Shared hardware parts so every section looks like it came off the same production line.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as library from '../engine/library.js';

export const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const Screws = () => <><span className="screw" /><span className="screw" /><span className="screw" /><span className="screw" /></>;
export const Led = ({ on, color }) => <span className={`led ${on ? 'on' : ''}`} style={color ? { '--led': color } : undefined} />;

export const Ico = {
  rew: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 6v12L2 12zm11 0v12l-9-6z" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>,
  ff: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v12l9-6zM2 6v12l9-6z" /></svg>,
  stop: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>,
  rec: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6.5" /></svg>,
  loop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1" /></svg>,
};

/** Library clips as React state. */
export function useLibrary() {
  return useSyncExternalStore(library.subscribe, library.list, library.list);
}

/** requestAnimationFrame loop that always sees the latest callback. */
export function useRaf(fn) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (now) => { const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; ref.current(dt, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/**
 * Rotary knob. Drag up/down, scroll, or use arrow keys. Double-click resets.
 * bipolar knobs light the arc from 12 o'clock (for EQ cut/boost).
 */
export function Knob({ label, value, onChange, min = 0, max = 1, def = min, bipolar = false, format, size = 'md', color }) {
  const drag = useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const span = max - min, f = (value - min) / span;
  const ang = -135 + f * 270;
  const r = 15, cx = 20, cy = 20;
  const pt = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const from = bipolar ? 0 : -135;
  const [a0, a1] = from < ang ? [from, ang] : [ang, from];
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  const arc = Math.abs(a1 - a0) > 0.5 ? `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}` : '';
  const [bx0, by0] = pt(-135), [bx1, by1] = pt(135);
  const text = format ? format(value) : value.toFixed(2);

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; };
  const move = (e) => { if (!drag.current) return; const fine = e.shiftKey ? 600 : 160; onChange(clamp(drag.current.v + ((drag.current.y - e.clientY) / fine) * span)); };
  const up = () => { drag.current = null; };
  const key = (e) => {
    const st = span / (e.shiftKey ? 100 : 20);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { onChange(clamp(value + st)); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { onChange(clamp(value - st)); e.preventDefault(); }
    if (e.key === 'Home') onChange(min); if (e.key === 'End') onChange(max);
  };
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const wheel = (e) => { e.preventDefault(); onChange(clamp(value - Math.sign(e.deltaY) * span / 40)); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  return (
    <div className={`knob knob-${size}`} style={color ? { '--knob': color } : undefined}>
      <div ref={ref} className="knob-cap" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number(value.toFixed(3))} aria-valuetext={text}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} onDoubleClick={() => onChange(def)}>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d={`M${bx0} ${by0} A${r} ${r} 0 1 1 ${bx1} ${by1}`} className="knob-track" />
          {arc && <path d={arc} className="knob-arc" />}
          <circle cx="20" cy="20" r="10.5" className="knob-body" />
          <line x1="20" y1="20" x2="20" y2="11.5" className="knob-mark" transform={`rotate(${ang} 20 20)`} />
        </svg>
      </div>
      <span className="knob-label">{label}</span>
      <output className="knob-val">{text}</output>
    </div>
  );
}

export const fmtDb = (v) => `${v > 0 ? '+' : ''}${(v * 12).toFixed(1)}dB`;
export const fmtPct = (v) => `${Math.round(v * 100)}%`;

/** Small hook: state that mirrors an external subscribe(fn) + getter. */
export function useExternal(subscribe, get) {
  const [v, setV] = useState(get);
  useEffect(() => subscribe(() => setV(get())), []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}
