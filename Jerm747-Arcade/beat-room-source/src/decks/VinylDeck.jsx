// The Returnity turntable, now spinning library clips. Load any audio file (it joins the library,
// so the pads can use it too) or pick a clip; 33/45 and the pitch fader change playback speed
// live, like the real thing. Records loop until you stop them.
import { useEffect, useRef, useState } from 'react';
import { audio, out, blip } from '../engine/audio.js';
import * as library from '../engine/library.js';
import { useLibrary, useRaf, reduce, Led } from '../ui/parts.jsx';

let deck = null; // { gain, src }
function getDeck() {
  if (!deck) { const ac = audio(); const g = ac.createGain(); g.gain.value = 0.9; g.connect(out()); deck = { gain: g, src: null }; }
  return deck;
}

export default function VinylDeck() {
  const clips = useLibrary();
  const [clipId, setClipId] = useState(null);
  const [rpm, setRpm] = useState(33.333);
  const [pitch, setPitch] = useState(0);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const clip = clips.find((c) => c.id === clipId) || null;
  const rate = (rpm / 33.333) * (1 + pitch / 100);
  const platterRef = useRef(null), armRef = useRef(null), strobeRef = useRef(null), groovesRef = useRef(null);
  const anim = useRef({ vel: 0, ang: 0, arm: 0 });
  const live = useRef({}); live.current = { on, rate };

  useEffect(() => {
    const g = groovesRef.current; if (!g || g.childNodes.length) return;
    const add = (r, stroke, w) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', 330); c.setAttribute('cy', 300); c.setAttribute('r', r); c.setAttribute('fill', 'none'); c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', w); g.append(c); };
    for (let r = 74; r < 224; r += 3.2) add(r.toFixed(1), (r | 0) % 19 === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.028)', 1);
    for (const r of [120, 160, 196]) add(r, '#050506', 2.5);
  }, []);
  useEffect(() => { if (deck?.src) deck.src.playbackRate.setTargetAtTime(rate, audio().currentTime, 0.08); }, [rate]);
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // the record on the platter was deleted from the library
  useEffect(() => { if (clipId && !clip) { stop(); setClipId(null); } }, [clipId, clip]); // eslint-disable-line react-hooks/exhaustive-deps

  useRaf((dt) => {
    const L = live.current, A = anim.current, target = L.on ? 33.333 * 6 * L.rate : 0;
    A.vel += (target - A.vel) * Math.min(1, dt * (L.on ? 2.6 : 3.2));
    if (!reduce()) A.ang = (A.ang + A.vel * dt) % 360;
    platterRef.current?.setAttribute('transform', `rotate(${A.ang.toFixed(2)} 330 300)`);
    A.arm += ((L.on ? 26 : 0) - A.arm) * Math.min(1, dt * 2.2);
    armRef.current?.setAttribute('transform', `rotate(${A.arm.toFixed(2)} 660 130)`);
    strobeRef.current?.setAttribute('fill', L.on && Math.abs(A.vel - target) < 5 ? '#ff5b3a' : '#3a1a12');
  });

  function stop() {
    if (deck?.src) { try { deck.src.stop(); } catch { /* ended */ } deck.src = null; }
    setOn(false);
  }
  function start(c = clip) {
    if (!c) return;
    const ac = audio(), d = getDeck();
    if (d.src) { try { d.src.stop(); } catch { /* ended */ } }
    const s = ac.createBufferSource(); s.buffer = c.buffer; s.loop = true;
    s.playbackRate.value = 0.001; s.playbackRate.setTargetAtTime(rate, ac.currentTime, reduce() ? 0.01 : 0.25); // spin-up
    s.connect(d.gain); s.start(); d.src = s; setOn(true);
  }
  const startStop = () => {
    blip(500); setMsg('');
    if (on) { stop(); return; }
    const c = clip || clips[clips.length - 1];
    if (!c) { setMsg('No record on the platter. Load an audio file first.'); return; }
    setClipId(c.id); start(c);
  };
  async function loadFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setMsg('Pressing the record…');
    try { const c = await library.importFile(audio(), f); setClipId(c.id); setMsg(`${c.name} is on the platter and in the library.`); if (on) start(c); }
    catch { setMsg('That file could not be read. Try an MP3, WAV, M4A or OGG.'); }
  }
  const choose = (id) => { setClipId(id || null); const c = clips.find((x) => x.id === id); if (on && c) start(c); };
  const labelTop = clip ? clip.name : 'Jerm747';
  const labelLine = clip ? `${clip.duration.toFixed(1)}s · ${clip.source}` : 'Beat Room';

  return (
    <section className="section vinyl-section" aria-labelledby="vinyl-h">
      <header className="sec-head"><h2 id="vinyl-h"><span className="sec-dot" style={{ background: 'var(--c-vinyl)' }} />Turntable</h2><p>Spin a file or any clip. Pitch it, loop it.</p></header>
      <div className="vinyl-grid">
        <div className="tt-scene">
          <div className="tt">
            <div className="tt-face">
              <svg viewBox="0 0 800 600" aria-hidden="true">
                <defs>
                  <linearGradient id="br-plinth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c2c31" /><stop offset=".08" stopColor="#232327" /><stop offset="1" stopColor="#141417" /></linearGradient>
                  <radialGradient id="br-platter" cx=".5" cy=".5" r=".5"><stop offset=".92" stopColor="#b9bac0" /><stop offset=".96" stopColor="#e9e9ec" /><stop offset="1" stopColor="#7e7f85" /></radialGradient>
                  <radialGradient id="br-label" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#f6d58a" /><stop offset="1" style={{ stopColor: 'var(--c-vinyl)' }} /></radialGradient>
                  <linearGradient id="br-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".45" stopColor="#fff" stopOpacity=".09" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></linearGradient>
                  <linearGradient id="br-arm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7d7e84" /><stop offset=".5" stopColor="#f3f3f5" /><stop offset="1" stopColor="#8b8c92" /></linearGradient>
                  <clipPath id="br-disc"><circle cx="330" cy="300" r="226" /></clipPath>
                </defs>
                <rect x="10" y="20" width="780" height="570" rx="16" fill="#08080a" opacity=".6" />
                <rect x="6" y="6" width="788" height="580" rx="16" fill="url(#br-plinth)" stroke="#36363d" strokeWidth="2" />
                <rect x="6" y="6" width="788" height="10" rx="5" fill="#fff" opacity=".05" />
                <g ref={platterRef}>
                  <circle cx="330" cy="300" r="246" fill="url(#br-platter)" />
                  {[243, 237, 231].map((r, i) => <circle key={r} cx="330" cy="300" r={r} fill="none" stroke="#2b2b30" strokeWidth="3.5" strokeDasharray={`3 ${5.3 - i * 0.2}`} />)}
                  <circle cx="330" cy="300" r="226" fill="#0e0e10" />
                  <g ref={groovesRef} />
                  <circle cx="330" cy="300" r="66" fill="url(#br-label)" />
                  <text x="330" y="294" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="16" fill="#17130b" letterSpacing="1">{String(labelTop).toUpperCase().slice(0, 14)}</text>
                  <text x="330" y="314" textAnchor="middle" fontFamily="Share Tech Mono, monospace" fontSize="9" fill="#3a2a10">{String(labelLine).toUpperCase().slice(0, 26)}</text>
                  <circle cx="330" cy="300" r="5" fill="#d7d8dc" />
                </g>
                <circle cx="330" cy="300" r="226" fill="url(#br-sheen)" clipPath="url(#br-disc)" />
                <circle cx="80" cy="540" r="16" fill="#1d1d21" stroke="#3a3a42" /><circle ref={strobeRef} cx="80" cy="540" r="7" fill="#3a1a12" />
                <circle cx="660" cy="130" r="56" fill="#1d1d21" stroke="#3a3a42" strokeWidth="2" /><circle cx="660" cy="130" r="38" fill="url(#br-arm)" />
                <rect x="700" y="300" width="16" height="44" rx="6" fill="#2a2a2f" stroke="#3a3a42" />
                <g ref={armRef}>
                  <rect x="640" y="40" width="40" height="46" rx="8" fill="url(#br-arm)" />
                  <path d="M660 130 C 660 210, 700 250, 690 330 S 640 420, 612 446" fill="none" stroke="url(#br-arm)" strokeWidth="9" strokeLinecap="round" />
                  <path d="M598 434 l28 -10 l14 28 l-30 12 z" fill="#2c2c31" stroke="#8b8c92" strokeWidth="2" />
                  <circle cx="660" cy="130" r="14" fill="#2c2c31" />
                </g>
                <rect x="730" y="220" width="40" height="12" rx="6" fill="#3a3a42" />
                <rect x="742" y="320" width="10" height="230" rx="5" fill="#0b0b0d" />
                <g fill="#5a5a61" fontFamily="Share Tech Mono, monospace" fontSize="11"><text x="716" y="330">−8</text><text x="726" y="439">0</text><text x="714" y="550">+8</text></g>
              </svg>
              <input className="tt-pitch" type="range" min="-8" max="8" step="0.1" value={pitch} aria-label="Pitch, minus 8 to plus 8 percent"
                onChange={(e) => { const v = Number(e.target.value); setPitch(Math.abs(v) < 0.35 ? 0 : v); }} />
            </div>
            <div className="tt-transport" role="group" aria-label="Turntable transport">
              <button className={`tt-btn tt-start ${on ? 'on' : ''}`} type="button" onClick={startStop} aria-pressed={on}><Led on={on} />Start · Stop</button>
              <button className={`tt-btn tt-33 ${rpm < 40 ? 'on' : ''}`} type="button" aria-pressed={rpm < 40} onClick={() => { blip(700); setRpm(33.333); }}>33</button>
              <button className={`tt-btn tt-45 ${rpm > 40 ? 'on' : ''}`} type="button" aria-pressed={rpm > 40} onClick={() => { blip(760); setRpm(45); }}>45</button>
            </div>
          </div>
        </div>
        <div className="panel vinyl-panel">
          <div className="panel-head"><span className="engrave">Record</span></div>
          <div className="field">
            <select value={clip?.id || ''} onChange={(e) => choose(e.target.value)} aria-label="Record on the platter">
              <option value="">{clips.length ? 'Pick a clip…' : 'Library is empty'}</option>
              {clips.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Load file</button>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={loadFile} />
          </div>
          <div className="tt-readout"><span>Speed <b>{rpm > 40 ? '45' : '33⅓'}</b></span><span>Pitch <b>{pitch >= 0 ? '+' : ''}{pitch.toFixed(1)}%</b></span><span>Playback <b>{Math.round(rate * 100)}%</b></span></div>
          <p className="hint" role="status" aria-live="polite">{msg || 'Files you load here also show up in the tape library and on the pads.'}</p>
        </div>
      </div>
    </section>
  );
}
