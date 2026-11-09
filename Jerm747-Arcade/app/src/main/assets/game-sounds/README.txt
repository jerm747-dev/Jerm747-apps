GAME SOUNDS — EDIT THESE FILES

This folder sits beside package.json in your main project.
Replace punch.wav, kick.wav, v-wave.wav, ground-impact.wav, jump.wav or landing.wav with your own short audio clips, keeping the same filenames. Use real WAV audio, not an MP3 renamed .wav.
Run npm run build and upload dist as usual. The build publishes these files to dist/game-sounds and adds a content revision so listeners fetch changed clips.
You can use another format by updating that sound's file in manifest.json to a local filename (WAV, MP3, OGG or M4A). No game code changes needed. Keep clips short, ideally under a second; the build accepts up to 10 MB per clip.
Controller → Screen → Sound effects: effects On/Off, volume and preview buttons. These settings belong to each listener's browser and are separate from music.

Recovered punch, kick, V-wave and ground impact: GS-Fighter-1.0/public/audio/sfx, unchanged. Jump and soft landing: newly synthesized for build177. Punch/kick play on a committed attack, V-wave on its attack, jump on takeoff, landing on landing, ground impact when a defeated fighter reaches the floor.
