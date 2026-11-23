# MIDI Lane changelog

Version lives in `js/model.js` (`VERSION`). Bump it there and add an entry here.

## 1.0 — 2026-11-22
First release.
- Rhythm Lane (black step-key panel) and Key Lane (piano roll), sharing one view; up to 16 tracks, one colour per MIDI channel, Drum switch for channel 10
- Draw / Select, box select and group drag, snap 1/4 to 1/64 (off = 1/128), Quantize and Half Quantize, beat shift, Dup, octave, Clear
- Auto view, pinch zoom, scroll strip, full-screen lane with a per-note velocity lane
- Avionyx (3-osc FM keys synth) and Drumway (909-style drum synth), each through Black Box (tape) and 747 Drive, in fold-out racks
- Playback to the built-in sounds and USB MIDI out at once
- Record screen: take or free, click, count-in, play-along, review, send all or part of a take to a lane
- Live: MIDI routing board with routes, channel remap, test notes, monitor, presets, loop guard
- Files: .mlane projects (JSON), MIDI import with channel-to-track mapping, MIDI and MP3 export
