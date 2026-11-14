// Keyboard synth: three oscillators, amp ADSR, a 3-band EQ, patch memory with a layer slot, an oscilloscope,
// and a keyboard that sizes itself to the room (one octave upright, two across, three when the
// panel is full screen and wide). Plays from touch/mouse (slide across keys), the computer
// keyboard (A–K row, Z/X for octave), or a MIDI keyboard.
// Every panel can fold down to a one-line bar (patch, each oscillator, ADSR, EQ), and the
// oscillators can sit as a stack of three or as one panel with tabs. The layout is remembered.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as synth from '../engine/synth.js';
import * as midi from '../engine/midi.js';
import * as lane from '../engine/notes.js';
import ClickCtl from '../ui/ClickCtl.jsx';
import { saveFile } from '../engine/export.js';
import * as pads from '../engine/pads.js';
import { onStep, onRun, getBpm } from '../engine/clock.js';
import { blip } from '../engine/audio.js';
import { Knob, Led, useExternal, useRaf, fmtPct, fmtDb, useFullscreen, FullBtn, useFold, FoldBtn } from '../ui/parts.jsx';

const C = 'var(--c-synth)';
const OCT_KEY = 'beatroom.synth.oct';
const SIZE_KEY = 'beatroom.synth.size';
const VIEW_KEY = 'beatroom.synth.view';
const VIEW0 = { compact: false, scopeDown: false, patch: false, osc: [false, false, false], oscView: 'stack', tab: 0, env: false, eq: false };
const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
const WaveIco = {
  sawtooth: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 18 L12 6 V18 L22 6" /></svg>,
  square: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 18 V6 H12 V18 H22 V6" /></svg>,
  sine: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12 C5 2 9 2 12 12 S19 22 22 12" /></svg>,
};
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const fmtSec = (s) => (s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(2)}s`);
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export default function Synth() {
  const patch = useExternal(synth.subscribe, synth.getPatch);
  const [fsRef, full, toggleFull] = useFullscreen();
  const [folded, toggleFold] = useFold('synth');
  const [view, setViewState] = useState(() => ({ ...VIEW0, ...store.get(VIEW_KEY, {}) }));
  const setView = (change) => setViewState((v) => { const n = { ...v, ...change }; store.set(VIEW_KEY, n); return n; });
  const foldOsc = (i) => setView({ osc: view.osc.map((m, k) => (k === i ? !m : m)) });
  useEffect(() => () => synth.allOff(), []);
  const compact = view.compact;
  const tabs = view.oscView === 'tabs';
  return (
    <section ref={fsRef} className={`section synth-section ${full ? 'is-full' : ''} ${folded && !full ? 'is-folded' : ''} ${compact ? 'synth-compact' : ''}`} aria-labelledby="synth-h">
      <header className="sec-head"><h2 id="synth-h"><span className="sec-dot" style={{ background: C }} />Keyboard synth</h2><p>Three oscillators, ADSR, EQ, patches. Plays from touch, keys or MIDI.</p><span className="sec-tools"><button type="button" className={`switch ${compact ? 'on' : ''}`} aria-pressed={compact} onClick={() => setView({ compact: !compact })}>{compact ? 'All controls' : 'Compact'}</button><FoldBtn folded={folded} onClick={() => { blip(folded ? 880 : 440); toggleFold(); }} label="Keyboard synth" /><FullBtn full={full} onClick={toggleFull} label="Keyboard synth" /></span></header>
      <div className="synth">
        {compact ? <div className="synth-compact-top">
          <Scope compact />
          <div className="synth-preset-read"><span className="engrave">Preset</span><strong role="status">{patch.dirty || !patch.from ? 'Custom' : patch.name}</strong></div>
          <div className="synth-osc-summary" aria-label="Oscillators">
            {patch.osc.map((o, i) => <span key={i} className={o.on ? 'on' : ''}><Led on={o.on} color={C} />Osc {i + 1} · {synth.WAVE_NAMES[o.wave]}</span>)}
          </div>
        </div> : <>
        <div className={`synth-top ${view.patch ? 'patch-folded' : ''} ${view.scopeDown ? 'scope-away' : ''}`}>
          {view.scopeDown
            ? <ScopeBtn up onClick={() => setView({ scopeDown: false })} />
            : <Scope />}
          <PatchPanel patch={patch} min={view.patch} onFold={() => setView({ patch: !view.patch })} />
        </div>
        <div className="osc-bar">
          <span className="engrave">Oscillators</span>
          <div className="seg" role="radiogroup" aria-label="Oscillator view">
            <button type="button" role="radio" aria-checked={!tabs} className={`switch ${!tabs ? 'on' : ''}`} onClick={() => setView({ oscView: 'stack' })}>Stack</button>
            <button type="button" role="radio" aria-checked={tabs} className={`switch ${tabs ? 'on' : ''}`} onClick={() => setView({ oscView: 'tabs' })}>Tabs</button>
          </div>
          {!tabs && <button type="button" className="switch" onClick={() => setView({ osc: view.osc.every(Boolean) ? [false, false, false] : [true, true, true] })}>{view.osc.every(Boolean) ? 'Open all' : 'Fold all'}</button>}
        </div>
        <div className={`synth-mods ${tabs ? 'tabbed' : 'stacked'}`}>
          {tabs ? (
            <OscTabs oscs={patch.osc} tab={view.tab} onTab={(t) => setView({ tab: t })} />
          ) : (
            <div className="osc-stack">
              {patch.osc.map((o, i) => <Osc key={i} i={i} o={o} min={view.osc[i]} onFold={() => foldOsc(i)} />)}
            </div>
          )}
          <div className="fx-stack">
            <Env env={patch.env} vol={patch.vol} min={view.env} onFold={() => setView({ env: !view.env })} />
            <Eq eq={patch.eq} min={view.eq} onFold={() => setView({ eq: !view.eq })} />
          </div>
        </div>
        </>}
        <Keys full={full} scope={!compact && view.scopeDown ? <Scope compact /> : null} scopeBtn={compact || view.scopeDown ? null : <ScopeBtn onClick={() => setView({ scopeDown: true })} />} />
        {!compact && <NoteLane />}
      </div>
    </section>
  );
}

/** Round scope button: moves the oscilloscope between the top and the keyboard. */
function ScopeBtn({ up = false, onClick }) {
  return (
    <button type="button" className={`scope-btn ${up ? 'up' : ''}`} onClick={() => { blip(up ? 990 : 660); onClick(); }}
      aria-label={up ? 'Move the scope back to the top' : 'Move the scope down by the keyboard'} title={up ? 'Scope to top' : 'Scope by the keys'}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="15" className="sb-face" />
        <path d="M5 11h22M5 16h22M5 21h22M11 4v24M16 4v24M21 4v24" className="sb-grid" />
        <path d="M4 16 C7 7 10 7 12.5 16 S18 25 20.5 16 S25 7 28 16" className="sb-wave" />
      </svg>
      {up && <span>Scope</span>}
    </button>
  );
}

/** Fold / unfold chevron for a panel head. */
function Fold({ min, onClick, label }) {
  return (
    <button type="button" className="mini fold-btn" onClick={onClick} aria-expanded={!min} aria-label={`${min ? 'Expand' : 'Minimize'} ${label}`} title={min ? 'Expand' : 'Minimize'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{min ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}</svg>
    </button>
  );
}
const fmtSt = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`;
const fmtCt = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}c`;

// ---------- oscilloscope ----------
function Scope({ compact = false }) {
  const cv = useRef(null), buf = useRef(null), gain = useRef(1);
  const notes = useExternal(synth.onNotes, synth.getNotes);
  useRaf(() => {
    const c = cv.current; if (!c) return;
    const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    // graticule
    x.strokeStyle = 'rgba(143,201,106,.12)'; x.lineWidth = 1; x.beginPath();
    for (let i = 1; i < 8; i++) { const px = Math.round((w * i) / 8) + 0.5; x.moveTo(px, 0); x.lineTo(px, h); }
    for (let i = 1; i < 4; i++) { const py = Math.round((h * i) / 4) + 0.5; x.moveTo(0, py); x.lineTo(w, py); }
    x.stroke();
    const an = synth.analyser();
    const css = getComputedStyle(c).getPropertyValue('--c-synth').trim() || '#8fc96a';
    x.strokeStyle = css; x.lineWidth = 2; x.shadowColor = css; x.shadowBlur = 8; x.beginPath();
    if (!an) { x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); x.shadowBlur = 0; return; }
    if (!buf.current || buf.current.length !== an.fftSize) buf.current = new Float32Array(an.fftSize);
    const b = buf.current; an.getFloatTimeDomainData(b);
    const N = b.length >> 1;
    let start = 0, peak = 0;
    for (let i = 1; i < N; i++) if (b[i - 1] < 0 && b[i] >= 0) { start = i; break; } // rising-edge trigger keeps it still
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(b[start + i]));
    const target = peak > 0.01 ? Math.min(8, 0.85 / peak) : gain.current;
    gain.current += (target - gain.current) * 0.15;
    for (let i = 0; i < N; i++) {
      const px = (i / (N - 1)) * w, py = h / 2 - b[start + i] * gain.current * (h / 2);
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.stroke(); x.shadowBlur = 0;
  });
  const top = notes.length ? notes[notes.length - 1] : null;
  return (
    <div className={`scope ${compact ? 'compact' : ''}`}>
      <canvas ref={cv} aria-label="Oscilloscope" role="img" />
      <div className="scope-read">
        <span>{top != null ? synth.noteName(top) : '—'}</span>
        <span>{top != null ? `${(440 * Math.pow(2, (top - 69) / 12)).toFixed(1)} Hz` : 'Scope'}</span>
        <span>{notes.length ? `${notes.length} voice${notes.length > 1 ? 's' : ''}` : 'Idle'}</span>
      </div>
    </div>
  );
}

// ---------- oscillator ----------
function OscBody({ i, o }) {
  const set = (c) => synth.setOsc(i, c);
  return (
    <>
      <div className="wave-sw" role="radiogroup" aria-label={`Osc ${i + 1} waveform`}>
        {synth.WAVES.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={o.wave === w} className={`wave-btn ${o.wave === w ? 'on' : ''}`} onClick={() => set({ wave: w })}>
            {WaveIco[w]}<span>{synth.WAVE_NAMES[w]}</span>
          </button>
        ))}
      </div>
      <div className="knob-row">
        <Knob size="sm" label="Coarse" value={o.coarse} min={-synth.COARSE} max={synth.COARSE} def={0} bipolar onChange={(v) => set({ coarse: Math.round(v) })} format={fmtSt} color={C} />
        <Knob size="sm" label="Fine" value={o.fine} min={-synth.FINE} max={synth.FINE} def={0} bipolar onChange={(v) => set({ fine: v })} format={fmtCt} color={C} />
        <Knob size="sm" label="Level" value={o.level} max={1} def={0.6} onChange={(v) => set({ level: v })} format={fmtPct} color={C} />
      </div>
    </>
  );
}
const OnSwitch = ({ i, o }) => (
  <button type="button" className={`switch ${o.on ? 'on' : ''}`} aria-pressed={o.on} aria-label={`Osc ${i + 1} ${o.on ? 'on' : 'off'}`} onClick={() => { blip(o.on ? 330 : 660); synth.setOsc(i, { on: !o.on }); }}><Led on={o.on} color={C} />{o.on ? 'On' : 'Off'}</button>
);

function Osc({ i, o, min, onFold }) {
  if (min) {
    return (
      <div className={`panel osc mini-bar ${o.on ? '' : 'off'}`}>
        <span className="engrave">Osc {i + 1}</span>
        <OnSwitch i={i} o={o} />
        <span className="bar-wave" aria-hidden="true">{WaveIco[o.wave]}</span>
        <select value={o.wave} onChange={(e) => synth.setOsc(i, { wave: e.target.value })} aria-label={`Osc ${i + 1} waveform`}>
          {synth.WAVES.map((w) => <option key={w} value={w}>{synth.WAVE_NAMES[w]}</option>)}
        </select>
        <span className="bar-read">{fmtSt(o.coarse)} {fmtCt(o.fine)} · {fmtPct(o.level)}</span>
        <Fold min onClick={onFold} label={`Osc ${i + 1}`} />
      </div>
    );
  }
  return (
    <div className={`panel osc ${o.on ? '' : 'off'}`}>
      <div className="panel-head">
        <span className="engrave">Osc {i + 1}</span>
        <span className="head-tools"><OnSwitch i={i} o={o} /><Fold min={false} onClick={onFold} label={`Osc ${i + 1}`} /></span>
      </div>
      <OscBody i={i} o={o} />
    </div>
  );
}

function OscTabs({ oscs, tab, onTab }) {
  const i = Math.min(2, tab), o = oscs[i];
  return (
    <div className={`panel osc osc-tabs ${o.on ? '' : 'off'}`}>
      <div className="tab-row" role="tablist" aria-label="Oscillators">
        {oscs.map((x, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} className={`tab ${k === i ? 'sel' : ''}`} onClick={() => onTab(k)}>
            <Led on={x.on} color={C} />Osc {k + 1}<span className="tab-wave" aria-hidden="true">{WaveIco[x.wave]}</span>
          </button>
        ))}
        <OnSwitch i={i} o={o} />
      </div>
      <div role="tabpanel" aria-label={`Osc ${i + 1}`}><OscBody i={i} o={o} /></div>
    </div>
  );
}

// ---------- envelope ----------
function EnvGraph({ env }) {
  const W = 120, H = 40;
  const aw = 4 + env.a * 26, dw = 4 + env.d * 26, sw = 24, rw = 4 + env.r * 26, tot = aw + dw + sw + rw, k = W / tot;
  const sy = 4 + (1 - env.s) * (H - 8);
  return <svg className="env-graph" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={`M0 ${H - 2} L${aw * k} 4 L${(aw + dw) * k} ${sy} L${(aw + dw + sw) * k} ${sy} L${W} ${H - 2}`} /></svg>;
}
function Env({ env, vol, min, onFold }) {
  if (min) {
    return (
      <div className="panel env mini-bar">
        <span className="engrave">Amp ADSR</span>
        <EnvGraph env={env} />
        <span className="bar-read">A {fmtSec(synth.envSec('a', env.a))} · D {fmtSec(synth.envSec('d', env.d))} · S {fmtPct(env.s)} · R {fmtSec(synth.envSec('r', env.r))}</span>
        <Fold min onClick={onFold} label="ADSR" />
      </div>
    );
  }
  return (
    <div className="panel env">
      <div className="panel-head"><span className="engrave">Amp ADSR</span><span className="head-tools"><EnvGraph env={env} /><Fold min={false} onClick={onFold} label="ADSR" /></span></div>
      <div className="knob-row env-knobs">
        <Knob size="sm" label="Attack" value={env.a} max={1} def={0.05} onChange={(v) => synth.setEnv({ a: v })} format={(v) => fmtSec(synth.envSec('a', v))} color={C} />
        <Knob size="sm" label="Decay" value={env.d} max={1} def={0.35} onChange={(v) => synth.setEnv({ d: v })} format={(v) => fmtSec(synth.envSec('d', v))} color={C} />
        <Knob size="sm" label="Sustain" value={env.s} max={1} def={0.7} onChange={(v) => synth.setEnv({ s: v })} format={fmtPct} color={C} />
        <Knob size="sm" label="Release" value={env.r} max={1} def={0.3} onChange={(v) => synth.setEnv({ r: v })} format={(v) => fmtSec(synth.envSec('r', v))} color={C} />
        <Knob size="sm" label="Volume" value={vol} max={1} def={0.8} onChange={(v) => synth.setVol(v)} format={fmtPct} color={C} />
      </div>
    </div>
  );
}

// ---------- EQ ----------
const fmtHz = (v) => { const f = synth.midHz(v); return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`; };
function EqGraph({ eq }) {
  // rough response curve: shelves at the ends, a bell at the mid frequency
  const W = 120, H = 40, pts = [];
  const fx = Math.log(synth.midHz(eq.freq) / 20) / Math.log(1000);
  for (let i = 0; i <= 40; i++) {
    const x = i / 40;
    const lowW = 1 / (1 + Math.exp((x - 0.27) * 22)), highW = 1 / (1 + Math.exp(-(x - 0.75) * 22));
    const bell = Math.exp(-Math.pow((x - fx) / 0.11, 2));
    const db = eq.low * lowW + eq.high * highW + eq.mid * bell;
    pts.push(`${(x * W).toFixed(1)} ${(H / 2 - db * (H / 2 - 4)).toFixed(1)}`);
  }
  return <svg className="env-graph eq-graph" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><line x1="0" y1={H / 2} x2={W} y2={H / 2} /><path d={`M${pts.join(' L')}`} /></svg>;
}
function Eq({ eq, min, onFold }) {
  if (min) {
    return (
      <div className="panel eq mini-bar">
        <span className="engrave">EQ</span>
        <EqGraph eq={eq} />
        <span className="bar-read">Low {fmtDb(eq.low)} · Mid {fmtDb(eq.mid)} @ {fmtHz(eq.freq)} · High {fmtDb(eq.high)}</span>
        <Fold min onClick={onFold} label="EQ" />
      </div>
    );
  }
  return (
    <div className="panel eq">
      <div className="panel-head">
        <span className="engrave">EQ</span>
        <span className="head-tools"><EqGraph eq={eq} /><button type="button" className="switch" onClick={() => synth.setEq({ ...synth.FLAT_EQ })}>Flat</button><Fold min={false} onClick={onFold} label="EQ" /></span>
      </div>
      <div className="knob-row eq-knobs">
        <Knob size="sm" label="Low" value={eq.low} min={-1} max={1} def={0} bipolar onChange={(v) => synth.setEq({ low: v })} format={fmtDb} color={C} />
        <Knob size="sm" label="Mid" value={eq.mid} min={-1} max={1} def={0} bipolar onChange={(v) => synth.setEq({ mid: v })} format={fmtDb} color={C} />
        <Knob size="sm" label="Mid freq" value={eq.freq} max={1} def={0.5} onChange={(v) => synth.setEq({ freq: v })} format={(v) => `${fmtHz(v)}Hz`} color={C} />
        <Knob size="sm" label="High" value={eq.high} min={-1} max={1} def={0} bipolar onChange={(v) => synth.setEq({ high: v })} format={fmtDb} color={C} />
      </div>
    </div>
  );
}

// ---------- patches ----------
function PatchPanel({ patch, min, onFold }) {
  const [name, setName] = useState(patch.name);
  const [msg, setMsg] = useState('');
  useEffect(() => { setName(patch.name); }, [patch.from, patch.name]);
  const all = synth.listPatches();
  const factory = all.filter((p) => p.factory), mine = all.filter((p) => !p.factory);
  const isMine = mine.some((p) => p.id === patch.from);
  const save = () => { blip(880); synth.savePatch(name); setMsg(`Saved “${name.trim() || 'My patch'}”.`); };
  const del = () => { if (!isMine) return; blip(220); synth.deletePatch(patch.from); setMsg('Patch deleted. The sound stays on the panel until you load another.'); };
  const opts = (list) => list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.layer ? ' (layered)' : ''}</option>);

  const picker = (
    <select value={patch.from && !patch.dirty ? patch.from : ''} onChange={(e) => { if (e.target.value) { blip(700); synth.loadPatch(e.target.value); setMsg(''); } }} aria-label="Load patch">
        <option value="">{patch.dirty ? `${patch.name} (edited)` : 'Load a patch…'}</option>
        <optgroup label="Factory">{opts(factory)}</optgroup>
        {mine.length > 0 && <optgroup label="My patches">{opts(mine)}</optgroup>}
      </select>
  );
  if (min) {
    return (
      <div className="panel patch-panel mini-bar">
        <span className="engrave">Patch</span>
        {picker}
        {patch.dirty && <span className="bar-read">edited</span>}
        <Fold min onClick={onFold} label="patch" />
      </div>
    );
  }
  return (
    <div className="panel patch-panel">
      <div className="panel-head"><span className="engrave">Patch</span><span className="head-tools"><span className="patch-name">{patch.name}{patch.dirty ? ' *' : ''}</span><Fold min={false} onClick={onFold} label="patch" /></span></div>
      {picker}
      <div className="patch-save">
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-label="Patch name" placeholder="Patch name" />
        <button type="button" className="btn" onClick={save}>Save</button>
        <button type="button" className="btn" onClick={del} disabled={!isMine}>Delete</button>
      </div>
      <div className="layer">
        <span className="engrave">Layer</span>
        <select value={patch.layer?.id || (patch.layer ? '__kept' : '')} onChange={(e) => { blip(600); synth.setLayer(e.target.value === '__kept' ? patch.layer.id : e.target.value); }} aria-label="Layer a second patch">
          <option value="">None</option>
          {patch.layer && !all.some((p) => p.id === patch.layer.id) && <option value="__kept">{patch.layer.name}</option>}
          <optgroup label="Factory">{opts(factory)}</optgroup>
          {mine.length > 0 && <optgroup label="My patches">{opts(mine)}</optgroup>}
        </select>
        {patch.layer && (
          <div className="layer-ctl">
            <Knob size="sm" label="Blend" value={patch.layer.mix} max={1} def={0.5} onChange={(v) => synth.setLayerMix(v)} format={(v) => (Math.abs(v - 0.5) < 0.02 ? 'Even' : v < 0.5 ? `Main ${Math.round((1 - v) * 100)}` : `Layer ${Math.round(v * 100)}`)} color={C} />
            <button type="button" className="btn" onClick={() => { blip(900); synth.flattenLayer(); setMsg('Merged into one 3-osc patch. Save it to keep it.'); }} title="Keep the three strongest oscillators of both sounds">Merge</button>
          </div>
        )}
      </div>
      <p className="hint" role="status" aria-live="polite">{msg || (patch.layer ? 'Layer plays under the panel sound with its own ADSR. Save keeps both.' : 'Pick a second patch under Layer to stack two sounds.')}</p>
    </div>
  );
}

// ---------- keyboard ----------
function Keys({ full, scope, scopeBtn }) {
  const [oct, setOct] = useState(() => store.get(OCT_KEY, 4));
  const [size, setSize] = useState(() => store.get(SIZE_KEY, 'auto'));
  const [autoOcts, setAutoOcts] = useState(1);
  const notes = useExternal(synth.onNotes, synth.getNotes);
  const status = useExternal(midi.subscribe, midi.getStatus);
  const wrap = useRef(null), ptr = useRef(new Map()), held = useRef(new Map());
  const live = useRef({}); live.current = { oct };

  useEffect(() => {
    const el = wrap.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setAutoOcts(w < 560 ? 1 : w < 1100 || !full ? 2 : 3); });
    ro.observe(el); return () => ro.disconnect();
  }, [full]);
  const octs = size === 'auto' ? autoOcts : size;
  const maxOct = 8 - octs;
  const base = Math.min(oct, maxOct);
  const lo = 12 * (base + 1), hi = lo + 12 * octs;
  const keys = useMemo(() => {
    const list = []; let w = 0;
    for (let n = lo; n <= hi; n++) { const black = synth.isBlack(n); list.push({ n, black, wi: black ? w - 1 : w }); if (!black) w++; }
    return { list, whites: w };
  }, [lo, hi]);
  const on = new Set(notes);

  const shift = (d) => { blip(d > 0 ? 880 : 440); const v = Math.max(0, Math.min(maxOct, base + d)); setOct(v); store.set(OCT_KEY, v); };
  const pickSize = (v) => { blip(700); setSize(v); store.set(SIZE_KEY, v); };

  // computer keyboard: A W S E D F T G Y H U J K O L P ; '  ·  Z / X octave
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { shift(-1); return; }
      if (k === 'x') { shift(1); return; }
      if (!(k in KEYMAP) || held.current.has(k)) return;
      const n = 12 * (live.current.oct + 1) + KEYMAP[k];
      held.current.set(k, n); synth.noteOn(n, 0.8); e.preventDefault();
    };
    const up = (e) => { const k = e.key.toLowerCase(), n = held.current.get(k); if (n == null) return; held.current.delete(k); synth.noteOff(n); };
    const blur = () => { held.current.forEach((n) => synth.noteOff(n)); held.current.clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // touch / mouse: press, slide across keys (glissando), lift. Lower on the key = louder.
  const keyAt = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-note]');
    if (!el || !wrap.current?.contains(el)) return null;
    const r = el.getBoundingClientRect();
    return { n: +el.dataset.note, vel: 0.45 + 0.55 * Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const pDown = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); const k = keyAt(e); if (!k) return; ptr.current.set(e.pointerId, k.n); synth.noteOn(k.n, k.vel); };
  const pMove = (e) => {
    if (!ptr.current.has(e.pointerId)) return;
    const k = keyAt(e), prev = ptr.current.get(e.pointerId);
    if (!k || k.n === prev) return;
    synth.noteOff(prev); ptr.current.set(e.pointerId, k.n); synth.noteOn(k.n, k.vel);
  };
  const pUp = (e) => { const n = ptr.current.get(e.pointerId); if (n == null) return; ptr.current.delete(e.pointerId); synth.noteOff(n); };

  const wp = 100 / keys.whites;
  const midiOn = status.state === 'on' || status.state === 'wait';

  return (
    <div className="kb">
      <div className="kb-bar">
        {scopeBtn}
        <div className="oct" role="group" aria-label="Octave">
          <button type="button" className="btn" onClick={() => shift(-1)} disabled={base <= 0} aria-label="Octave down">−</button>
          <span className="oct-lcd"><b>C{base}</b>oct</span>
          <button type="button" className="btn" onClick={() => shift(1)} disabled={base >= maxOct} aria-label="Octave up">+</button>
        </div>
        <div className="kb-size" role="radiogroup" aria-label="Keyboard size">
          {[['auto', 'Auto'], [1, '1 oct'], [2, '2 oct'], [3, '3 oct']].map(([v, l]) => (
            <button key={l} type="button" role="radio" aria-checked={size === v} className={`switch ${size === v ? 'on' : ''}`} onClick={() => pickSize(v)}>{l}</button>
          ))}
        </div>

      </div>
      {scope}
      <div ref={wrap} className="sy-keys" style={{ '--whites': keys.whites }} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp} onLostPointerCapture={pUp} onContextMenu={(e) => e.preventDefault()}>
        {keys.list.map(({ n, black, wi }) => (
          <div key={n} data-note={n} role="button" tabIndex={-1} aria-label={synth.noteName(n)} aria-pressed={on.has(n)}
            className={`pk ${black ? 'pk-b' : 'pk-w'} ${on.has(n) ? 'down' : ''}`}
            style={black ? { left: `${(wi + 1) * wp}%`, width: `${wp * 0.62}%` } : undefined}>
            {!black && n % 12 === 0 && <em>{synth.noteName(n)}</em>}
          </div>
        ))}
      </div>
      <div className="midi-bar" role="group" aria-label="MIDI connections">
        <button type="button" className={`btn midi-btn ${midiOn ? 'active' : ''}`} aria-pressed={midiOn} onClick={() => { blip(760); midiOn ? midi.disconnect() : midi.connect(); }}>
          <Led on={status.state === 'on' && status.devices.length > 0} color={C} />MIDI
        </button>
        {midi.bluetoothSupported() && <button type="button" className="btn midi-btn" onClick={midi.connectBluetooth}>Bluetooth MIDI</button>}
        <span className="midi-status" role="status" aria-live="polite">{status.msg || (status.devices.length ? status.devices.join(', ') : `${keys.list.length} keys · A–K plays · Z/X octave`)}</span>
      </div>
    </div>
  );
}

// ---------- note lane ----------
// Record what you play into the section you're editing, then it plays with the song.
function NoteLane() {
  const v = useExternal(lane.subscribe, lane.get);
  const playing = useExternal(onRun, pads.isPlaying);
  const [pick, setPick] = useState(-1);
  const [laneMsg, setLaneMsg] = useState('');
  const head = useRef(null), midiFile = useRef(null);
  async function importMidi(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const r = lane.importMidi(await f.arrayBuffer());
      blip(1000);
      setLaneMsg(`${r.name || f.name}: ${r.count} note${r.count === 1 ? '' : 's'}, ${r.bars} bar${r.bars === 1 ? '' : 's'}, section set to ${r.len} steps${r.dropped ? ` (${r.dropped} past step 64 left out)` : ''}${r.fileBpm && Math.round(r.fileBpm) !== getBpm() ? `. The file was at ${Math.round(r.fileBpm)} BPM` : ''}. Undo puts the old notes back.`);
    } catch (err) { setLaneMsg(err.message || 'That MIDI file could not be read.'); }
  }
  async function exportMidi() {
    const blob = lane.exportMidi(); if (!blob) return;
    blip(1100);
    try { await saveFile(`Beat Room ${pads.SECTIONS[v.edit]} notes`, 'mid', blob); setLaneMsg(`Saved Beat Room ${pads.SECTIONS[v.edit]} notes.mid.`); }
    catch (err) { setLaneMsg(/preview page|can’t save files/.test(err.message) ? 'This preview page can’t save .mid files. Your own Beat Room build and the app save them.' : err.message); }
  }
  useEffect(() => { setPick(-1); }, [v.edit, v.notes.length]);
  useEffect(() => onStep((i, abs) => {
    const el = head.current; if (!el) return;
    const m = i >= 0 && pads.isPlaying() ? pads.posAt(abs) : null;
    if (!m || m.sec !== pads.getEdit()) { el.style.opacity = 0; return; }
    el.style.opacity = 1; el.setAttribute('x', ((m.pos / m.len) * 1000).toFixed(1));
  }), []);
  const notes = v.notes, len = v.len;
  const lo = notes.length ? Math.min(...notes.map((n) => n.n)) - 2 : 58, hi = notes.length ? Math.max(...notes.map((n) => n.n)) + 2 : 74;
  const span = Math.max(12, hi - lo), H = 120, rowH = H / (span + 1);
  const y = (n) => H - (n - lo + 1) * rowH;
  const recLbl = v.rec === 'armed' ? 'Ready' : v.rec === 'rec' ? 'Rec ●' : 'Rec';
  return (
    <div className={`panel lane ${v.rec}`}>
      <div className="lane-head">
        <span className="engrave">Note lane · Section {pads.SECTIONS[v.edit]} · {notes.length} note{notes.length === 1 ? '' : 's'}</span>
        <div className="lane-btns">
          <button type="button" className={`btn rec-btn ${v.rec}`} aria-pressed={v.rec !== 'off'} onClick={() => { blip(v.rec === 'off' ? 990 : 330); lane.toggleRec(); }}
            title="Record one pass of the section from the keys or MIDI"><Led on={v.rec === 'rec'} color="#ff4b3a" />{recLbl}</button>
          <ClickCtl compact />
          <button type="button" className={`switch ${v.on ? 'on' : ''}`} aria-pressed={v.on} onClick={() => { blip(700); lane.setOn(!v.on); }}><Led on={v.on} color={C} />{v.on ? 'Lane on' : 'Lane off'}</button>
          <button type="button" className={`switch ${v.quant ? 'on' : ''}`} aria-pressed={v.quant} onClick={() => { blip(640); lane.setQuant(!v.quant); }} title="Snap starts to the grid while recording"><Led on={v.quant} color={C} />Quantize</button>
          <select className="grid-pick" value={v.grid} onChange={(e) => { blip(660); lane.setGrid(e.target.value); }} aria-label="Quantize grid" title="Grid for Quantize and Snap">
            {Object.keys(lane.GRIDS).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button type="button" className="switch" onClick={() => { blip(800); lane.snap(); }} disabled={!notes.length} title={`Snap every note in this section to ${v.grid} now`}>Snap {v.grid}</button>
          <button type="button" className="switch" onClick={() => { blip(520); lane.undo(); }} disabled={!v.canUndo}>Undo</button>
          <button type="button" className="switch" onClick={() => { blip(330); lane.clear(); }} disabled={!notes.length}>Clear</button>
          <button type="button" className="switch" onClick={() => midiFile.current?.click()} title="Load a .mid phrase into this section">Import MIDI</button>
          <input ref={midiFile} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={importMidi} />
          <button type="button" className="switch" onClick={exportMidi} disabled={!notes.length} title="Save this section's notes as a .mid file">Export MIDI</button>
        </div>
      </div>
      <svg className="roll" viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" role="img" aria-label={`Piano roll, ${notes.length} notes over ${len} steps`}>
        {Array.from({ length: len }, (_, i) => <rect key={i} x={(i / len) * 1000} y="0" width={1000 / len} height={H} className={`roll-col ${Math.floor(i / 4) % 2 ? 'b' : 'a'}`} />)}
        {notes.map((n, k) => (
          <rect key={k} className={`roll-note ${pick === k ? 'pick' : ''}`} x={(n.p / len) * 1000} y={y(n.n)} width={Math.max(4, (n.d / len) * 1000)} height={Math.max(3, rowH - 1)} rx="2"
            style={{ opacity: 0.45 + n.v * 0.55 }} onPointerDown={(e) => { e.stopPropagation(); setPick(k); lane.audition(n); }} />
        ))}
        <rect ref={head} className="roll-head" x="0" y="0" width="3" height={H} style={{ opacity: 0 }} />
      </svg>
      <div className="lane-foot">
        <p className="hint">{laneMsg && v.rec === 'off' && pick < 0 ? laneMsg : v.rec === 'armed' ? (playing ? 'Get ready: the take starts at the top of the section.' : 'Counting in…') : v.rec === 'rec' ? 'Recording this pass. Play the keys or your MIDI keyboard.' : pick >= 0 ? `${synth.noteName(notes[pick].n)} at step ${(notes[pick].p + 1).toFixed(2).replace(/\.00$/, '')}` : notes.length ? 'Plays with the song. REC again to add another take on top.' : 'Press Rec, wait for the count-in, then play. One pass of the section records.'}</p>
        {pick >= 0 && <button type="button" className="btn" onClick={() => { blip(300); lane.remove(pick); setPick(-1); }}>Delete note</button>}
      </div>
    </div>
  );
}
