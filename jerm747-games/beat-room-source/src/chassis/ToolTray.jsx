// The top bar: four small tool buttons (Tempo, Metronome, Tuner, Output) that each open their
// full panel in a pop-up, with a Bigger switch that fills the screen (handy for the tuner on a
// music stand). The slim output meter rides along the bar. The count-in countdown also lives here.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { blip } from '../engine/audio.js';
import { getBpm, onBpm, onRun, onStep } from '../engine/clock.js';
import * as midi from '../engine/midi.js';
import * as tuner from '../engine/tunerStore.js';
import * as countin from '../engine/countin.js';
import Metronome, { Tempo, metroOn, toggleMetro } from '../utils/Metronome.jsx';
import Tuner from '../utils/Tuner.jsx';
import Master, { Ladder, useMasterVol } from './Master.jsx';
import { Led, useExternal, useFullscreen } from '../ui/parts.jsx';
import SampleBinHost, { BinBtn } from './SampleBin.jsx';

const TOOLS = {
  tempo: { title: 'Tempo', Comp: Tempo },
  metro: { title: 'Metronome', Comp: Metronome },
  tuner: { title: 'Tuner', Comp: Tuner },
  out: { title: 'Output', Comp: Master },
  midi: { title: 'MIDI', Comp: MidiPanel },
};

export default function ToolTray() {
  const [open, setOpen] = useState(null);
  const midiState = useExternal(midi.subscribe, midi.getStatus);
  const bpm = useExternal(onBpm, getBpm);
  const metro = useExternal(onRun, metroOn);
  const tn = useExternal(tuner.subscribe, tuner.get);
  const [vol] = useMasterVol();
  const [beat, setBeat] = useState(-1);
  useEffect(() => onStep((i) => setBeat(i < 0 ? -1 : Math.floor(i / 4))), []);
  const pop = (k) => { blip(760); setOpen(k); };

  return (
    <div className="tray" role="group" aria-label="Tools">
      <div className="tray-btns">
        <button type="button" className="tool-btn" onClick={() => pop('tempo')} aria-haspopup="dialog">
          <span className="tool-name">Tempo</span><b className="tool-read">{bpm}<small>bpm</small></b>
        </button>
        <span className={`tool-btn split ${metro ? 'lit' : ''}`}>
          <button type="button" className="tool-main" onClick={() => pop('metro')} aria-haspopup="dialog">
            <span className="tool-name">Metronome</span>
            <span className="tool-read beats-read" aria-hidden="true">{[0, 1, 2, 3].map((b) => <Led key={b} on={metro && beat === b} color={b === 0 ? '#ff6a3d' : 'var(--c-tools)'} />)}</span>
          </button>
          <button type="button" className={`tool-quick ${metro ? 'on' : ''}`} aria-pressed={metro} aria-label={metro ? 'Stop click' : 'Start click'} onClick={() => { blip(metro ? 520 : 1040); toggleMetro(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6l4 18H5z" /><path d="M12 15l5-8" strokeLinecap="round" /></svg>
          </button>
        </span>
        <button type="button" className={`tool-btn ${tn.on ? 'lit' : ''}`} onClick={() => pop('tuner')} aria-haspopup="dialog">
          <span className="tool-name">Tuner</span>
          <b className="tool-read">{tn.on ? (tn.read ? <>{tn.read.name}<sup>{tn.read.octave}</sup><small className={Math.abs(tn.read.cents) <= 5 ? 'ok' : ''}>{tn.read.cents > 0 ? '+' : ''}{tn.read.cents}¢</small></> : <small>listening</small>) : <small>off</small>}</b>
        </button>
        <button type="button" className="tool-btn out-btn" onClick={() => pop('out')} aria-haspopup="dialog" aria-label="Output and master volume">
          <span className="tool-name">Output · {Math.round(vol * 100)}%</span>
          <Ladder segs={18} className="slim" />
        </button>
        <button type="button" className="tool-btn" onClick={() => pop('midi')} aria-haspopup="dialog">
          <span className="tool-name">MIDI</span><b className="tool-read"><small>{midiState.devices.length ? `${midiState.devices.length} connected` : 'Connect'}</small></b>
        </button>
        <BinBtn />
      </div>
      {open && <ToolPop k={open} onClose={() => setOpen(null)} />}
      <SampleBinHost />
      <Countdown />
    </div>
  );
}

function ToolPop({ k, onClose }) {
  const { title, Comp } = TOOLS[k];
  const [big, setBig] = useState(false);
  const [fsRef, full, toggleFull] = useFullscreen();
  const card = useRef(null);
  useEffect(() => {
    card.current?.focus();
    const esc = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const large = big || full;
  return (
    <div ref={fsRef} className={`pop-scrim ${large ? 'large' : ''}`} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} className={`pop-card pop-${k}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="pop-head">
          <h3>{title}</h3>
          <div className="pop-tools">
            <button type="button" className={`switch ${big ? 'on' : ''}`} aria-pressed={big} onClick={() => { blip(800); setBig(!big); }}>{big ? 'Smaller' : 'Bigger'}</button>
            <button type="button" className={`switch ${full ? 'on' : ''}`} aria-pressed={full} onClick={() => { blip(900); toggleFull(); }}>{full ? 'Exit full' : 'Full screen'}</button>
            <button type="button" className="mini pop-x" onClick={() => { blip(440); if (full) toggleFull(); onClose(); }} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <Comp big={large} />
      </div>
    </div>
  );
}

/** Big countdown over everything during a count-in (or the last beats before a take starts). */
function Countdown() {
  const c = useExternal(countin.subscribe, countin.get);
  const [, bump] = useState(0);
  // shown inside whichever section is full screen, or over the page
  useEffect(() => {
    const f = () => bump((x) => x + 1);
    document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);
  if (!c.n) return null;
  const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
  return createPortal(
    <div className="countdown" role="status" aria-live="assertive">
      <b key={`${c.label}${c.n}`}>{c.n}</b>
      <span>{c.label ? `${c.label} · recording in` : 'Recording in'}</span>
    </div>, host
  );
}

function MidiPanel() {
  const status = useExternal(midi.subscribe, midi.getStatus);
  const enabled = status.state === 'on' || status.state === 'wait';
  return <div className="util">
    <p className="hint" role="status">{status.msg || (status.devices.length ? status.devices.join(', ') : 'Connect a MIDI keyboard to play and record the synth.')}</p>
    <div className="util-btns">
      <button type="button" className="switch" onClick={enabled ? midi.disconnect : midi.connect}>{enabled ? 'Disconnect MIDI' : 'Connect USB / MIDI'}</button>
      {midi.bluetoothSupported() && <button type="button" className="switch" onClick={midi.connectBluetooth}>Bluetooth MIDI</button>}
    </div>
    <p className="hint">USB keyboards use the phone’s USB connection. Bluetooth MIDI connects here; headphones and speakers use Android’s audio output.</p>
  </div>;
}
