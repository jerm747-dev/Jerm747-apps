JERM747.DEV — PATCH BAY 0.1.3 SITE UPDATE

Extract into the jerm747.dev document root and overwrite:

  apps/download/PatchBay-0.1.3.apk     the new Android build (download link target)
  apps/index.html                      rack page, APK 0.1.3 link
  sites/patch-bay/index.html           splash page, APK 0.1.3 link
  apps/tool-nav.js                     NEW: back arrow by each tool's nameplate, tap clean
  apps/vox-lane.html                   Clear button, sturdier Rec, better note detection
  apps/midi-lane/index.html            loads tool-nav.js
  apps/rhythm-box-v0.1.0.html          loads tool-nav.js
  apps/patch-play.html                 loads tool-nav.js
  apps/midi-controller-check-index-v.0.1.0.html   loads tool-nav.js
  apps/beat-room/index.html            loads tool-nav.js

Delete after upload (replaced by tool-nav.js): apps/web-back.js
You can also delete apps/download/PatchBay-0.1.2.apk.

Not included (already live, unchanged): rack.css, rack.js, catalog.js,
android-tools.js, badges, nameplates, app-covers/, the other tool files.

Note: this APK is the preview build (package com.jerm747.patchbay.v013).
It installs as its own app next to Patch Bay 0.1.2; uninstall 0.1.2 first
so you don't end up with two Patch Bay icons.

After upload: hard-refresh /apps/ and /sites/patch-bay/, open Vox Lane and
check the ‹ arrow and Clear button, and tap the APK button on a phone to
confirm it installs.
