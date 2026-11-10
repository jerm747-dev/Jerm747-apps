// Song strip at the top of the boombox: one transport for the whole room. Four sections
// (A–D) hold their own beat; tap one to edit it in the rhythm composer. Song plays every
// section that has notes, in order; Loop repeats the one you're editing.
import { useEffect, useState } from 'react';
import * as pads from '../engine/pads.js';
import { onStep, getBpm, setBpm, onBpm, onRun } from '../engine/clock.js';
import { blip } from '../engine/audio.js';
import { Led, useExternal } from '../ui/parts.jsx';

export default function SongBar() {
  const song = useExternal(pads.onSong, pads.getSong);
  const playing = useExternal(onRun, pads.isPlaying);
  const bpm = useExternal(onBpm, getBpm);
  const [pos, setPos] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  useEffect(() => onStep((i, abs) => setPos(i < 0 || !pads.isPlaying() ? null : pads.posAt(abs))), []);
  if (!song) return null;
  const others = pads.SECTIONS.map((n, i) => ({ n, i })).filter((x) => x.i !== song.edit);

  return (
    <div className="songbar" role="group" aria-label="Song">
      <div className="song-transport">
        <button type="button" className="song-play" onClick={() => { blip(880); pads.play(!playing); }} aria-pressed={playing} aria-label={playing ? 'Stop' : 'Play'}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M7 5v14l12-7z" />}</svg>
        </button>
        <div className="seg song-mode" role="radiogroup" aria-label="Play mode">
          <button type="button" role="radio" aria-checked={song.mode === 'song'} className={`switch ${song.mode === 'song' ? 'on' : ''}`} onClick={() => { blip(640); pads.setMode('song'); }}>Song</button>
          <button type="button" role="radio" aria-checked={song.mode === 'loop'} className={`switch ${song.mode === 'loop' ? 'on' : ''}`} onClick={() => { blip(560); pads.setMode('loop'); }}>Loop</button>
        </div>
        <label className="tempo song-tempo">BPM <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(+e.target.value)} aria-label="Tempo" /> <output>{bpm}</output></label>
        <span className="song-pos" aria-live="off">{pos ? <><b>{pads.SECTIONS[pos.sec]}</b>{String(pos.pos + 1).padStart(2, '0')}/{pos.len}</> : <><b>—</b>stopped</>}</span>
      </div>
      <div className="song-sections" role="tablist" aria-label="Sections">
        {song.info.map((sec, i) => {
          const live = pos && pos.sec === i;
          return (
            <button key={i} type="button" role="tab" aria-selected={song.edit === i} className={`song-sec ${song.edit === i ? 'sel' : ''} ${sec.notes ? '' : 'empty'} ${live ? 'live' : ''}`}
              onClick={() => { blip(500 + i * 90); pads.setEdit(i); setCopyMsg(''); }} aria-label={`Section ${pads.SECTIONS[i]}, ${sec.len} steps${sec.notes ? '' : ', empty'}`}>
              <Led on={!!live} color="var(--c-pads)" />
              <b>{pads.SECTIONS[i]}</b>
              <em>{sec.notes ? <>{sec.len}<span className="song-unit"> steps</span></> : 'empty'}</em>
              {live && <i className="song-prog" style={{ width: `${((pos.pos + 1) / pos.len) * 100}%` }} />}
            </button>
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
