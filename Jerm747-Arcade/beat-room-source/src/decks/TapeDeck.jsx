// The cassette deck from Returnity, turned into a sampler. REC opens the mic and records a take
// into the library; PLAY runs the take through the tape character chain (wow, flutter,
// saturation, low/high shelf); PRINT bakes that sound into a new clip; SEND puts the clip on the
// sequencer's Tape row. Rew / FF step through the library like tracks on a tape.
import { useEffect, useRef, useState } from 'react';
import { audio, out, blip, level, ready } from '../engine/audio.js';
import { buildTapeChain, printTape, TAPE_DEFAULTS } from '../engine/tapefx.js';
import { startRecording, micAnalyser, micError, releaseMic } from '../engine/mic.js';
import * as library from '../engine/library.js';
import * as pads from '../engine/pads.js';
import { Screws, Led, Ico, Knob, useLibrary, useRaf, reduce, fmtDb, fmtPct, useFullscreen, FullBtn } from '../ui/parts.jsx';

const MAX_REC = 30; // seconds
const FX_KEY = 'beatroom.tape';
const loadFx = () => { try { return { ...TAPE_DEFAULTS, ...JSON.parse(localStorage.getItem(FX_KEY)) }; } catch { return { ...TAPE_DEFAULTS }; } };

// one live chain for the deck, built on first use
let deck = null;
function getDeck(fx) {
  if (!deck) {
    const ac = audio();
    const chain = buildTapeChain(ac, fx);
    const an = ac.createAnalyser(); an.fftSize = 1024;
    const dry = ac.createGain(); // bypass path when the character switch is off
    const wet = ac.createGain();
    const sum = ac.createGain();
    dry.connect(sum); chain.output.connect(wet).connect(sum);
    sum.connect(an).connect(out());
    deck = { chain, an, dry, wet, src: null };
  }
  return deck;
}

export default function TapeDeck() {
  const clips = useLibrary();
  const [curId, setCurId] = useState(null);
  const [mode, setMode] = useState('idle'); // idle | arming | rec | play
  const [fx, setFx] = useState(loadFx);
  const [fxOn, setFxOn] = useState(true);
  const [loop, setLoop] = useState(false);
  const [winding, setWinding] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [counter, setCounter] = useState('000');
  const cur = clips.find((c) => c.id === curId) || clips[clips.length - 1] || null;
  const curIdx = cur ? clips.indexOf(cur) : -1;

  const recRef = useRef(null);
  const t0 = useRef(0);
  const refs = { reelL: useRef(null), reelR: useRef(null), tapeL: useRef(null), tapeR: useRef(null), nL: useRef(null), nR: useRef(null) };
  const anim = useRef({ ang: 0, lv: [0, 0], mic: null });
  const live = useRef({}); live.current = { mode, winding, cur, loop };
  const [fsRef, full, toggleFull] = useFullscreen();

  useEffect(() => { library.loadAll(); }, []);
  useEffect(() => {
    try { localStorage.setItem(FX_KEY, JSON.stringify(fx)); } catch { /* storage off */ }
    deck?.chain.update(fx);
  }, [fx]);
  useEffect(() => {
    if (!deck) return; const now = audio().currentTime;
    deck.wet.gain.setTargetAtTime(fxOn ? 1 : 0, now, 0.02); deck.dry.gain.setTargetAtTime(fxOn ? 0 : 1, now, 0.02);
  }, [fxOn]);
  useEffect(() => { if (deck?.src) deck.src.loop = loop; }, [loop]);
  useEffect(() => () => { stopPlay(); recRef.current?.stop().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useRaf((dt, now) => {
    const L = live.current, A = anim.current;
    const ac = ready() ? audio() : null;
    const moving = L.winding || (L.mode === 'play' || L.mode === 'rec' ? 1 : 0);
    if (moving && !reduce()) A.ang += moving * dt * 220;
    let f = 0, secs = 0;
    if (L.mode === 'rec' && ac) { secs = ac.currentTime - t0.current; f = Math.min(1, secs / MAX_REC); if (secs >= MAX_REC) stopRec(); }
    else if (L.mode === 'play' && ac && L.cur) { const d = L.cur.duration; secs = (ac.currentTime - t0.current); if (L.loop) secs %= d; f = Math.min(1, secs / d); }
    const rl = 28 + 16 * (1 - f), rr = 28 + 16 * f;
    refs.tapeL.current?.setAttribute('r', rl.toFixed(1)); refs.tapeR.current?.setAttribute('r', rr.toFixed(1));
    if (refs.reelL.current) refs.reelL.current.style.transform = `rotate(${A.ang * 44 / rl}deg)`;
    if (refs.reelR.current) refs.reelR.current.style.transform = `rotate(${A.ang * 44 / rr}deg)`;
    const src = L.mode === 'rec' ? A.mic : L.mode === 'play' ? deck?.an : null;
    const v = src ? level(src) : 0;
    const target = [v, v * (0.92 + Math.random() * 0.08)];
    A.lv = A.lv.map((l, i) => l + (target[i] - l) * (target[i] > l ? 0.5 : 0.12));
    if (refs.nL.current) refs.nL.current.style.transform = `rotate(${-48 + A.lv[0] * 96}deg)`;
    if (refs.nR.current) refs.nR.current.style.transform = `rotate(${-48 + A.lv[1] * 96}deg)`;
    const c = String(Math.floor(secs) % 1000).padStart(3, '0');
    if (c !== counter) setCounter(c);
  });

  function stopPlay() {
    if (deck?.src) { try { deck.src.onended = null; deck.src.stop(); } catch { /* ended */ } deck.src = null; }
  }
  function startPlay(clip = cur) {
    if (!clip) return;
    const ac = audio(), d = getDeck(fx);
    d.wet.gain.value = fxOn ? 1 : 0; d.dry.gain.value = fxOn ? 0 : 1;
    stopPlay();
    const s = ac.createBufferSource(); s.buffer = clip.buffer; s.loop = loop;
    s.connect(d.chain.input); s.connect(d.dry);
    s.onended = () => { if (d.src === s) { d.src = null; setMode('idle'); } };
    s.start(); d.src = s; t0.current = ac.currentTime; setMode('play');
  }

  async function startRec() {
    setMsg(''); stopPlay(); setMode('arming');
    try {
      const ac = audio();
      anim.current.mic = await micAnalyser('tape');
      recRef.current = await startRecording();
      t0.current = ac.currentTime; setMode('rec');
    } catch (e) { releaseMic('tape'); setMsg(micError(e)); setMode('idle'); }
  }
  async function stopRec() {
    const r = recRef.current; if (!r) return;
    recRef.current = null; setMode('idle'); setBusy(true);
    try {
      const buf = library.trimStart(await r.stop());
      if (buf.duration < 0.05) { setMsg('That take came out silent. Check the mic and try again.'); return; }
      const c = library.add({ buffer: buf, source: 'tape' });
      setCurId(c.id); setMsg(`${c.name} saved to the library.`);
    } catch (e) { setMsg(`Could not save the take: ${e.message || e}`); }
    finally { setBusy(false); }
  }

  const wind = (dir) => { setWinding(7 * dir); setTimeout(() => setWinding(0), 650); };
  const pick = (i) => { const c = clips[(i + clips.length) % clips.length]; if (c) { setCurId(c.id); if (mode === 'play') startPlay(c); } };

  const press = (act) => {
    blip(act === 'rec' ? 440 : 880);
    if (act === 'rec') { if (mode === 'rec') stopRec(); else if (mode !== 'arming') startRec(); return; }
    if (act === 'play') { if (mode === 'rec') return; if (mode === 'play') { stopPlay(); setMode('idle'); } else if (cur) startPlay(); else setMsg('The library is empty. Press REC to record a take.'); return; }
    if (act === 'stop') { if (mode === 'rec') stopRec(); else { stopPlay(); setMode('idle'); } return; }
    if (act === 'ff' || act === 'rew') { if (mode === 'rec') return; const dir = act === 'ff' ? 1 : -1; wind(dir); if (clips.length) pick(curIdx + dir); }
  };

  async function print() {
    if (!cur || busy) return; blip(990); setBusy(true);
    try {
      const buf = await printTape(cur.buffer, fx);
      const c = library.add({ buffer: buf, source: 'print', name: `${cur.name.slice(0, 22)} · tape` });
      setCurId(c.id); setMsg(`Printed as ${c.name}. The tape sound is baked in.`);
    } catch (e) { setMsg(`Print failed: ${e.message || e}`); }
    finally { setBusy(false); }
  }
  const send = () => { if (!cur) return; blip(1200); pads.loadClip(cur.id); setMsg(`${cur.name} is on the Tape row of the Rhythm Composer.`); };
  const remove = (c) => { if (c.id === cur?.id) { stopPlay(); setMode('idle'); } library.remove(c.id); };

  const latched = (act) => (act === 'play' && mode === 'play') || (act === 'rec' && (mode === 'rec' || mode === 'arming')) || (act === 'ff' && winding > 0) || (act === 'rew' && winding < 0);
  const keys = [['rec', 'Rec', 'Record a take'], ['play', 'Play', 'Play or pause'], ['stop', 'Stop', 'Stop'], ['rew', 'Rew', 'Previous clip'], ['ff', 'FF', 'Next clip']];
  const set = (k) => (v) => setFx((p) => ({ ...p, [k]: v }));
  const label = mode === 'rec' || mode === 'arming' ? 'RECORDING…' : cur ? cur.name : 'BLANK TAPE';

  return (
    <section ref={fsRef} className={`section tape-section ${full ? 'is-full brushed' : ''}`} aria-labelledby="tape-h">
      <header className="sec-head"><h2 id="tape-h"><span className="sec-dot" style={{ background: 'var(--c-tape)' }} />Tape deck</h2><p>Record, shape, print, send.</p><FullBtn full={full} onClick={toggleFull} label="Tape deck" /></header>
      <div className="tape-grid">
        <div className="deck-unit brushed">
          <Screws />
          <div className="deck-top"><span className="engrave">Stereo cassette sampler</span><span className={`engrave rec-tag ${mode === 'rec' ? 'on' : ''}`}><Led on={mode === 'rec'} color="#ff4b3a" /> Rec</span></div>
          <div className="well"><div className={`cassette ${winding ? 'nudge' : ''}`}>
            <svg viewBox="0 0 600 340" role="img" aria-label={`Cassette: ${label}`}>
              <defs><linearGradient id="br-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b2b30" /><stop offset="1" stopColor="#16161a" /></linearGradient></defs>
              <rect x="8" y="8" width="584" height="324" rx="20" fill="url(#br-sh)" stroke="#3a3a42" strokeWidth="3" />
              <rect x="40" y="28" width="520" height="190" rx="10" fill="#efe9dc" />
              <rect x="40" y="28" width="520" height="34" rx="10" style={{ fill: mode === 'rec' ? '#e0452f' : 'var(--c-tape)' }} /><rect x="40" y="48" width="520" height="14" style={{ fill: mode === 'rec' ? '#e0452f' : 'var(--c-tape)' }} />
              <text x="60" y="53" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="22" fill="#17130b" letterSpacing="1">{String(label).toUpperCase().slice(0, 26)}</text>
              <text x="540" y="53" textAnchor="end" fontFamily="Share Tech Mono, monospace" fontSize="16" fill="#17130b">{cur && mode !== 'rec' ? `${cur.duration.toFixed(1)}S` : 'C-30'}</text>
              <text x="60" y="88" fontFamily="Share Tech Mono, monospace" fontSize="14" fill="#6d675c">JERM747 BEAT ROOM · {clips.length} CLIP{clips.length === 1 ? '' : 'S'}</text>
              <rect x="140" y="104" width="320" height="96" rx="48" fill="#0d0d10" />
              <circle ref={refs.tapeL} cx="208" cy="152" r="44" fill="#3b2a1e" /><circle ref={refs.tapeR} cx="392" cy="152" r="28" fill="#3b2a1e" />
              {[208, 392].map((cx, i) => (
                <g key={cx} className="reel" ref={i ? refs.reelR : refs.reelL}>
                  <circle cx={cx} cy="152" r="24" fill="#efe9dc" /><circle cx={cx} cy="152" r="10" fill="#0d0d10" />
                  <rect x={cx - 4} y="130" width="8" height="11" rx="2" fill="#0d0d10" /><rect x={cx - 4} y="163" width="8" height="11" rx="2" fill="#0d0d10" />
                  <rect x={cx - 22} y="148" width="11" height="8" rx="2" fill="#0d0d10" /><rect x={cx + 11} y="148" width="11" height="8" rx="2" fill="#0d0d10" />
                </g>
              ))}
              <path d="M120 332 L156 262 H444 L480 332" fill="#0d0d10" stroke="#3a3a42" strokeWidth="2" />
            </svg>
          </div></div>
          <div className="meters">
            <div className="counter" aria-label={`Tape counter ${counter} seconds`}>{counter.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
            {['L', 'R'].map((ch) => (
              <div className="vu" key={ch}><svg viewBox="0 0 100 48" aria-hidden="true">
                <path d="M14 40 A40 40 0 0 1 86 40" fill="none" stroke="#2a241a" strokeWidth="1" /><path d="M68 18 A40 40 0 0 1 86 40" fill="none" stroke="#c2412b" strokeWidth="3" />
                <g stroke="#2a241a" strokeWidth="1"><path d="M18 33l3 2M28 24l2 3M40 18l1 3M52 16v3M64 18l-1 3M75 24l-2 3" /></g>
                <text x="50" y="44" textAnchor="middle" fontFamily="Share Tech Mono, monospace" fontSize="7" fill="#2a241a">VU · {ch}</text>
                <line className="needle" ref={ch === 'L' ? refs.nL : refs.nR} x1="50" y1="52" x2="50" y2="12" stroke="#151515" strokeWidth="1.2" />
              </svg></div>
            ))}
          </div>
          <div className="keys-wrap"><div className="keys" role="group" aria-label="Transport keys">
            {keys.map(([act, lbl, aria]) => (
              <button key={act} type="button" className={`key key-${act} ${latched(act) ? 'latched' : ''}`} onClick={() => press(act)} aria-label={aria} aria-pressed={act === 'play' || act === 'rec' ? latched(act) : undefined}>
                <Led on={latched(act)} color={act === 'rec' ? '#ff4b3a' : undefined} />{Ico[act]}<em>{lbl}</em>
              </button>
            ))}
          </div></div>
        </div>

        <div className="tape-side">
          <div className="panel">
            <div className="panel-head">
              <span className="engrave">Tape character</span>
              <button type="button" className={`switch ${fxOn ? 'on' : ''}`} aria-pressed={fxOn} onClick={() => { blip(700); setFxOn(!fxOn); }}><Led on={fxOn} />{fxOn ? 'On' : 'Bypass'}</button>
            </div>
            <div className="knob-row">
              <Knob label="Wow" value={fx.wow} onChange={set('wow')} def={TAPE_DEFAULTS.wow} format={fmtPct} color="var(--c-tape)" />
              <Knob label="Flutter" value={fx.flutter} onChange={set('flutter')} def={TAPE_DEFAULTS.flutter} format={fmtPct} color="var(--c-tape)" />
              <Knob label="Saturate" value={fx.sat} onChange={set('sat')} def={TAPE_DEFAULTS.sat} format={fmtPct} color="var(--c-tape)" />
              <Knob label="Low" value={fx.low} min={-1} max={1} def={0} bipolar onChange={set('low')} format={fmtDb} color="var(--c-tape)" />
              <Knob label="High" value={fx.high} min={-1} max={1} def={0} bipolar onChange={set('high')} format={fmtDb} color="var(--c-tape)" />
            </div>
            <div className="btn-row">
              <button type="button" className={`btn ${loop ? 'active' : ''}`} aria-pressed={loop} onClick={() => { blip(760); setLoop(!loop); }}>{Ico.loop} Loop</button>
              <button type="button" className="btn" onClick={print} disabled={!cur || busy}>Print</button>
              <button type="button" className="btn primary" onClick={send} disabled={!cur}>Send to pads</button>
            </div>
            <p className="hint" role="status" aria-live="polite">{busy ? 'Working…' : msg || (cur ? 'Print bakes the tape sound into a new clip. Send loads it on the Tape row.' : 'Press REC, play or sing something, then STOP.')}</p>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="engrave">Library · {clips.length}</span><span className="engrave dim">Saved in this browser</span></div>
            {clips.length === 0 ? <p className="hint">No clips yet. Takes, prints and files from the turntable all land here.</p> : (
              <ol className="clips">
                {clips.map((c) => (
                  <li key={c.id} className={c.id === cur?.id ? 'on' : ''}>
                    {editing === c.id ? (
                      <input className="clip-name" autoFocus defaultValue={c.name} aria-label="Clip name" maxLength={32}
                        onBlur={(e) => { library.rename(c.id, e.target.value); setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
                    ) : (
                      <button type="button" className="clip-pick" onClick={() => { setCurId(c.id); if (mode === 'play') startPlay(c); }}>
                        <span>{c.name}</span><em>{c.source} · {c.duration.toFixed(1)}s</em>
                      </button>
                    )}
                    <button type="button" className="mini" aria-label={`Rename ${c.name}`} onClick={() => setEditing(c.id)}>✎</button>
                    <button type="button" className="mini" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>×</button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
