Jerm747 Arcade 1.0.7
The device-test package uses com.jerm747.arcade.test and installs alongside the 1.0.6 test. The private test-signing backup applies to this package ID. Import device-test-keystore.properties and its keystore beside settings.gradle and run gradlew assembleDeviceTest to sign the same install target.

Jerm747 Arcade 1.0.6 · Cabinet and Beat Room controls

Open this folder in Android Studio with SDK 35 and JDK 17. Run the app module to build a local debug install, or use gradlew assembleDebug (gradlew.bat on Windows). The prebuilt signed test APK uses com.jerm747.arcade. Gradle debug builds use com.jerm747.arcade.debug, so they install separately.

Swipe sideways on a list case to open it on the shelf. Tap the selected cover to enlarge it. The illuminated visor in the header opens cabinet settings. Select a game to open its title visor and choose a mode. During play, tap the small visor or press controller Start to pause. Resume or the X returns to the same game. Game title opens the mode choices again, and Cabinet shelf returns to the cabinet. Android Back closes HUD submenus first. Controller Select opens cabinet settings from the shelf or list. GS Fighter III keeps its dedicated title and player menus. In Flight Control Deck, drag the flight field to look around, release to center, and pinch to set the zoom.

Cyborg Coliseum v0.2 Flight Systems brings its original character, flight, chest cannon and arena to the arcade. Controller Check uses the sculpted 747 controller art. The original letter artwork is in art-archive/controller-check-old-cover-with-crt-filter.html.

Cabinet settings > Preserve game state enables live switching. During play, open the visor > Open games > Browse all games to launch another title. Choose a paused game to resume it in place, or Close beside its name to release its memory. This option starts off. Turning it off prevents new sessions being kept; games already parked remain available until resumed or closed. Sessions last for this running arcade. Quitting, reloading or the operating system reclaiming the process ends them. Games' own saves continue to work independently. Controller Test in the visor reads raw buttons, analog triggers and sticks without leaving the game. Test rumble is available for devices that expose a rumble actuator.

Beat Room includes its tape sampler, sequencer, turntable, tuner and metronome. Tap REC or Listen to request the microphone. The turntable can import an audio file from the Android document picker. Its editable React project is in beat-room-source/.

The complete offline cabinet and playable games are in app/src/main/assets. The game list is in cabinet.js. Corresponding title actions and game-specific options are in arcade-visor.js. Shared visor assets are in hud/. Catalog Clash uses the compiled journey files and catalog-clash-level10.html. To rebuild the illustrated chapter UI after editing story-source, run npm install and npm run build from story-source. Gradle alone can rebuild the included Android app without this step.

Encore and CD Man are based on the bundled Encore 1.2.0 build. CD Man has a distance-synchronized walk for the arcade edition. The source includes no signing keystore. Configure a keystore.properties file locally if signing a release with your own key; see app/build.gradle.

Tap or drag anywhere on the larger map under Visor settings > Move HUD icon. The icon moves on contact and its position saves throughout the drag. Placing it from the cabinet sets the cabinet and default game position. Placing it inside a game sets that game’s position. Controller Check appears last on the shelf, in the list, and in the visor game launcher.


Arcade 1.0.6
The List/Grid slider accepts taps, drags, and arrow keys. Play game is a solid button. In portrait, the Beat Room turntable has a separate transport strip, and the record picker has its own row on phones.

747 Pocket Player home — next Android build

The website now has /pocket-player/, a finish-aware site menu entry and a one-time Ice Blue introduction on the Arcade shelf. Its cartridge links enter the browser Arcade in Pocket mode with the previewed finish.

For the next Arcade APK, keep access in the existing HUD. Add a Pocket Player entry to the cabinet HUD for previewing Ice Blue and Classic before choosing a cartridge. Keep the in-game Pocket view toggle and Visor settings > Pocket finish available during play. Reuse the existing Android preference and game-session paths so changing finish preserves the running game.

The public About/Contact drawer, browser landing page and first-visit website introduction are web features in this release. The controller haptics and analog joystick are still workshop prototypes. Device-test an upgrade from 1.0.12, a fresh install, controller focus, and the Android back button before including new APK behavior.
