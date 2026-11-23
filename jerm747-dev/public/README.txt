JERM747.DEV — PATCH BAY 0.1.2 SITE UPDATE

Extract into the jerm747.dev document root and overwrite:

  apps/download/PatchBay-0.1.2.apk     the new Android build (download link target)
  apps/index.html                      rack page: stacked nameplate + badge, APK 0.1.2 link
  apps/rack.css, apps/rack.js          0.1.2 rack styling and alignment, ported from the app
  apps/android-tools.js                rack activity tracking
  apps/patchbay-blue.webp / -black.webp  Patch Bay badges
  apps/beat-room/*                     Beat Room header plate
  sites/patch-bay/index.html           splash page, APK 0.1.2 link

Not included (already live, unchanged): tower.css, catalog.js, leather.webp,
nameplate-*.webp, app-covers/, the individual tool pages.

Note: this APK is the preview build (package com.jerm747.patchbay.v012).
It installs as its own app next to any older Patch Bay; uninstall 0.1.0/0.1.1 first.
You can remove PatchBay-0.1.1.apk from apps/download/ if it was uploaded.

After upload: hard-refresh /apps/ and /sites/patch-bay/, flip Blue/Black and
Rack/Grid, and tap the APK button on a phone to confirm it installs.
