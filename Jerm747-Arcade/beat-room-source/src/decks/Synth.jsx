// Keyboard synth: three oscillators, amp ADSR, patch memory with a layer slot, an oscilloscope,
// and a keyboard that sizes itself to the room (one octave upright, two across, three when the
// panel is full screen and wide). Plays from touch/mouse (slide across keys), the computer
// keyboard (A–K row, Z/X for octave), or a MIDI keyboard.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as synth from '../engine/synth.js';
import * as midi from '../engine/midi.js';
import { blip } from '../engine/audio.js';
import { Knob, Led, useExternal, useRaf, fmtPct, useFullscreen, FullBtn } from '../ui/parts.jsx';

const C = 'var(--c-synth)';
const OCT_KEY = 'beatroom.synth.oct';
const SIZE_KEY = 'beatroom.synth.size';
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
  useEffect(() => () => synth.allOff(), []);
  return (
    <section ref={fsRef} className={`section synth-section ${full ? 'is-full' : ''}`} aria-labelledby="synth-h">
      <header className="sec-head"><h2 id="synth-h"><span className="sec-dot" style={{ background: C }} />Keyboard synth</h2><p>Three oscillators, ADSR, patches. Plays from touch, keys or MIDI.</p><FullBtn full={full} onClick={toggleFull} label="Keyboard synth" /></header>
      <div className="synth">
        <div className="synth-top">
          <Scope />
          <PatchPanel patch={patch} />
        </div>
        <div className="synth-mods">
          {patch.osc.map((o, i) => <Osc key={i} i={i} o={o} />)}
          <Env env={patch.env} vol={patch.vol} />
        </div>
        <Keys full={full} />
      </div>
    </section>
  );
}

// ---------- oscilloscope ----------
function Scope() {
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
    <div className="scope">
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
function Osc({ i, o }) {
  const set = (c) => synth.setOsc(i, c);
  return (
    <div className={`panel osc ${o.on ? '' : 'off'}`}>
      <div className="panel-head">
        <span className="engrave">Osc {i + 1}</span>
        <button type="button" className={`switch ${o.on ? 'on' : ''}`} aria-pressed={o.on} onClick={() => { blip(o.on ? 330 : 660); set({ on: !o.on }); }}><Led on={o.on} color={C} />{o.on ? 'On' : 'Off'}</button>
      </div>
      <div className="wave-sw" role="radiogroup" aria-label={`Osc ${i + 1} waveform`}>
        {synth.WAVES.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={o.wave === w} className={`wave-btn ${o.wave === w ? 'on' : ''}`} onClick={() => set({ wave: w })}>
            {WaveIco[w]}<span>{synth.WAVE_NAMES[w]}</span>
          </button>
        ))}
      </div>
      <div className="knob-row">
        <Knob size="sm" label="Coarse" value={o.coarse} min={-synth.COARSE} max={synth.COARSE} def={0} bipolar onChange={(v) => set({ coarse: Math.round(v) })} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`} color={C} />
        <Knob size="sm" label="Fine" value={o.fine} min={-synth.FINE} max={synth.FINE} def={0} bipolar onChange={(v) => set({ fine: v })} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}c`} color={C} />
        <Knob size="sm" label="Level" value={o.level} max={1} def={0.6} onChange={(v) => set({ level: v })} format={fmtPct} color={C} />
      </div>
    </div>
  );
}

// ---------- envelope ----------
function Env({ env, vol }) {
  const W = 120, H = 40;
  const aw = 4 + env.a * 26, dw = 4 + env.d * 26, sw = 24, rw = 4 + env.r * 26, tot = aw + dw + sw + rw, k = W / tot;
  const sy = 4 + (1 - env.s) * (H - 8);
  const d = `M0 ${H - 2} L${aw * k} 4 L${(aw + dw) * k} ${sy} L${(aw + dw + sw) * k} ${sy} L${W} ${H - 2}`;
  return (
    <div className="panel env">
      <div className="panel-head"><span className="engrave">Amp ADSR</span><svg className="env-graph" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={d} /></svg></div>
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

// ---------- patches ----------
function PatchPanel({ patch }) {
  const [name, setName] = useState(patch.name);
  const [msg, setMsg] = useState('');
  useEffect(() => { setName(patch.name); }, [patch.from, patch.name]);
  const all = synth.listPatches();
  const factory = all.filter((p) => p.factory), mine = all.filter((p) => !p.factory);
  const isMine = mine.some((p) => p.id === patch.from);
  const save = () => { blip(880); synth.savePatch(name); setMsg(`Saved “${name.trim() || 'My patch'}”.`); };
  const del = () => { if (!isMine) return; blip(220); synth.deletePatch(patch.from); setMsg('Patch deleted. The sound stays on the panel until you load another.'); };
  const opts = (list) => list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.layer ? ' (layered)' : ''}</option>);

  return (
    <div className="panel patch-panel">
      <div className="panel-head"><span className="engrave">Patch</span><span className="patch-name">{patch.name}{patch.dirty ? ' *' : ''}</span></div>
      <select value={patch.from && !patch.dirty ? patch.from : ''} onChange={(e) => { if (e.target.value) { blip(700); synth.loadPatch(e.target.value); setMsg(''); } }} aria-label="Load patch">
        <option value="">{patch.dirty ? `${patch.name} (edited)` : 'Load a patch…'}</option>
        <optgroup label="Factory">{opts(factory)}</optgroup>
        {mine.length > 0 && <optgroup label="My patches">{opts(mine)}</optgroup>}
      </select>
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
function Keys({ full }) {
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
        <button type="button" className={`btn midi-btn ${midiOn ? 'active' : ''}`} aria-pressed={midiOn} onClick={() => { blip(760); midiOn ? midi.disconnect() : midi.connect(); }}>
          <Led on={status.state === 'on' && status.devices.length > 0} color={C} />MIDI
        </button>
        <span className="midi-status" role="status" aria-live="polite">{status.msg || (status.devices.length ? status.devices.join(', ') : `${keys.list.length} keys · A–K plays · Z/X octave`)}</span>
      </div>
      <div ref={wrap} className="keys" style={{ '--whites': keys.whites }} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp} onLostPointerCapture={pUp} onContextMenu={(e) => e.preventDefault()}>
        {keys.list.map(({ n, black, wi }) => (
          <div key={n} data-note={n} role="button" tabIndex={-1} aria-label={synth.noteName(n)} aria-pressed={on.has(n)}
            className={`pk ${black ? 'pk-b' : 'pk-w'} ${on.has(n) ? 'down' : ''}`}
            style={black ? { left: `${(wi + 1) * wp}%`, width: `${wp * 0.62}%` } : undefined}>
            {!black && n % 12 === 0 && <em>{synth.noteName(n)}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}
