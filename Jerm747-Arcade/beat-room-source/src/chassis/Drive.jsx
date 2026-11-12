// 747 Drive panel: the master character stage. On/off, four starting modes, drive / iron /
// warmth / output, an AIR button (off, +3, +6) and GLUE with a gain-reduction LED.
import { useRef } from 'react';
import * as drive from '../engine/character.js';
import { blip } from '../engine/audio.js';
import { Knob, Led, useExternal, useRaf, fmtPct, useFold } from '../ui/parts.jsx';

const C = 'var(--c-drive)';
export default function Drive() {
  const st = useExternal(drive.subscribe, drive.get);
  const gr = useRef(null);
  const [folded, toggleFold] = useFold('drive');
  useRaf(() => {
    const el = gr.current; if (!el) return;
    const r = Math.min(1, Math.abs(drive.reduction()) / 6);
    el.style.setProperty('--gr', r.toFixed(3));
  });
  const k = (key, label, fmt = fmtPct) => (
    <Knob size="sm" label={label} value={st[key]} max={1} def={drive.MODES[st.mode]?.[key] ?? 0} onChange={(v) => drive.set({ [key]: v })} format={fmt} color={C} />
  );
  return (
    <div className={`util drive ${st.on ? 'on' : ''} ${folded ? 'folded' : ''}`}>
      <div className="util-head">
        <span className="engrave"><span className="sec-dot sm" style={{ background: C }} />747 Drive</span>
        <button type="button" className={`switch ${st.on ? 'on' : ''}`} aria-pressed={st.on} onClick={() => { blip(st.on ? 330 : 880); drive.setOn(!st.on); }}><Led on={st.on} color={C} />{st.on ? 'In' : 'Out'}</button>
        <button type="button" className="mini drive-fold" onClick={() => { blip(folded ? 880 : 440); toggleFold(); }} aria-expanded={!folded} aria-label={folded ? 'Show 747 Drive controls' : 'Minimize 747 Drive'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{folded ? <path d="M6 9l6 6 6-6" /> : <path d="M5 12h14" />}</svg>
        </button>
      </div>
      <div className="drive-modes" role="radiogroup" aria-label="Drive mode">
        {Object.entries(drive.MODES).map(([id, m]) => (
          <button key={id} type="button" role="radio" aria-checked={st.mode === id} className={`drive-mode ${st.mode === id ? 'sel' : ''}`} onClick={() => { blip(600); drive.setMode(id); }}>{m.name}</button>
        ))}
      </div>
      <div className="drive-body">
        <div className="knob-row drive-knobs">
          {k('drive', 'Drive')}
          {k('iron', 'Iron')}
          {k('warmth', 'Warmth')}
          <Knob size="sm" label="Output" value={st.out} min={-0.5} max={0.5} def={0} bipolar onChange={(v) => drive.set({ out: v })} format={(v) => `${v > 0 ? '+' : ''}${(v * 12).toFixed(1)}dB`} color={C} />
        </div>
        <div className="drive-btns">
          <button type="button" className={`drive-key ${st.air ? 'lit' : ''}`} aria-pressed={!!st.air} onClick={() => { blip(1200); drive.set({ air: (st.air + 1) % drive.AIR_STEPS.length, on: true }); }}>
            <Led on={!!st.air} color={C} />Air<em>{st.air ? `+${st.air * 3}dB` : 'off'}</em>
          </button>
          <button type="button" className={`drive-key ${st.glue ? 'lit' : ''}`} aria-pressed={st.glue} onClick={() => { blip(500); drive.set({ glue: !st.glue, on: true }); }}>
            <Led on={st.glue} color={C} />Glue<em ref={gr} className="gr" aria-hidden="true"><i /></em>
          </button>
        </div>
      </div>
    </div>
  );
}
