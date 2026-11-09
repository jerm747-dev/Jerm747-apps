// Jerm747 Beat Room: one boombox, one engine.
//   Handle strip: metronome · tuner · output
//   Console: song strip (sections A–D, one transport) · 747 Drive (master character)
//   Front: left speaker · tape deck sampler · right speaker
//   Rack: rhythm composer, turntable, keyboard synth
// Everything plays into the same bus, keeps the same tempo, and shares the sample library.
import { useEffect } from 'react';
import TapeDeck from './decks/TapeDeck.jsx';
import VinylDeck from './decks/VinylDeck.jsx';
import Synth from './decks/Synth.jsx';
import Sequencer from './decks/Sequencer.jsx';
import Metronome from './utils/Metronome.jsx';
import Tuner from './utils/Tuner.jsx';
import Speaker from './chassis/Speaker.jsx';
import Master from './chassis/Master.jsx';
import Drive from './chassis/Drive.jsx';
import SongBar from './chassis/SongBar.jsx';
import { Screws } from './ui/parts.jsx';
import { audio } from './engine/audio.js';
import * as library from './engine/library.js';

export default function App() {
  useEffect(() => {
    library.loadAll();
    // wake the audio engine on the first touch anywhere, so the speakers are live right away
    const wake = () => { audio(); window.removeEventListener('pointerdown', wake); };
    window.addEventListener('pointerdown', wake);
    return () => window.removeEventListener('pointerdown', wake);
  }, []);

  return (
    <main className="room">
      <div className="boombox">
        <div className="handle" aria-hidden="true"><span /></div>
        <div className="body brushed">
          <Screws />
          <header className="strip">
            <div className="plate">
              <h1><b>Jerm747</b> Beat Room</h1>
              <p className="engrave">Virtual boombox kit · Your music. Your way.</p>
            </div>
            <div className="utils">
              <Metronome />
              <Tuner />
              <Master />
            </div>
          </header>
          <div className="console">
            <SongBar />
            <Drive />
          </div>
          <div className="front">
            <Speaker side="L" />
            <TapeDeck />
            <Speaker side="R" />
          </div>
        </div>
      </div>

      <div className="rack">
        <Sequencer />
        <VinylDeck />
        <Synth />
      </div>

      <footer className="foot">
        <p><b>The flow:</b> record on the tape → shape it → print → send to the pads → EQ the row → play it over the metronome.</p>
        <p className="engrave">Jerm747 · Beat Room v0.2</p>
      </footer>
    </main>
  );
}
