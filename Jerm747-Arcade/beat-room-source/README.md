# Jerm747 Beat Room

A virtual boombox kit: one engine, one tempo, one sample library.

```
npm install
npm run dev      # open the URL it prints (localhost, so the mic works)
npm run build    # static site in dist/, upload anywhere
```

## What's in the box

| Section | Where it came from | What's new |
| --- | --- | --- |
| Tape deck | Returnity `TapeDeck` | REC from the mic, tape character (wow, flutter, saturation, low/high), Print, Send to pads, library list |
| Rhythm composer | Returnity `BeatPad` + `beat.js` | 5th "Tape" row, per-row channel strip (source, low/mid/high EQ, level, mute), swap any row to a synth voice or a library clip |
| Turntable | Returnity `Turntable` | Spins library clips or any audio file you load; 33/45 + pitch change speed live |
| Metronome | new (jerm747.com one not ported yet) | Rides the shared clock, tap tempo, accent on 1 |
| Tuner | new (jerm747.com one not ported yet) | Chromatic, cents needle in the VU style |
| Speakers + output | new | Woofers pump with the low end, tweeter glows with highs, LED ladder + master knob |
| Keyboard synth | new (v0.2) | 3 oscillators (saw/square/sine, coarse + fine detune, level), amp ADSR, 3-band EQ with sweepable mid, fold any panel to a one-line bar, Stack or Tabs view for the oscillators, oscilloscope, patch save/recall, layer a second patch (Blend, Merge), octave −/+, 1–3 octave keyboard, computer keys, Web MIDI |

### v0.2.1
- Controller browsing: L1/R1 selects a module. A enters it, B returns to module selection. In a module L1/R1 browses controls, rhythm pages, or oscillator tabs. L2/R2 jumps modules directly. D-pad or left stick moves. A uses a control or toggles a step. Flick right stick up to set a step, down to clear. The right stick adjusts knobs. Pocket X/Y decrease/increase or clear/set.
- Rhythm composer: use **Map pads**, select a row, then press its new button. Assignments follow rows when a sound changes and are saved on this device. Choosing an occupied button swaps the two assignments. Select and Start stay available for mode switching and the arcade HUD.
- **Play mapped pads** or Select switches into pad mode. **Record mapped pads** enters pad mode and arms the existing loop recorder. From stop, play after the count-in. An empty row becomes playable when you load it with a sound. Select returns to editing.
- Synth: from a synth button, Y jumps to the keys. Move left/right by semitone, hold A to sound the highlighted key, move the right stick sideways for ±2 semitones of bend, and push it up for vibrato. Releasing the stick centers both. Computer keys, touch chords and MIDI remain available.
- Keyboard editing: Page Up/Down selects a module and Enter enters it. Tab visits controls. Arrow keys move through the rhythm grid. Enter toggles a step, and Shift+Up/Down sets/clears it. Use 1–5 for live pads. Tap or press a keyboard key once if the browser requires a gesture to enable audio.

### v0.2
- **Settings** (under the brand plate): Button clicks on/off. Audio now starts on the first tap on phones (iPhone needs a finger lift) and ignores the iPhone silent switch where Safari allows it.
- **Song strip** (top of the boombox): one transport, BPM, and four sections A–D. Each section has its own steps and length (rows, sounds and mixer are shared). Tap a section to edit it; **Song** plays every section with notes in order, **Loop** repeats the one you're editing; copy a section to another to build variations. Loop record always works on the section you're editing.
- **747 Drive** (master character, next to the song strip): our own transformer-style color stage. Drive (asymmetric, mostly 2nd-harmonic saturation, 4× oversampled), Iron (low end saturates first), Warmth (top roll-off), Air (+3 / +6 dB high shelf), Glue (slow bus compressor with GR meter), Output trim. Modes Clean / Warm / Iron / 747 are starting points.
- **Scope button:** the round scope button above the keys moves the oscilloscope down beside the keyboard; the same button at the top brings it back.
- **Rhythm composer:** 16, 32 or 64 steps (going longer repeats what's there), pages of 16 with Follow, Load sound on any row (pick a file from the device), an Extra kit (snare, 808 boom, toms, conga, cowbell, shaker, snap, crash, zap), live pads (keys 1–5) and **loop record**: REC plays one pass as a count-in (or waits for the top if already looping), records pad hits for one pass, then stops recording and keeps looping.
- **Turntable:** Play·Pause spins down and leaves the needle where it is; tap the record to drop the needle. Start·Stop still lifts and starts over.
- **Full screen** button on the tape deck, rhythm composer, turntable and synth. Falls back to filling the window where the browser won't allow true full screen (iPhone, WebViews). In full screen the synth keyboard is pinned to the bottom and widens to 3 octaves on big screens.
- **MIDI** needs Chrome/Edge (desktop or Android) and https or localhost. Safari has no Web MIDI.

## The flow

Record on the tape → shape it → **Print** (bakes the tape sound into a new clip) → **Send to pads** → EQ the row → play it over the metronome.

## How it's wired

```
src/engine/audio.js    one AudioContext: everything -> bus -> master -> analyser -> out
src/engine/clock.js    shared tempo; "parts" (pattern, click) ride one 16th-note transport
src/engine/library.js  sample library, saved in the browser (IndexedDB)
src/engine/pads.js     sequencer rows, each with its own channel (channel.js)
src/engine/tapefx.js   tape chain, runs live and offline (for Print)
src/engine/mic.js      mic access + recording (MediaRecorder)
src/engine/pitch.js    tuner pitch detection
src/engine/synth.js    keyboard synth voices, ADSR, patches, layer
src/engine/midi.js     Web MIDI input -> synth
src/engine/character.js  747 Drive master stage (between bus and master)
src/theme/theme.css    the tokens: one accent per section (--c-tape, --c-vinyl, --c-pads, --c-tools, --c-synth)
```

The mic only works over https or on localhost.
