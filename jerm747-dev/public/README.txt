JERM747.DEV — PATCH BAY 0.1.1 SITE UPDATE

Upload these into the jerm747.dev document root (overwrite existing files):

  apps/index.html                      rack page: new Patch Bay badge, APK 0.1.1 link
  apps/rack.css, apps/rack.js          badge layout, finish swap, activity lights
  apps/android-tools.js                rack activity tracking
  apps/patchbay-blue.webp              Patch Bay badge (blue finish)
  apps/patchbay-black.webp             Patch Bay badge (black finish)
  apps/beat-room/index.html            loads the new header stylesheet
  apps/beat-room/patchbay-brand.css    Beat Room header plate
  apps/beat-room/beat-room-header.webp
  sites/patch-bay/index.html           splash page: badge button, APK 0.1.1 link

Files NOT included because they are already live and unchanged:
  tower.css, catalog.js, leather.webp, nameplate-blue/black.webp, app-covers/

BEFORE UPLOADING, put the signed APK here:
  apps/download/PatchBay-0.1.1.apk

Both pages link to that exact file. Sign PatchBay-0.1.1-unsigned.apk with the
same keystore as the 0.1.0 download so it upgrades in place:

  apksigner sign --ks "$PATCH_BAY_KEYSTORE" --ks-key-alias "$PATCH_BAY_KEY_ALIAS" \
    --out PatchBay-0.1.1.apk PatchBay-0.1.1-unsigned.apk
  apksigner verify --print-certs PatchBay-0.1.1.apk
  # SHA-256 should be 4f0baf449af63877f6d09b29f6e8482735e612437f91cfe8251f813581393c99

Keep PatchBay-0.1.0.apk in apps/download/ until 0.1.1 is confirmed working.

After upload, hard-refresh /apps/ and /sites/patch-bay/, flip Blue/Black,
open Beat Room, and tap the APK button on a phone to confirm it installs.
