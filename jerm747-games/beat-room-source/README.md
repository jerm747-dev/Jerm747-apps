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

### v0.2
- **Settings** (under the brand plate): Button clicks on/off. Audio now starts on the first tap on phones (iPhone needs a finger lift) and ignores the iPhone silent switch where Safari allows it.
- **Song strip** (top of the boombox): one transport, BPM, and four sections A–D. Each section has its own steps and length (rows, sounds and mixer are shared). Tap a section to edit it; **Song** plays every section with notes in order, **Loop** repeats the one you're editing; copy a section to another to build variations. Loop record always works on the section you're editing.
- **747 Drive** (master character, next to the song strip): our own transformer-style color stage. Drive (asymmetric, mostly 2nd-harmonic saturation, 4× oversampled), Iron (low end saturates first), Warmth (top roll-off), Air (+3 / +6 dB high shelf), Glue (slow bus compressor with GR meter), Output trim. Modes Clean / Warm / Iron / 747 are starting points.
- **Scope button:** the round scope button above the keys moves the oscilloscope down beside the keyboard; the same button at the top brings it back.
- **Rhythm composer:** 16, 32 or 64 steps (going longer repeats what's there), pages of 16 with Follow, Load sound on any row (pick a file from the device), an Extra kit (snare, 808 boom, toms, conga, cowbell, shaker, snap, crash, zap), live pads (keys 1–5) and **loop record**: REC plays one pass as a count-in (or waits for the top if already looping), records pad hits for one pass, then stops recording and keeps looping.
- **Turntable:** Play·Pause spins down and leaves the needle where it is; tap the record to drop the needle. Start·Stop still lifts and starts over.
- **Full screen** button on the tape deck, rhythm composer, turntable and synth. Falls back to filling the window where the browser won't allow true full screen (iPhone, WebViews). In full screen the synth keyboard is pinned to the bottom and widens to 3 octaves on big screens.
- **MIDI** needs Chrome/Edge (desktop or Android) and https or localhost. Safari has no Web MIDI.

### v0.3 (lab)
- **Top bar:** Tempo, Metronome, Tuner and Output are small buttons with live readouts (BPM, beat LEDs, note, level). Each opens its full panel in a pop-up with **Bigger** and **Full screen**. The tuner keeps listening when its pop-up is closed. Output has a speakers on/off switch and shows the device's audio latency.
- **Transport:** Click and Count-in switches sit next to Play in the song strip.
- **Minimize** any section (tape deck, rhythm composer, turntable, synth, 747 Drive).
- **Count-in:** 0, 1 or 2 bars of click before any REC from a stop, with a big countdown. Clicks go to a monitor path, so the tape never records them.
- **Tape deck records the room:** Record from Mic, Room (everything playing, after 747 Drive) or Both. Raw PCM via AudioWorklet (ScriptProcessor fallback), sample-exact start on the downbeat. Song on REC starts the song with the take. Length Free / 1 / 2 / 4 / 8 bars stops exactly on the bar line.
- **Synth note lane:** REC records one pass of the section from touch, computer keys or MIDI, overdubs on top, plays back with the song. Quantize while recording, Snap, Undo, Clear, mini piano roll (tap a note to hear it, then delete it). Latency is compensated when placing notes.
- **5-channel mixer** under the rhythm composer: per channel sound, Load (or drop a file), High/Mid/Low EQ, level, mute, solo, meter.
- **Lower latency:** synth notes start on the next audio block (no added offset), the synth's safety limiter is a WaveShaper instead of a compressor (no lookahead delay), the 747 Drive glue comp is out of the path while Glue is off, and MIDI connect pre-builds the synth.

- **Song repeats:** each section has a repeat count (default ×1, type it or −/+, up to ×64). Song mode plays each section that many times before moving on. Song mode lights green, outlines the sections in the song, and tags the one that plays next (or first).
- **Click on REC:** a Click switch with a beat light sits next to every REC (composer, note lane, tape). With Click on REC on (default), the metronome turns on for the take and back off after. It never lands on tape.
- **747 Drive presets** sit in the subtle 0–20% range; the knobs still go to 100%.
- **Export:** name the song, WAV (16-bit) or MP3 (192 kbps, lamejs from cdnjs; bundle it for offline builds), whole song in Song order with repeats or one section. Bounces in real time through the Room recorder. Every bounce lands on the **Saved songs** shelf (IndexedDB) with a snapshot of the room: play it, save the file, send it to the tape library, or **Recall** to put the patterns, notes, mixer, tempo, patch and Drive back.

- **Quantize grid:** 1/4, 1/8, 1/8T, 1/16 (default), 1/16T, 1/32, 1/64 for Quantize and Snap.
- **Turntable:** pitch −/+ buttons (0.5% a tap, hold to keep going, 0 resets); the pitch fader shows only in full screen, so it doesn't fight page scrolling. **Vinyl mode in full screen:** the turntable runs on an AudioWorklet deck (engine/turntable.js). Put a finger on the record and the groove follows it 1:1 (one turn = 1.8 s): slow = slowed sound, still = silence, backward = reversed, whip = fast. Let go and it keeps your speed, then the motor takes over. **Cut** pad = crossfader cut (hold to kill the sound). A quick tap still drops the needle. Without AudioWorklet the deck falls back to plain playback (no scratching).
- **Build numbers:** `npm run build` bumps the last digit of the version in package.json first (prebuild), and the footer shows it.

- **Bounce** (was Export): every bounce also lands in the **Sample bin**, so it's on the turntable, pads and tape right away. Put on turntable from the bounce window.
- **Sample bin** (top bar, or the turntable's Sample bin button): one list of every sample in the room (takes, room recordings, prints, files, bounces), filter by kind, preview, rename, put on the turntable, send to a pad channel, delete, add files (or drop them on it).
- **MIDI in the note lane:** Import MIDI loads a .mid phrase into the section you're editing (merges all tracks, skips the drum channel, trims empty bars at the top, sets the section to 16/32/64 steps to fit; Undo restores). Export MIDI saves the section's notes as a .mid at the song tempo.

- **Tempo stepper** in the rhythm composer and the song transport: − / + (tap for 1 BPM, hold to keep going, faster after 2 s), type a BPM (40–220; arrow keys, Shift for 10), and a Tap key styled like the MPC Renaissance REC key (red light flashes on each tap).

- **Analog vinyl model** (turntable Analog switch, Vinyl/Digital): records are cut with the RIAA curve (engine/vinylcut.js) and played through a phono stage (RIAA de-emphasis + preamp warmth) in the deck worklet; the cartridge output follows groove speed; the platter is a mass on a spring (14 Hz, critically damped) pulled by the hand, with touch events as smoothed corrections and coalesced pointer samples (±1.5% speed wobble on a steady drag, ~20 ms to reverse); 4-point cubic reads with filtered copies for fast moves; constant-torque motor (0.6 s up, 0.35 s brake) with wow and flutter; Dust (Clean/Light/Dusty) is pressed into the groove so it scratches with the record. test/sim.mjs and test/simrev.mjs run the deck DSP in Node.

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
