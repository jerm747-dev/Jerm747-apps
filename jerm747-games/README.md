# jerm747.games

Games and game designs by Jerm747. A dark, controller-first arcade: pick a game from the shelf and
play it in the browser with a controller, keyboard, mouse or touch.

React (Vite) front end + a small PHP back end for the game list, visitor stats and email reports.
Runs on regular GoDaddy/cPanel hosting with no database.

## Pages

| Address | What it is |
|---|---|
| `jerm747.games` | The arcade |
| `jerm747.games/#/play/<folder>` | Opens one game directly, e.g. `#/play/cyborg-coliseum`. Use the **Copy link** button to share. |
| `jerm747.games/#/admin` | Your admin page: visitors, plays and email report settings (not linked anywhere) |

## Build

```bash
npm install
npm run build     # outputs dist/
```

Local development: `php -S localhost:8000 -t public` in one terminal, `npm run dev` in another.

## Deploy to GoDaddy

1. In cPanel → Domains, make sure jerm747.games points to its own folder (for example
   `public_html/jerm747.games/`), separate from jerm747.dev and jerm747.com.
2. `npm run build`, then upload **everything inside `dist/`** (including hidden `.htaccess` files)
   into that folder.
3. Open `https://jerm747.games/#/admin` right away and set your admin password (12+ characters).
   This site has its own password, separate from jerm747.dev.
4. Reports are emailed to admin@jerm747.dev and sent *from* that mailbox, which works because the
   sites share a hosting account. To change either, edit `ADMIN_EMAIL` / `MAIL_FROM` at the top of
   `public/api/lib.php`.

**When uploading a new build, never delete `api/data/` (your stats) or game folders you added in
`projects/`.**

## Integration Build · Arcade 1.0.3

Beat Room is on the web shelf at `/#/play/beat-room` and in Jerm747 Arcade for Android. Its editable project is in `beat-room-source/`. The playable build and shelf art live in `public/projects/beat-room/`.

The shelf footer links to `/download/`. Deploy the signed installers beside their cover images at `download/arcade/Jerm747-Arcade-1.0.3-Integration-Build.apk` and `download/encore/Encore-1.2.0.apk`. The GoDaddy integration ZIP includes both binaries and the changed public files. Extract its contents into the existing jerm747.games document root and merge the folders.

## Adding a game

Upload a folder with an `index.html` to `projects/` in cPanel File Manager. It shows up on the shelf
right away with its own shareable link; nothing to rebuild. Optional extras in the folder:

- `cover.jpg` or `cover.png`: tile art. **1280 × 720** (16:9) fills the frame edge to edge; other
  shapes still work, with a blurred fill around them.
- `project.json`: title, tagline, description, kind, status, version, controls, credit line
  ("Built for Example Co. All rights reserved."), order, `"hidden": true` to keep it off the shelf.

Full field list: `projects/README.txt`.

## Controls

Shelf: D-pad or stick to move, A to open, LB/RB to switch category, Y for fullscreen.
Keyboard: arrows, Enter, Q/E, F.

In a game: **hold Select + Start for 1.5 seconds** (or press Home, or hold Esc) to return to the
shelf. Browser Back also returns to the shelf.

**Controller bridge:** keyboard-only games can get controller support by adding a `"gamepad"` map to
`project.json`; the arcade presses the mapped keys. Cyborg Coliseum uses its native controller mapping.

## Included

- **Groove Squad Get Down** (2.3.7): the full game from jerm747.com with all 40 fighters open.
  No subscriptions on jerm747.games. Ranked Run keeps its leaderboard on each device. See below.
- **GS Fighter III** (1.2.0): the 3D fighter in the browser, plus its Android APK on a shareable
  download page. See below.
- **GS Fighter II** (1.0.17): the Android handheld edition in the browser, now branded GS Fighter II,
  plus its APK download page. See below.
- **Flight Control Deck** (v7): Asteroid Blast, races and free flight.
- **Cyborg Coliseum** (v0.2 Flight Systems) brings close combat, free flight and the rapid-fire chest cannon into the arena.
- **Controller Check**: test buttons, sticks, triggers and rumble.
- `cover-square.jpg` in the first two folders: your square cover art, kept as a backup.

## Traffic and reports

The admin page shows visitors, page views per day, traffic by hour, where visitors came from, most
played games, devices and browsers. Reports go out every 12 or 24 hours (or off); add an hourly
cPanel cron job for exact timing (the admin page shows the command). No cookies: visitors are counted
by a hash that resets daily.

## Shelf

Swipe left or right on a game's page (cover and description) to move through the games in the
current section; the tiles below follow along. Tap a tile once to show its page, tap again to open
it. On desktop, the ‹ › arrows on the cover, arrow keys or the controller do the same.

## Arcade cabinet edition

The home screen now lives inside a responsive arcade cabinet: warm illustrated side panels,
backlit Jerm747.games marquee, black inset screen, and a beveled CSS frame. On screens 760px
or narrower, the side panels disappear so the game has room. Short landscape screens also
hide the marquee during play. Gameplay has a persistent toolbar above the game for returning
to the shelf, fullscreen and controller maps.

Home panels use two original sunset murals generated from the supplied character references.
Left: OG Jerm, Kiana, Jado and Eli. Right: Shadow, Akeem, Nika and Billie.
Each mural has four vertically staggered portraits. The rendered panels preserve the painted
colors; small captions sit at the bottom. Replace either image in `src/cabinet-art.js`.
Recommended art: 1:3 portrait, with faces inside the middle 60%.
Game panels automatically use the selected game's cover, falling back to home art if absent.

## Groove Squad Get Down

`projects/groove-squad-get-down/` is generated from the jerm747.com source (jerm747-player repo),
so the game itself is never edited by hand here. To refresh it after updating Get Down on jerm747.com:

```bash
python3 scripts/get-down/make-getdown-project.py ../jerm747-player public/projects/groove-squad-get-down
cp <cover.jpg> <project.json> back into that folder   # the script recreates the folder
```

(Keep a copy of `cover.jpg` and `project.json` first, or rebuild the cover with
`scripts/get-down/gd-cover.py`, run from `jerm747-player/public/images/groove-squad`.)

What the script changes for jerm747.games:
- copies only the files the game uses (about 725 MB of character art), with paths made relative;
- swaps the account script for `games-account.js`: everyone has the full squad, nothing syncs;
- adds `games-shim.js`: /api calls are answered locally, Ranked Run keeps a device leaderboard,
  Match music buttons are hidden (music lives in the jerm747.com player; the Music panel links there);
- the game's Close button returns to the shelf, and its Fullscreen button goes full screen directly.

Upload this folder once. Later site updates can skip it, as long as you don't delete it on the server.

## GS Fighter II

`projects/gs-fighter-2/` is the Android 1.0.17 build running in the browser, generated from the APK
(the APK's `assets/` folder is the complete web game with every Android update):

```bash
python3 scripts/gs-fighter/make-gsfighter-project.py GS-Fighter-Android-1.0.17.apk public/projects/gs-fighter-2
# then restore cover.jpg and project.json (or rebuild the cover: run scripts/gs-fighter/gs-cover.py
# from inside the project folder)
```

What the script changes:
- root paths become folder-relative; the workshops' "← Fighters" links go to the game's select screen;
- `gs-browser-bridge.js` stands in for the Android app, so the APK features switch on in a browser:
  staged Blue/Red select, arcade opening and results, the GS MENU (Resume, Fighter select,
  Parallax Run, Sprite/Sound Workshop, Controller setup, Exit to the shelf), and workshop exports
  as normal downloads. The first controller that connects is given to Player 1, like the app.
- The "Challenge a friend · online beta" link is hidden (it needs jerm747.com accounts).
- Branding: `gs-fighter-ii-brand.png` replaces `brand/gs-fighter.png`, so the splash, lobby title,
  select-screen corner logo and matchup card all show the GS Fighter II logo; the bridge also renames
  the tab title and logo alt text. The APK itself is untouched (see Downloads).
- `gs-web-layout.css` (loaded by the bridge) adds the browser layout: in portrait the arena keeps
  its shape at the top and the touch pad gets its own panel underneath (JUMP · START · DUCK row,
  then the pad and attack buttons); hiding the pad centers the arena. In landscape the touch
  controls are mostly transparent until pressed and JUMP / DUCK sit clear of the attack buttons.
  The top bar adds HIDE PAD and CONTROLLER next to SETUP and GS MENU.

About 449 MB, uploaded once like Get Down.

For a UI preview without PHP, run `JERM_UI_PREVIEW=1 npm run dev` (macOS/Linux). This reads
local project metadata and does not collect stats. Production builds still use the PHP backend.
For admin, reports and live tracking, use the normal PHP development or hosting setup above.

Validation: production build passed; browser checks covered category filtering, opening
Controller Check and Flight Control Deck, returning to the shelf, and cover-art switching.
PHP admin/report execution and physical controller/haptics were not tested in this environment.

## Added puzzle games

- **Word Search** (`projects/word-search/`): topic-based puzzle with a cover-themed presentation,
  15/30/60-word challenges, hints and progress saved in this browser.
- **Plugin Twist** (`projects/plugin-twist/`): supplied standalone game with embedded token
  images and haptics retained. The arcade adds a standard-controller keyboard bridge.
  A = swap/twist left, B = twist right, X = swap/twist mode, Y = hint, LB = corner; D-pad moves.
- **Album Match** (`projects/album-match/`): original match-three engine, tile art and React
  game recovered from `Jerm747-Player-V2.0.2-build159-Head-Package.zip`. The later build190
  update referenced the game but did not contain its source, so the complete head package
  was used. The board logic, 20 matching swaps, cascades, key presets and best score remain.
  A small adapter supplies local round scores and standalone close/fullscreen controls.

Each game has original generated 16:9 cover artwork in its folder. Album Match's editable
source is in `src/album-match/`; `npm run build` bundles it into its public folder before
building the arcade. Normal `npm run dev` also builds this game once; after editing its
source, rerun `node scripts/build-album-match.mjs` or restart dev.

The copies of Word Search and Plugin Twist in this package omit a missing music-site account
script, allowing standalone play without sign-in dependencies. Scores and progress are local
to this origin/browser, and do not sync back to jerm747.com. The uploaded originals are retained.

Browser validation covered: finding a word, entering expanded puzzle mode, a hinted Plugin Twist
move (80 points / 4 freed slots), an Album Match swap reducing moves to 19, and returning to the
shelf. Album Match engine checks verified opening playability and refill invariants across
100 generated boards. Physical gamepad/haptics and the production PHP backend remain untested.

## Arcade 1.1 / Flight Deck 7.1 update

- Fullscreen no longer forces landscape. The arcade player offers Auto, Portrait and Landscape.
  Auto follows the device. Explicit locks are requested only after fullscreen; unsupported browsers
  explain that the device can be rotated instead. Standalone puzzle pages include the same choices
  in a dedicated top bar. No game state is recreated to change orientation.
- Word Search has cover-themed color/art and six topic collections of 75 words each. Edit
  `public/projects/word-search/topics.json` (or the deployed `projects/word-search/topics.json`).
  Each topic has `id`, `title`, `words`; keep words unique after removing spaces/punctuation,
  2–24 letters long, and keep collections at 50–100 words. Hard needs at least 60 entries.
  New Puzzle offers 15/30/60 words, same words with a new grid, random selection, or hand-picked
  words. The picker requires the chosen count. Same-word mode is available when topic and word
  count match. Existing saved 60-word puzzles migrate when valid. Help is now an on-demand dialog.
- Plugin Twist shows remaining turns and whether a matching move exists. No-match boards visibly
  announce a reshuffle, pause briefly, and retain score/turns. Exhausting the turn budget gives an
  explicit Out of moves result. No-match detection counts both swap and twist possibilities.
- Album Match reuses the original music-site `coverSvg` marble renderer with six vivid colorways.
  A refill plan preserves tile origins so only affected columns descend. Surviving and replacement
  tiles use slow 540–930 ms downward animations before the next cascade. Reduced Motion skips
  the animation. Landscape phones use a side-by-side board/control layout.
- Flight Deck has a high-contrast utility strip available at the title screen and during the intro;
  text labels determine button widths. Redundant bottom instructions moved into Control Room.
  Reticle follows ship defaults to On. Old saved settings adopt the new default until settings
  are saved again; later explicit Off choices are respected.

Validation: production build; script syntax; all 18 topic/difficulty combinations; 100 refill
comparisons against the original algorithm; Plugin Twist no-move fixture plus 30 playable
reshuffles. Browser checks covered Word Search creation/custom validation/same-word reshuffle,
word finding and restored progress, help, portrait-lock fallback, Album Match scoring/cascade,
Plugin Twist status, pre-launch flight view changes and follow-ship default. Layouts checked at
390×780 portrait and 780×390 landscape. OS-level rotation locking, physical controller/haptics,
and production PHP execution still require testing on the intended devices/server.

### Upload this update

Upload the **contents of `dist/`** over the existing site files (merge folders). Keep the existing
`api/data/` and any game folders added on the live site. Upload the new root `index.html` and
`assets/` too: the orientation toolbar is part of the arcade shell. Upload complete puzzle folders
and `projects/shared/`; Word Search now needs its JSON, JS and CSS alongside its HTML.

## GS Fighter III and downloads (November 2026)

**GS Fighter III** lives in `projects/gs-fighter-3/`: the v1.2.0 web build copied as-is (it already uses
folder-relative paths). Shareable link: `jerm747.games/#/play/gs-fighter-3`. About 195 MB.

The full GS Fighter web titles can also be installed from their existing game packages.

**Download pages** (static HTML, outside `projects/` so they don't appear on the shelf):

| Link to share | APK file to upload beside its `index.html` |
|---|---|
| `jerm747.games/download/gs-fighter-3/` | `GS-Fighter-III-v1.2.0.apk` |
| `jerm747.games/download/gs-fighter-2/` | `GS-Fighter-Android-1.0.17.apk` |
| `jerm747.games/download/` | (lists both) |

Each page has Download APK, Play in browser, Share (phone share sheet, or copies the link), install steps
and the SHA-256. Shared links preview with the cover art. The root `.htaccess` serves `.apk` with the
Android type as a download. A game's shelf page shows an **Android APK** button when its `project.json`
has `"download": {"label": "Android APK", "url": "/download/<name>/"}`.

The APKs are not modified. Changing the logo or icon inside an APK means re-signing it; with a different
key, Android refuses to install it over the existing app. The GS Fighter II download page and shelf use
the II artwork instead.

**Art:** the covers and download-page images were made with the scripts in `scripts/gs-fighter/art/`
(Pillow; the input paths at the top of each script point to the unpacked builds). GS Fighter III uses its game artwork. Cyborg Coliseum uses its arena and Cyborg character artwork.

**Build without Vite:** if `npm install` can't reach the registry, `node scripts/build-esbuild.mjs`
(with `react`, `react-dom` and `esbuild` available) produces the same `dist/` layout.

## November 1 update: GS Fighter III 1.3, Word Search setup, Plugin Twist swap effect

**GS Fighter III 1.3.0** (Player Menu v8): `projects/gs-fighter-3/` now holds the v8 build. `index.html`
forwards to `game/index.html`; `Fighter-Select.html` and `select-art/` sit beside it. Left out of the web copy:
`source/`, `tests/`, `rebuild.py`, the notes files and `Compare-layouts.html`. The title shows "1.3".
`game/intro.html` had its title art split out (`intro-img-1.png`) so GoDaddy serves it.

Shelf pages can show **screenshots**: add `"screenshots": [{"src": "...", "thumb": "...", "caption": "..."}]`
to `project.json` (paths inside the game folder). GS Fighter III has five in `screenshots/`. Tap one to view it
full size; arrows or swipe move through them.

**APK 1.3.0** was built with `scripts/gs-fighter/apk/build_apk.py`: it takes the 1.2.0 APK's native WebView
launcher (`com.jerm747.gsfighter3`), swaps in the new web build as `assets/`, sets the version (1.3.0 / 130),
signs it (v1/JAR, like 1.2.0) and aligns it. The 1.2.0 signing key wasn't available, so 1.3.0 uses a new key,
`gsfighter3-release.jks`. Keep that file and its password: every future update must use the same key, or Android
won't install it over the previous version. Anyone who has 1.2.0 must uninstall it once before installing 1.3.0.

```bash
python3 scripts/gs-fighter/apk/build_apk.py GS-Fighter-III-v1.3.0.apk <web folder> out.apk 1.4.0 140 gsfighter3-release.jks gsfighter3 <password>
```
(versionName must stay 5 characters, like 1.4.0.)

**Word Search** (Arcade 1.2) was rebuilt around the same engine and themes:
- setup screen first: theme, 15 / 30 / 60 words (Easy / Medium / Hard), Untimed or Timed (5 / 10 / 20 minutes),
  plus an optional "pick the words yourself";
- the grid fills the screen width; phones held upright get a tall grid (e.g. 9×11 for Easy), so letters are
  about 50% bigger than before; letter size follows the real cell size;
- found words get a colored highlight drawn across them, and the word list sits under the grid with each
  found word crossed off in the same color;
- in-progress puzzles carry over (same save key); time's up offers "keep looking, untimed".
Files: `index.html`, `style.css`, `game.js`, `engine.js`, `topics.json`. The old `theme.css`,
`word-search-focus.*` and `legacy-words.json` are no longer used.

**Plugin Twist**: `swap-fx.js` draws the selection as a glowing, pulsing rounded outline (a capsule for a
pair, a rounded L for a twist) and animates swaps on an arc with a spring landing and a slight squash. The token
art moved out of `index.html` into `tokens.js`. **Swap Lab** (`projects/plugin-twist/swap-lab.html`) is the
workshop: presets, three selection styles, colors, glow/pulse and motion sliders, demo buttons, a comparison
with the old square, "Use in the game on this device", and a settings box to copy. Send those settings back to
bake them in as the default (`DEFAULTS` in `swap-fx.js`).

## Arcade 1.0.4 · Visor Launcher

The original Cabinet component renders the panels, marquee and game artwork. The new screen controls add a compact List view and shared visor. Cyborg Coliseum v0.2 Flight Systems is playable from the shelf or the visor. Controller Check uses the 747 controller art. The original CC arrangement and scan-line treatment are saved in public/art-archive/controller-check-old-cover-with-crt-filter.html.

Preserve game state is optional and applies to the running arcade tab. Open games lists current and paused titles and lets the user close a paused title to release memory. Bundled HTML games load the clock before their game code. On HTTPS, the projects-scoped worker also supplies the clock to older same-origin game pages with a head element, when the site has no existing competing service worker. The HUD marks an incompatible game's current session as restarting on exit. Games continue to own their own saved progress. Run the site on its existing PHP hosting to use its live game registry, controller mappings and admin.

## Arcade 1.0.5

Tap or drag anywhere on the larger map under Visor settings > Move HUD icon. The icon moves on contact and its position saves throughout the drag. Placing it from the cabinet sets the cabinet and default game position. Placing it inside a game sets that game’s position. Controller Check appears last on the shelf, in the list, and in the visor game launcher.


Arcade 1.0.6
The List/Grid slider accepts taps, drags, and arrow keys. Play game is a solid button. In portrait, the Beat Room turntable has a separate transport strip, and the record picker has its own row on phones.
