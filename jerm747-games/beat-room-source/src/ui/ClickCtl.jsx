// Metronome switch + "Click on REC" switch, shown wherever you record, so you can see the click
// is on before a take. Both drive the one shared metronome.
import { blip, getSettings, onSettings, setSetting } from '../engine/audio.js';
import { onRun, onStep } from '../engine/clock.js';
import { metroOn, toggleMetro } from '../utils/Metronome.jsx';
import { Led, useExternal } from './parts.jsx';
import { useEffect, useState } from 'react';

export default function ClickCtl({ compact = false }) {
  const on = useExternal(onRun, metroOn);
  const set = useExternal(onSettings, getSettings);
  const [beat, setBeat] = useState(-1);
  useEffect(() => onStep((i) => setBeat(i < 0 ? -1 : i % 4 === 0 ? Math.floor(i / 4) : -2)), []);
  const flash = on && beat >= 0;
  return (
    <span className={`click-ctl ${compact ? 'compact' : ''}`} role="group" aria-label="Metronome">
      <button type="button" className={`switch click-sw ${on ? 'on' : ''} ${flash ? 'flash' : ''} ${flash && beat === 0 ? 'one' : ''}`} aria-pressed={on} onClick={() => { blip(on ? 520 : 1040); toggleMetro(); }} title="Metronome click on or off">
        <Led on={flash || (on && beat === -1)} color={flash && beat === 0 ? '#ff6a3d' : 'var(--c-tools)'} />Click {on ? 'on' : 'off'}
      </button>
      <button type="button" className={`switch ${set.clickOnRec ? 'on' : ''}`} aria-pressed={set.clickOnRec} onClick={() => { blip(700); setSetting('clickOnRec', !set.clickOnRec); }} title="Turn the click on automatically while recording, then back off">
        <Led on={set.clickOnRec} color="var(--c-tools)" />{compact ? 'On REC' : 'Click on REC'}
      </button>
    </span>
  );
}
