// Jerm747 Beat Room: one boombox, one engine.
//   Handle strip: brand · tool tray (tempo, metronome, tuner, output; each opens a pop-up)
//   Console: song transport (sections A–D) · 747 Drive (master character)
//   Front: left speaker · tape deck sampler · right speaker
//   Rack: rhythm composer, turntable, keyboard synth
// Everything plays into the same bus, keeps the same tempo, and shares the sample library.
import { useEffect, useState } from 'react';
import TapeDeck from './decks/TapeDeck.jsx';
import VinylDeck from './decks/VinylDeck.jsx';
import Synth from './decks/Synth.jsx';
import Sequencer from './decks/Sequencer.jsx';
import Speaker from './chassis/Speaker.jsx';
import ToolTray from './chassis/ToolTray.jsx';
import Splash from './chassis/Splash.jsx';
import Drive from './chassis/Drive.jsx';
import SongBar from './chassis/SongBar.jsx';
import Settings from './chassis/Settings.jsx';
import { Screws } from './ui/parts.jsx';
import { unlockOnGesture, getSettings, onSettings } from './engine/audio.js';
import { useExternal } from './ui/parts.jsx';
import * as library from './engine/library.js';

export default function App() {
  const [roomReady, setRoomReady] = useState(false);
  const set = useExternal(onSettings, getSettings);
  useEffect(() => {
    let mounted = true;
    library.loadAll().catch(() => {}).finally(() => { if (mounted) setRoomReady(true); });
    // wake the audio engine on the first gesture anywhere (phones need a finger lift)
    const stopUnlock = unlockOnGesture();
    return () => { mounted = false; stopUnlock(); };
  }, []);

  return (
    <main className="room">
      <Splash readyToEnter={roomReady} />
      <div className="boombox">
        <div className="handle" aria-hidden="true"><span /></div>
        <div className="body brushed">
          <Screws />
          <header className="strip">
            <div className="plate">
              <h1><b>Jerm747</b> Beat Room</h1>
              <p className="engrave">Virtual boombox kit · Your music. Your way.</p>
              <Settings />
            </div>
            <ToolTray />
          </header>
          <div className="console">
            <SongBar />
            <Drive />
          </div>
          <div className={`front ${set.speakers ? '' : 'no-speakers'}`}>
            {set.speakers && <Speaker side="L" />}
            <TapeDeck />
            {set.speakers && <Speaker side="R" />}
          </div>
        </div>
      </div>

      <div className="rack">
        <Sequencer />
        <VinylDeck />
        <Synth />
      </div>

      <footer className="foot">
        <p><b>The flow:</b> build a beat → play a part on the synth and REC it into the lane → record the whole room to tape → print → send it back to the pads.</p>
        <p className="engrave">Jerm747 · Beat Room Lab v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</p>
      </footer>
    </main>
  );
}
