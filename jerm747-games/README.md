# jerm747.games

Games and game designs by Jerm747. A dark, controller-first arcade: pick a game from the shelf and
play it in the browser with a controller, keyboard, mouse or touch.

React (Vite) front end + a small PHP back end for the game list, visitor stats and email reports.
Runs on regular GoDaddy/cPanel hosting with no database.

## Pages

| Address | What it is |
|---|---|
| `jerm747.games` | The arcade |
| `jerm747.games/#/play/<folder>` | Opens one game directly, e.g. `#/play/fighter-lab`. Use the **Copy link** button to share. |
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
`project.json`; the arcade presses the mapped keys. Fighter Lab uses it: X jab, Y cross, B hook,
RB uppercut, A jump, LB jump uppercut, LT jump kick, RT roundhouse.

## Included

- **Groove Squad Get Down** (2.3.7): the full game from jerm747.com with all 40 fighters open.
  No subscriptions on jerm747.games. Ranked Run keeps its leaderboard on each device. See below.
- **Flight Control Deck** (v7): Asteroid Blast, races and free flight.
- **Fighter Lab** (Akeem 0.1): Akeem, Prince of Fighters, as a geometric 3D character study with
  eight moves, design reference and GLB/OBJ export. `node scripts/check-fighter-model.mjs` checks the
  model (needs `npm install` for `three`).
- **Controller Check**: test buttons, sticks, triggers and rumble.
- `cover-square.jpg` in the first two folders: your square cover art, kept as a backup.

## Traffic and reports

The admin page shows visitors, page views per day, traffic by hour, where visitors came from, most
played games, devices and browsers. Reports go out every 12 or 24 hours (or off); add an hourly
cPanel cron job for exact timing (the admin page shows the command). No cookies: visitors are counted
by a hash that resets daily.

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

GS Fighter is waiting on its browser game files (GS-Fighter-1.0 or the 1.0.17 APK); the
Android source kit in the apps repo holds only the wrapper and patches.

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
