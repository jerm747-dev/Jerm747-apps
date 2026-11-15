// Song strip at the top of the boombox: one transport for the whole room. Four sections
// (A–D) hold their own beat; tap one to edit it in the rhythm composer. Song plays every
// section that has notes, in order; Loop repeats the one you're editing.
import { useEffect, useState } from 'react';
import * as pads from '../engine/pads.js';
import { onStep, getBpm, onBpm, onRun } from '../engine/clock.js';
import { blip, getSettings, onSettings, setSetting } from '../engine/audio.js';
import { metroOn, toggleMetro } from '../utils/Metronome.jsx';
import { Led, useExternal } from '../ui/parts.jsx';
import { ExportBtn } from './ExportPanel.jsx';
import TempoStep from '../ui/TempoStep.jsx';

export default function SongBar() {
  const song = useExternal(pads.onSong, pads.getSong);
  const playing = useExternal(onRun, pads.isPlaying);
  const bpm = useExternal(onBpm, getBpm);
  const metro = useExternal(onRun, metroOn);
  const set = useExternal(onSettings, getSettings);
  const [pos, setPos] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  useEffect(() => onStep((i, abs) => setPos(i < 0 || !pads.isPlaying() ? null : pads.posAt(abs))), []);
  if (!song) return null;
  const others = pads.SECTIONS.map((n, i) => ({ n, i })).filter((x) => x.i !== song.edit);
  const isSong = song.mode === 'song';
  // what Song mode plays next: the same section again while it has repeats left, else the next one with notes
  const repeating = !!pos && pos.rep + 1 < pos.reps;
  const firstWithNotes = song.info.findIndex((x) => x.notes);
  const nextSec = pos ? (repeating ? pos.sec : pads.nextAfter(pos.sec)) : firstWithNotes;

  return (
    <div className="songbar" role="group" aria-label="Song">
      <div className="song-transport">
        <button type="button" className="song-play" onClick={() => { blip(880); pads.play(!playing); }} aria-pressed={playing} aria-label={playing ? 'Stop' : 'Play'}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M7 5v14l12-7z" />}</svg>
        </button>
        <div className="seg song-mode" role="radiogroup" aria-label="Play mode">
          <button type="button" role="radio" aria-checked={song.mode === 'song'} className={`switch song-switch ${song.mode === 'song' ? 'on' : ''}`} onClick={() => { blip(640); pads.setMode('song'); }}>Song</button>
          <button type="button" role="radio" aria-checked={song.mode === 'loop'} className={`switch ${song.mode === 'loop' ? 'on' : ''}`} onClick={() => { blip(560); pads.setMode('loop'); }}>Loop</button>
        </div>
        <button type="button" className={`switch ${metro ? 'on' : ''}`} aria-pressed={metro} onClick={() => { blip(metro ? 520 : 1040); toggleMetro(); }} title="Metronome click"><Led on={metro} color="var(--c-tools)" />Click</button>
        <button type="button" className={`switch ${set.countIn ? 'on' : ''}`} onClick={() => { const v = (set.countIn + 1) % 3; blip(600 + v * 200); setSetting('countIn', v); }} title="Count-in before any REC: off, 1 bar, 2 bars">
          <Led on={!!set.countIn} color="var(--c-tools)" />Count {set.countIn ? `${set.countIn} bar${set.countIn > 1 ? 's' : ''}` : 'off'}
        </button>
        <TempoStep id="song" />
        <ExportBtn />
        <span className={`song-pos ${isSong ? 'song-on' : ''}`} aria-live="off">{pos ? <><b>{pads.SECTIONS[pos.sec]}</b>{pos.reps > 1 && <span className="pos-rep">×{pos.rep + 1}/{pos.reps}</span>}{String(pos.pos + 1).padStart(2, '0')}/{pos.len}</> : <><b>—</b>stopped</>}</span>
      </div>
      <div className={`song-sections ${isSong ? 'song-on' : ''}`} role="tablist" aria-label="Sections">
        {song.info.map((sec, i) => {
          const live = pos && pos.sec === i;
          const inSong = isSong && sec.notes;
          const isNext = isSong && nextSec === i && !(live && repeating);
          return (
            <div key={i} className={`song-slot ${inSong ? 'in-song' : ''}`}>
              <button type="button" role="tab" aria-selected={song.edit === i} className={`song-sec ${song.edit === i ? 'sel' : ''} ${sec.notes ? '' : 'empty'} ${live ? 'live' : ''} ${inSong ? 'in-song' : ''} ${isNext ? 'next' : ''}`}
                onClick={() => { blip(500 + i * 90); pads.setEdit(i); setCopyMsg(''); }} aria-label={`Section ${pads.SECTIONS[i]}, ${sec.len} steps${sec.notes ? '' : ', empty'}${isSong ? `, plays ${sec.reps} time${sec.reps > 1 ? 's' : ''}` : ''}${isNext ? ', next' : ''}`}>
                <Led on={!!live} color={isSong ? 'var(--c-song)' : 'var(--c-pads)'} />
                <b>{pads.SECTIONS[i]}</b>
                <em>{sec.notes ? <>{sec.len}<span className="song-unit"> steps</span></> : 'empty'}</em>
                {isNext && <span className="song-next">{playing ? 'Next' : 'First'}</span>}
                {live && isSong && sec.reps > 1 && <span className="song-next">{pos.rep + 1}/{sec.reps}</span>}
                {live && <i className="song-prog" style={{ width: `${((pos.pos + 1) / pos.len) * 100}%` }} />}
              </button>
              <Reps i={i} reps={sec.reps} on={isSong} />
            </div>
          );
        })}
        <select className="song-copy" value="" onChange={(e) => { const i = +e.target.value; blip(900); pads.copyTo(i); setCopyMsg(`Copied to ${pads.SECTIONS[i]}.`); }} aria-label={`Copy section ${pads.SECTIONS[song.edit]} to another section`}>
          <option value="" disabled>{copyMsg || `Copy ${pads.SECTIONS[song.edit]} to…`}</option>
          {others.map(({ n, i }) => <option key={i} value={i}>Copy {pads.SECTIONS[song.edit]} → {n}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Repeat count for a section in Song mode: type a number or step it with − / +. Default 1 (plays once). */
function Reps({ i, reps, on }) {
  const [draft, setDraft] = useState(null);
  const set = (n) => { blip(560 + Math.min(n, 16) * 30); pads.setReps(i, n); };
  const commitDraft = () => { if (draft != null) { const n = parseInt(draft, 10); if (Number.isFinite(n)) set(n); setDraft(null); } };
  const name = pads.SECTIONS[i];
  return (
    <div className={`song-reps ${on ? 'on' : ''}`} role="group" aria-label={`Section ${name} repeats`} title={on ? `Section ${name} plays ${reps} time${reps > 1 ? 's' : ''} in Song mode` : 'Repeats apply in Song mode'}>
      <button type="button" className="rep-step" onClick={() => set(reps - 1)} disabled={reps <= 1} aria-label={`Fewer repeats of ${name}`}>−</button>
      <label className="rep-val"><span aria-hidden="true">×</span>
        <input id={`reps-${name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={draft ?? String(reps)} aria-label={`Times section ${name} plays`}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onBlur={commitDraft}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); if (e.key === 'ArrowUp') { e.preventDefault(); set(reps + 1); } if (e.key === 'ArrowDown') { e.preventDefault(); set(reps - 1); } }} />
      </label>
      <button type="button" className="rep-step" onClick={() => set(reps + 1)} disabled={reps >= pads.MAX_REPS} aria-label={`More repeats of ${name}`}>+</button>
    </div>
  );
}
