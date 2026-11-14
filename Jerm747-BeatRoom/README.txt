Jerm747 Beat Room — Android 1.0.3 test build

INSTALL
Open Jerm747-Beat-Room-1.0.3-test.apk on Android 8 or later and allow installation
from the app used to open it. Launcher name: Beat Room.
Package: com.jerm747.beatroom.debug. This is a development-signed test build.

WHAT CHANGED
Approved artistic boombox splash: expressive Beat Room lettering, warm amber and
teal studio lighting, textured boombox and vinyl record. The full image is shown
without cropping in portrait or landscape. A small CSS spinning record appears
below the artwork. The screen stays visible for 3.2 seconds after the image loads,
waits for saved sample loading, then fades out over 0.72 seconds. Tap to skip at
any time. Reduced-motion mode stops the spinner and shortens the fade.

New speaker launcher icon with metal rim, rivets, amber/teal light and brushwork.
The native Android launch icon matches. Both boombox and speaker icon candidates
are preserved under brand/; a comparison sheet shows launcher masks at 48/72 px.

Keyboard synth: Compact toggles a remembered compact layout. Waveform display,
oscillator summary, keyboard and preset name stay visible; editing panels and
note lane are hidden. Edited sounds show Custom. All controls restores editing.
MIDI and Bluetooth MIDI remain directly below the keys in both layouts. The
keyboard stays mounted while switching layouts, preserving live interaction.

747 Drive: the 747 preset starts at exactly 25% Drive. The knob remains fully
adjustable from 0 to 100%, and custom values survive app reloads. Selecting the
747 preset again recalls 25%. Iron, warmth, air and glue remain unchanged.

MIDI is now available from the top tool bar, as well as the synth. Connect USB MIDI
using USB OTG. For Bluetooth MIDI, tap Bluetooth MIDI, grant Nearby devices access
and choose an advertising MIDI device. Scanning stops after eight seconds or when
the picker closes. Android 8–11 may also require system Location enabled for BLE
scanning. This app's live MIDI bridge receives notes, velocity, sustain, pitch bend
and all-notes-off. MIDI file import/export remains included. MIDI clock sync,
SysEx and external live MIDI output are not implemented.

Native MIDI now handles running status, split packets and interleaved realtime
bytes. Messages from one packet cross into the page together. Each port has its
own parser. Notes release when a device is removed or the app is paused.

AUDIO
The shared Web Audio engine retains latencyHint: interactive. Vinyl, tape, synth,
sequencer and tap tempo remain on the existing shared engine. No splash animation,
Bluetooth scanning or additional polling is added to the audio processing path.
Phone volume buttons control music volume. Android selects the audio output, so
connected Bluetooth headphones/speakers can be used normally. Bluetooth audio and
Bluetooth MIDI are separate connections. The app cannot eliminate wireless audio
latency. Use the phone speaker, wired headphones or a USB interface to assess live
playing responsiveness. No physical-device latency measurements were made.

Core app assets are bundled. Optional online fonts and the MP3 encoder still
require a connection, as in the supplied project.

BUILD SOURCE
Android SDK 35, Java 17+, Gradle wrapper included. From Jerm747-BeatRoom:
  ./gradlew assembleDebug
The current web bundle is already in app/src/main/assets. To rebuild it:
  cd beat-room-source
  npm ci  # Node 22 recommended for the UI test tooling
  npm run android
The supplied GitHub Actions workflow also builds the APK.

SIGNING
The included test-signing/beatroom-test.jks is a PUBLIC DEVELOPMENT KEY ONLY.
Alias androiddebugkey; store/key passwords android. It permits future test updates
with the same key; it must never be used for a store release. Release signing uses
your private keystore.properties configuration, as in the original project.

VALIDATION
Web production build passed. Android sources compiled against SDK 35 and were
packaged using Android build-tools 35. APK alignment and v2/v3 signatures verified.
MIDI parser tests pass: split messages, running status, realtime, program change,
SysEx skipping and per-port isolation. Drive tests pass: 25% default and preset recall, full 0–100%
adjustment, and saved custom values. Icon masks and artwork were visually inspected. React DOM tests verify compact
layout, preset/Custom updates, persistent keyboard, MIDI below the keys, and
loading readiness/fade/skip. Full browser rendering was unavailable. Hardware MIDI, Bluetooth audio,
microphone recording and tap response still need testing on a physical phone.

Checks:
  node tests/drive.test.mjs
  javac -d parser-test app/src/main/java/com/jerm747/beatroom/MidiStreamParser.java tests/MidiStreamParserTest.java
  java -cp parser-test com.jerm747.beatroom.MidiStreamParserTest

UI checks from beat-room-source:
  npm run test:ui
