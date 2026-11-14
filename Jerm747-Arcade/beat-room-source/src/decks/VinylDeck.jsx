import './scratch.css';
// The Returnity turntable, now spinning library clips. Load any audio file (it joins the library,
// so the pads can use it too) or pick a clip; 33/45 and the pitch fader change playback speed
// live, like the real thing. Records loop until you stop them.
// Start·Stop lifts the needle and starts over from the top. Play·Pause spins the platter down
// and leaves the needle where it is, so the next play picks up right there. Tap anywhere on the
// record to drop the needle: outer edge is the start, the label is the end.
// Full screen = vinyl mode: the record follows your finger 1:1 (engine/turntable.js), so you can
// crawl a drum hit slow, stop it, drag it back, or whip it. Cut is the crossfader.
import { useEffect, useRef, useState, useMemo } from 'react';
import { audio, blip } from '../engine/audio.js';
import { deckEngine, REV_SEC, loadVinylOpts } from '../engine/turntable.js';
import { DUST } from '../engine/vinylcut.js';
import * as library from '../engine/library.js';
import { onPlatter } from '../engine/platter.js';
import { openBin } from '../chassis/SampleBin.jsx';
import { useLibrary, useRaf, reduce, Led, useFullscreen, FullBtn, useFold, FoldBtn } from '../ui/parts.jsx';

const PITCH_STEP = 0.5;

export default function VinylDeck() {
  const clips = useLibrary();
  const [clipId, setClipId] = useState(null);
  const [rpm, setRpm] = useState(33.333);
  const [pitch, setPitch] = useState(0);
  const [on, setOn] = useState(false);
  const [cued, setCued] = useState(false);     // needle down, platter stopped
  const [posLabel, setPosLabel] = useState('0:00');
  const pos = useRef(0);                       // seconds into the clip
  const [fsRef, full, toggleFull] = useFullscreen();
  const [folded, toggleFold] = useFold('vinyl');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const clip = clips.find((c) => c.id === clipId) || null;
  const rate = (rpm / 33.333) * (1 + pitch / 100);
  const platterRef = useRef(null), armRef = useRef(null), strobeRef = useRef(null), groovesRef = useRef(null);
  const anim = useRef({ vel: 0, ang: 0, arm: 0 });
  const live = useRef({}); live.current = { on, rate, cued, dur: clip?.duration || 0 };
  const engRef = useRef(null);
  const [scratchOK, setScratchOK] = useState(true);
  const sc = useRef({ held: false });          // hand on the record (full screen)
  const [held, setHeld] = useState(false);
  const [cutOn, setCutOn] = useState(false);
  const [vopts, setVopts] = useState(loadVinylOpts);
  const setVinyl = (o) => { setVopts((v) => ({ ...v, ...o })); withEng().then((en) => en.setOpts(o)); };

  useEffect(() => {
    const g = groovesRef.current; if (!g || g.childNodes.length) return;
    const add = (r, stroke, w) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', 330); c.setAttribute('cy', 300); c.setAttribute('r', r); c.setAttribute('fill', 'none'); c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', w); g.append(c); };
    for (let r = 74; r < 224; r += 3.2) add(r.toFixed(1), (r | 0) % 19 === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.028)', 1);
    for (const r of [120, 160, 196]) add(r, '#050506', 2.5);
  }, []);
  // the deck engine (vinyl mode when the browser has AudioWorklet)
  const wave = useRef(null), cue = useRef(null), cutOwner = useRef(null), engineJob = useRef(null);
  const peaks = useMemo(() => {
    if (!clip?.buffer) return null;
    const b=clip.buffer, stride=Math.max(64,Math.ceil(b.length/120000));
    const values=new Float32Array(Math.ceil(b.length/stride));
    for(let channel=0;channel<b.numberOfChannels;channel++){
      const samples=b.getChannelData(channel);
      for(let i=0;i<samples.length;i++) {
        const index=Math.floor(i/stride), level=Math.abs(samples[i]);
        if(level>values[index])values[index]=level;
      }
    }
    return {values,hz:b.sampleRate/stride};
  },[clip?.buffer]);
  const eng = () => engRef.current;
  const withEng = async () => { if (!engRef.current) { engRef.current = await (engineJob.current ||= deckEngine().catch(error=>{engineJob.current=null;throw error})); setScratchOK(engRef.current.scratch); } return engRef.current; };
  useEffect(() => { if (clip && engRef.current) engRef.current.load(clip); }, [clip]);
  useEffect(() => { eng()?.setRate(rate); }, [rate]);
  useEffect(() => () => { eng()?.stop(); clearInterval(rpt.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the record on the platter was deleted from the library
  useEffect(() => { if (clipId && !clip) { stop(); setClipId(null); } }, [clipId, clip]); // eslint-disable-line react-hooks/exhaustive-deps

  useRaf((dt) => {
    const L = live.current, A = anim.current, S = sc.current, e = eng();
    const r = e ? e.read() : { pos: pos.current, speed: 0 };
    if (L.dur) pos.current = r.pos;
    // the platter turns with the groove: one turn per 1.8 s of audio (under your hand it follows your finger)
    if (!S.held && !reduce()) A.ang = (A.ang + (r.speed * dt / REV_SEC) * 360) % 360;
    platterRef.current?.setAttribute('transform', `rotate(${A.ang.toFixed(2)} 330 300)`);
    if(full && wave.current){
      const sec = S.held && L.dur ? ((S.pos0+S.total*REV_SEC/360)%L.dur+L.dur)%L.dur : pos.current;
      // Both the cue tape and the waveform sample the very same position in the clip.
      cue.current?.setAttribute('transform', 'rotate('+((sec/REV_SEC)*360-A.ang)+' 330 300)');
      const c=wave.current, w=Math.max(1,Math.round(c.clientWidth)), h=Math.max(1,Math.round(c.clientHeight));
      const dpr=Math.min(2,devicePixelRatio||1);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
      const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      ctx.fillStyle='#40505d';ctx.fillRect(0,h/2,w,1);
      if(peaks && L.dur){
        const span=4, {values,hz}=peaks;
        for(let x=0;x<w;x+=2){
          const t=((sec+(x/w-.5)*span)%L.dur+L.dur)%L.dur;
          const k=Math.floor(t*hz);let max=0;
          for(let j=0;j<=Math.ceil(2*span*hz/w);j++)max=Math.max(max,values[(k+j)%values.length]||0);
          const height=Math.max(1,Math.sqrt(max)*h*.86);
          ctx.fillStyle=x<w/2?'#58ddcf':'#9cdde2';ctx.fillRect(x,(h-height)/2,1.75,height);
        }
      }
      ctx.fillStyle='#ffac63';ctx.fillRect(Math.floor(w/2),0,2,h);
    }
    const prog = L.dur ? pos.current / L.dur : 0;
    A.arm += ((L.on || L.cued ? 18 + prog * 12 : 0) - A.arm) * Math.min(1, dt * 2.2);
    const lbl = fmtTime(pos.current); if (lbl !== A.lbl) { A.lbl = lbl; setPosLabel(lbl); }
    armRef.current?.setAttribute('transform', `rotate(${A.arm.toFixed(2)} 660 130)`);
    strobeRef.current?.setAttribute('fill', L.on && !S.held && Math.abs(r.speed - L.rate) < 0.01 ? '#ff5b3a' : '#3a1a12');
  });

  function stop() { eng()?.stop(); setOn(false); setCued(false); pos.current = 0; }
  async function start(c = clip, from = 0, spin = true) {
    if (!c) return;
    const e = await withEng();
    e.load(c); e.seek(from % c.duration); pos.current = from % c.duration;
    e.play(live.current.rate, spin && !reduce() ? 0.6 : 0.02); // a direct-drive deck reaches speed in about 0.6 s
    setOn(true); setCued(true);
  }
  /** Spin down and hold the needle where it is. */
  function pause() { eng()?.pause(reduce() ? 0.01 : 0.35); setOn(false); setCued(true); }
  const pick = () => {
    const c = clip || clips[clips.length - 1];
    if (!c) { setMsg('No record on the platter. Load an audio file first.'); return null; }
    if (c.id !== clipId) { setClipId(c.id); pos.current = 0; }
    return c;
  };
  const startStop = () => {
    blip(500); setMsg('');
    if (on) { stop(); return; }
    const c = pick(); if (c) start(c, 0);
  };
  const playPause = () => {
    blip(560); setMsg('');
    if (on) { pause(); return; }
    const c = pick(); if (c) start(c, pos.current);
  };
  const pointAt = (e) => {
    const ctm = e.currentTarget.getScreenCTM(); if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { r: Math.hypot(p.x - 330, p.y - 300), ang: (Math.atan2(p.y - 300, p.x - 330) * 180) / Math.PI };
  };
  const dropAt = async (r) => {
    if (!clip || r < 66 || r > 230) return;
    const sec = Math.max(0, Math.min(0.999, (226 - r) / (226 - 74))) * clip.duration;
    blip(420); pos.current = sec;
    const e = await withEng(); e.load(clip); e.seek(sec);
    if (!on) setCued(true);
  };
  /** Needle drop: tap the record to jump there. */
  const drop = (e) => { const pt = pointAt(e); if (pt) dropAt(pt.r); };

  // ---------- vinyl mode (full screen) ----------
  // Hand on the record: the groove follows your finger exactly (one turn = 1.8 s), so the sound
  // moves as fast or slow as you do, backward too, and stops when you stop. Let go and it keeps
  // the speed you gave it, then the motor takes over again (or it coasts to a stop when paused).
  const scratchDown = async (e) => {
    if (!clip || sc.current.owner != null) return;
    const pt = pointAt(e); if (!pt || pt.r < 66 || pt.r > 236) return;
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    const id=e.pointerId; sc.current.owner=id; const en = await withEng(); if(sc.current.owner!==id)return; en.load(clip);
    Object.assign(sc.current, { held: true, pos0:en.read().pos, last: pt.ang, total: 0, ang0: anim.current.ang, downT: performance.now(), startR: pt.r, hist: [{ t: e.timeStamp, a: 0 }] });
    en.grab(); setHeld(true);
  };
  const scratchMove = (e) => {
    const S = sc.current; if (!S.held || e.pointerId!==S.owner) return;
    // use every touch sample the browser collected since the last frame (smoother hand path)
    const evs = e.nativeEvent.getCoalescedEvents?.() || [];
    const list = evs.length ? evs : [e.nativeEvent];
    const svg = e.currentTarget, ctm = svg.getScreenCTM(); if (!ctm) return;
    const inv = ctm.inverse();
    for (const ev of list) {
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(inv);
      const ang = (Math.atan2(p.y - 300, p.x - 330) * 180) / Math.PI;
      let dA = ang - S.last; if (dA > 180) dA -= 360; if (dA < -180) dA += 360;
      S.last = ang; S.total += dA;
      S.hist.push({ t: ev.timeStamp, a: S.total });
    }
    // hand speed over the last ~40 ms (seconds of groove per second)
    const now = list[list.length - 1].timeStamp;
    S.hist = S.hist.filter((h) => now - h.t < 40);
    const h0 = S.hist[0], span = (now - h0.t) / 1000;
    const vel = span > 0.004 ? (((S.total - h0.a) / 360) * REV_SEC) / span : 0;
    anim.current.ang = S.ang0 + S.total;
    eng()?.hand((S.total / 360) * REV_SEC, vel);
  };
  const scratchUp = (event) => {
    if(event && event.pointerId!==sc.current.owner)return; sc.current.owner=null;
    const S = sc.current; if (!S.held) return;
    S.held = false; setHeld(false);
    eng()?.release();
    // a quick tap that didn't move the record drops the needle instead
    if (event?.type==="pointerup" && performance.now() - S.downT < 220 && Math.abs(S.total) < 4) dropAt(S.startR);
  };
  // Cut: the crossfader. Hold to kill the sound, let go to bring it back (chop scratches with it).
  const cut = (v) => { setCutOn(v); withEng().then((en) => en.cut(v)); };
  useEffect(()=>{
    if(!full)return;
    const release=()=>{sc.current.owner=null;if(sc.current.held){sc.current.held=false;eng()?.release();setHeld(false)}cutOwner.current=null;eng()?.cut(false);setCutOn(false)};
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',release);
    return ()=>{window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',release);release()};
  },[full]);

  // pitch −/+ : tap for 0.5%, hold to keep going
  const rpt = useRef(0);
  const nudgePitch = (d) => setPitch((p) => { const v = Math.round(Math.max(-8, Math.min(8, p + d)) * 10) / 10; return Math.abs(v) < 0.05 ? 0 : v; });
  const holdStart = (d) => { blip(d > 0 ? 880 : 660); nudgePitch(d); clearInterval(rpt.current); const t0 = Date.now(); rpt.current = setInterval(() => { if (Date.now() - t0 > 350) nudgePitch(d); }, 90); };
  const holdEnd = () => clearInterval(rpt.current);

  async function loadFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setMsg('Pressing the record…');
    try { const c = await library.importFile(audio(), f); setClipId(c.id); pos.current = 0; setMsg(`${c.name} is on the platter and in the library.`); if (on) start(c); else setCued(false); }
    catch { setMsg('That file could not be read. Try an MP3, WAV, M4A or OGG.'); }
  }
  // something in the Sample bin (or a bounce) asked for the platter
  useEffect(() => onPlatter((id) => {
    const c = library.get(id); if (!c) return;
    setClipId(id); pos.current = 0; setMsg(`${c.name} is on the platter.`);
    if (live.current.on) start(c); else setCued(false);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (id) => { setClipId(id || null); pos.current = 0; const c = clips.find((x) => x.id === id); if (on && c) start(c); else setCued(false); };
  const labelTop = clip ? clip.name : 'Jerm747';
  const labelLine = clip ? `${clip.duration.toFixed(1)}s · ${clip.source}` : 'Beat Room';

  return (
    <section ref={fsRef} className={`section vinyl-section ${full ? 'is-full' : ''} ${folded && !full ? 'is-folded' : ''}`} aria-labelledby="vinyl-h">
      <header className="sec-head"><h2 id="vinyl-h"><span className="sec-dot" style={{ background: 'var(--c-vinyl)' }} />Turntable</h2><p>{full ? 'Vinyl mode: the record follows your finger.' : 'Spin a file or any clip. Tap the record to drop the needle.'}</p><span className="sec-tools"><FoldBtn folded={folded} onClick={() => { blip(folded ? 880 : 440); toggleFold(); }} label="Turntable" /><button type="button" className="scratch-open" onClick={toggleFull}>{full ? "Back" : "Scratch"}</button></span></header>
      {full && <div className="scratch-strip"><canvas ref={wave} aria-label="Scrolling record waveform, playhead in the center" /><output>{posLabel} / {clip ? fmtTime(clip.duration) : '0:00'}</output></div>}
      <div className="vinyl-grid">
        <div className="tt-scene">
          <div className="tt">
            <div className="tt-face">
              <svg viewBox="0 0 800 600" aria-hidden="true" className={`${clip ? 'droppable' : ''} ${full ? 'scratchable' : ''} ${held ? 'held' : ''}`}
                onPointerDown={full && scratchOK ? scratchDown : drop} onPointerMove={full && scratchOK ? scratchMove : undefined} onPointerUp={full && scratchOK ? scratchUp : undefined} onPointerCancel={full && scratchOK ? scratchUp : undefined} onLostPointerCapture={full && scratchOK ? scratchUp : undefined}>
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
                <g ref={cue}><path d="M324 92 l13 0 -2 69 -10 0z" fill="#fff1c9" stroke="#33251c" strokeWidth="2" /></g></g>
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
              <button className={`tt-btn tt-cue ${on ? 'on' : ''}`} type="button" onClick={playPause} aria-pressed={on} title="Pause in place, play from the needle">{on ? 'Pause' : 'Play'}</button>
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
            <button type="button" className="btn" onClick={() => { blip(760); openBin(); }}>Sample bin</button>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={loadFile} />
          </div>
          <div className="pitch-ctl" role="group" aria-label="Pitch">
            <span className="engrave">Pitch</span>
            <button type="button" className="mini-key" aria-label="Pitch down 0.5%" disabled={pitch <= -8}
              onPointerDown={() => holdStart(-PITCH_STEP)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudgePitch(-PITCH_STEP))}>−</button>
            <output className="pitch-val">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}%</output>
            <button type="button" className="mini-key" aria-label="Pitch up 0.5%" disabled={pitch >= 8}
              onPointerDown={() => holdStart(PITCH_STEP)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudgePitch(PITCH_STEP))}>+</button>
            <button type="button" className="switch" onClick={() => { blip(700); setPitch(0); }} disabled={pitch === 0}>0</button>
          </div>
          <div className="vinyl-opts">
            <span className="engrave">Analog</span>
            <button type="button" className={`switch ${vopts.analog ? 'on' : ''}`} aria-pressed={vopts.analog} disabled={!scratchOK}
              onClick={() => { blip(vopts.analog ? 520 : 940); setVinyl({ analog: !vopts.analog }); }} title="Phono stage, RIAA groove, platter wow and dust. Switch off to hear the plain digital deck.">
              <Led on={vopts.analog && scratchOK} />{vopts.analog ? 'Vinyl' : 'Digital'}
            </button>
            <span className="engrave">Dust</span>
            {Object.entries(DUST).map(([k, l]) => (
              <button key={k} type="button" className={`switch ${vopts.dust === k ? 'on' : ''}`} aria-pressed={vopts.dust === k} disabled={!scratchOK || !vopts.analog} onClick={() => { blip(600); setVinyl({ dust: k }); }}>
                <Led on={vopts.dust === k && vopts.analog} />{l}
              </button>
            ))}
          </div>
          {full && (
            <div className="cut-row">
              <button type="button" onClick={playPause}>{on ? 'Pause' : 'Play'}</button>
              <button type="button" onClick={stop}>Stop</button>
              <button type="button" onClick={()=>fileRef.current?.click()}>Load</button>
              <button type="button" className={`cut-pad ${cutOn ? 'on' : ''}`} aria-pressed={cutOn}
                onPointerDown={(e) => { e.preventDefault(); if(cutOwner.current!=null)return;cutOwner.current=e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); cut(true); }} onLostPointerCapture={e=>{if(cutOwner.current===e.pointerId){cutOwner.current=null;cut(false)}}} onPointerUp={e=>{if(cutOwner.current===e.pointerId){cutOwner.current=null;cut(false)}}} onPointerCancel={()=>{cutOwner.current=null;cut(false)}}
                onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); cut(true); } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cut(false); }}>
                Cut
              </button>
              <span className="hint">Hold Cut to kill the sound while you move the record, let go to bring it in. Scratch with one hand, cut with the other.</span>
            </div>
          )}
          <div className="tt-readout"><span>Speed <b>{rpm > 40 ? '45' : '33⅓'}</b></span><span>Pitch <b>{pitch >= 0 ? '+' : ''}{pitch.toFixed(1)}%</b></span><span>Playback <b>{Math.round(rate * 100)}%</b></span><span>Needle <b>{clip ? `${posLabel} / ${fmtTime(clip.duration)}` : '—'}</b></span></div>
          <p className="hint" role="status" aria-live="polite">{msg || (full ? (scratchOK ? 'Vinyl mode: put a finger on the record and move it. The sound follows your hand exactly, slow or fast, forward or back. Let go and it plays on. Quick tap drops the needle.' : 'This browser can’t do vinyl mode (no AudioWorklet), so scratching is off. Play, pause and needle drops still work.') : 'Go full screen to scratch, and for the pitch fader. Files you load here also join the tape library and the pads.')}</p>
        </div>
      </div>
    </section>
  );
}

function fmtTime(sec) { const s = Math.max(0, Math.floor(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
