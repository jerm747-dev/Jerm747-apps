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
| Keyboard synth | new (v0.2) | 3 oscillators (saw/square/sine, coarse + fine detune, level), amp ADSR, oscilloscope, patch save/recall, layer a second patch (Blend, Merge), octave −/+, 1–3 octave keyboard, computer keys, Web MIDI |

### v0.2
- **Rhythm composer:** 16 or 32 steps (×2 copies bar one into bar two, ½ goes back), two pages of 16 with Follow, an Extra kit (snare, 808 boom, toms, conga, cowbell, shaker, snap, crash, zap), live pads (keys 1–5) and **loop record**: REC plays one pass as a count-in (or waits for the top if already looping), records pad hits for one pass, then stops recording and keeps looping.
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
src/theme/theme.css    the tokens: one accent per section (--c-tape, --c-vinyl, --c-pads, --c-tools, --c-synth)
```

The mic only works over https or on localhost.
