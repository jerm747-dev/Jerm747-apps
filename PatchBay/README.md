# Jerm 747 Patch Bay 0.1.2

Patch Bay is an Android studio rack for MIDI Lane, Beat Room, MIDI Check, Rhythm Box, Vox Lane and Patch Play. All six tools launch from local assets. Beat Room 1.1.0 was bundled from the Jerm 747 Games deployment. Its standalone APK link opens in the browser.

Blue and gold is the first-run finish. The Black button applies black and gold. Rack is the stacked view. Grid arranges the tools as compact modules. The app remembers both choices.

The test APK requires Android 10 or newer and a current Android System WebView. Android Back returns to the rack from a tool. Microphone access is requested when a tool uses it. Exports go to Downloads. MIDI tools use Android's MIDI service and see devices registered with that service. The build has no in-app Bluetooth MIDI pairing screen.

The APK uses a test signing certificate. Build a release with your own keystore before distributing it. A differently signed APK cannot update the test installation in place.

## Build from source

Use a JDK with javac, Android SDK Platform 35, Android Build Tools 35.0.0, and zip. Set ANDROID_HOME, PATCH_BAY_KEYSTORE, and PATCH_BAY_KEY_ALIAS. Run ./build-apk.sh. The APK is written to build/PatchBay-0.1.2.apk. The script prompts for the keystore password unless PATCH_BAY_KEY_PASS is supplied.

Run ./build-apk.sh --unsigned to produce an aligned APK for signing elsewhere. Use the original certificate to upgrade an existing installation.

The native shell is in java/. The launcher and app payloads are in assets/apps/. For a desktop preview of the rack, serve assets/ through a static HTTP server and open /apps/.

The APK signature, bundled routes, rack layouts, finish persistence, search and simulated MIDI framing were checked. Physical Android device, microphone and MIDI-controller operation were not tested.
