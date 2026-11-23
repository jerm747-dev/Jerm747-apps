# MIDI Lane 1.0 (Jerm747)

See CHANGELOG.md for versions. The version number lives in js/model.js (VERSION).

Full-screen MIDI editor with two built-in instruments: **Avionyx** (3-osc FM keys synth) and **Drumway** (909-style drum synth), both running through **Black Box** (tape) and **747 Drive**.

No build step: plain ES modules. Upload the whole folder to any https host (e.g. jerm747.games/midi-lane/) and open index.html.
For local testing: `python3 -m http.server` in this folder, then open http://localhost:8000 (USB MIDI needs https or localhost, in Chrome/Edge).

- js/model.js: project, tracks (max 16), undo, snap, quantize, half quantize, .mlane format
- js/lanes.js: Rhythm Lane + Key Lane canvases (pinch zoom, box select, group drag)
- js/player.js: scheduler, Web MIDI out, previews, offline MP3 bounce
- js/avionyx.js / js/drumway.js: the instruments
- js/audio.js: Black Box + 747 Drive (ported from Beat Room tapefx.js / character.js)
- js/smf.js: MIDI read/write (type 1, all tracks + channel 10)
- js/rack.js: the fold-out rack UI
- js/recorder.js: Record screen (take / free, click, count-in, review, send to lane)
- js/importer.js: MIDI import mapping (parts to channels / tracks)
- js/live.js: Live MIDI routing (input → output routes, monitor, presets, loop guard)
- vendor/lame.min.js: MP3 encoder (lamejs 1.2.1, LGPL; license files alongside)

Android APK: the WebView has no Web MIDI. Expose `window.MidiLaneAndroid.midiSend(jsonBytes, delayMs)` from the native side (android.media.midi) and MIDI Lane sends through it automatically. For MIDI in, have the native side call `window.midiLaneIn(status, data1, data2)` for each message; Record and Live pick it up as "Android MIDI".
.mlane files are plain JSON.
