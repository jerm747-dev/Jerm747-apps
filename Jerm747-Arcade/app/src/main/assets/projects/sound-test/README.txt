GAME MUSIC 1.4.0 — game music player for jerm747.games
================================================

The Jerm747.games shelf discovers this project in the Music category.
Open it through the shelf at /#/play/game-music, or run this folder directly
on an HTTP server. The arcade host mounts the pop-up and keeps its music alive
when you return to the shelf. See START-HERE.txt in the distribution.

LOAD FROM YOUR DEVICE
Choose Load in the player, then Choose files or Choose folder. Audio from subfolders
is included. Imported tracks get their own local copies and can play alongside
the 60 bundled Jerm747 game themes.

ADD OR SWAP A BUNDLED SONG
  1. Put the audio in music/  (MP3 is safest; OGG/M4A also work)
  2. Put a square cover in covers/ (512x512 PNG looks best)
  3. Add an entry to tracks.json, copying an existing one:
       id       short name, letters and dashes
       title    shown in the list
       stage    "Castle stage", "Overworld", "Boss fight"...
       file     music/your-song.mp3
       cover    covers/your-song.png
       color    accent color for that song (hex)
       seconds  length, for the list before the file loads
       key, bpm, mood, voices, about   shown on the song page (optional)
  The order in tracks.json is the order in the list.

CONTROLS
  Keyboard: Space play/pause · Left/Right track · Shift+Left/Right seek 10s
            Up/Down pick a song · Enter play it · S shuffle · R repeat · M mute · I song page
  Controller: A play the picked song · X play/pause · Y song page · B back
              LB/RB previous/next track · D-pad left/right seek · up/down pick
  Touch: tap a song to play it, tap "i" for its song page.

Punch adds a light blend of soft saturation and a bass boost at 125 Hz.
Tap Punch or press D to compare it with the original mix during playback.
The setting is saved locally. On a controller, move up from the first track to
Load, then up once more to Punch. Press A to toggle.
