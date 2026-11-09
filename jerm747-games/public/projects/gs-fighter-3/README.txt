GS FIGHTER III — LOADING + HOME GALLERY v9
Jerm747 / November 2, 2026

START HERE
Extract the entire ZIP, keep its folders together, and open index.html.
For phones, serve the folder from your usual website or local server.
This is the complete browser source package. It is not a rebuilt Android APK.

QUICK PREVIEWS
Loading-Preview.html — standalone animated bottom-right loading mark on black.
Home-Menu-Preview.html — open the Arcade / Training menu with its new gallery.

LOADING TRANSITIONS
A compact off-white GS Fighter wordmark, thin spinner and LOADING label sit
in the bottom-right corner with safe spacing. There are no loading buttons.
The outgoing screen remains in place during a 260 ms fade to opaque black.
Only then does navigation or a scene change happen. The incoming page starts
covered before the game scripts run; artwork and fighter readiness finish
under the cover, then a one-second buffer and 260 ms reveal fade complete.
Keyboard, pointer and gamepad actions are blocked while the cover is active.
Repeated navigation is ignored; an old reveal cannot dismiss a newer load.
Browser back/forward restores the cover and reveals the restored page safely.
Reduced motion disables the rotating spinner and transition delays.

COVERED PATHS
Title to mode menu; Arcade / Training to fighter select; select to a match;
select/options/title round trips; texture-quality reload; next challenger or
retry after the post-fight journey; return from post-fight to title or select.
The normal fight-to-post-fight cinematic is unchanged. The CPU attract demo
still cuts straight into the action. No loader is inserted between ordinary
rounds that are already ready to play.

HOME GALLERY
All 14 approved fighters rotate in the mode-menu background, one at a time.
New artwork adds Akeem charging a cyan/violet V-Wave. The incoming portrait
alternates left/right every 5.6 seconds with a subtle 950 ms crossfade and
slow drift. Portrait screens use a tall background arrangement. Menu controls
stay clear and interactive in front. The slideshow stops while the menu is
closed or the page is hidden; reduced motion keeps a still portrait.

VALIDATION
- Six loader checks cover first-paint coverage, blocked input, the one-second
  buffer, mutation ordering, duplicate navigation, decode readiness and stale
  reveal protection. Run: node tests/loading.test.cjs
- All 29 existing post-fight checks pass. Run: node tests/post-fight.test.cjs
- Browser inspection covered the desktop title/mode/select/match flow and
  390 x 844 portrait menu and 736 x 414 loading preview.
- This environment used compatibility graphics for the arena. Physical Android
  devices and controllers were not tested; the APK has not been rebuilt.

EDITABLE FILES
 game/screen-transition.js — shared loading cover and navigation sequencing
 game/loading-logo.png — simplified monochrome wordmark
 game/menu-carousel.js / .css — home gallery, timing and responsive layout
 game/menu-art/akeem-vwave.png — new action illustration
 source/game-entry.js — readiness-gated arena entry
 source/workshop.js / template.html — selector navigation and initial cover
 game/player-menu.js / game.js / lab.js / post-fight.js — connected handoffs
 rebuild.py — rebuilds Fighter-Select.html and game/crest-entry.js

The approved player menu, fighter selection, combat, options and post-fight
assets from v8 remain included. Earlier notes follow for reference.

GS FIGHTER III — PLAYER MENU v8
Jerm747 / November 1, 2026

START HERE
Extract the whole ZIP and keep its folders together. Open index.html to start
at the animated title. Press Start, then choose Arcade, Training or Options.
Fighter-Select.html opens the approved Painted Crest selector directly.
On a phone, serve this entire folder from your usual website or local server.
This is the complete browser source build; it is not an Android APK.

PLAYER MENU
During a match, press Escape, Enter, controller Start, or the pause icon.
The match freezes while the menu is open. Resume continues the same match.
Fighter info uses the current player's approved portrait and energy color.
Akeem keeps the approved #70e7eb cyan. All 14 fighters have their own theme.
The gold Explore Moves button, gold rule and cyan selection highlights stay
consistent. The dark palette, original logo and arcade lettering are retained.

MOVE GUIDE
Select any available action to play that fighter's actual animation beside
its controller and keyboard inputs. Preview replays it at its game speed,
using the fighter's existing source clips and timing rules. The guide includes
punches, kicks, guard, movement, jumps, sweep, air attacks and V-Wave.
The preview uses a separate skeleton, mixer, scene and material. It never
advances or re-parents the live match fighter. Geometry and textures are reused.
Keyboard labels follow the selected keyboard preset. Compatibility graphics
use a lightweight V-Wave effect to keep menu input responsive. Movement demonstrations
show the motion; practice actual distance and interactions in Training.

OPTIONS
Controls: touch visibility, layout, size, opacity, handedness, idle fading,
vibration, keyboard preset and input reference.
Gameplay: difficulty and round time. Arcade remains first to two wins.
Audio: master volume, menu chimes and sound test.
Video: game effects, rim light, texture quality, menu effects, reduced menu
motion and fullscreen. Unsupported texture sizes are disabled.
Use Apply options to save changes. Difficulty applies immediately; round time
starts next round. Changing texture quality reloads the current game screen.
Options are also available from the title and fighter selector. The selector's
chosen fighters and Arcade/Training mode survive the options round trip.

TRAINING
Choose Training, then choose your fighter and the practice opponent.
Training has an infinite timer, a passive dummy, and no match result or score.
A knockout resets both fighters to full health after a short pause.
Pause, the move guide and all options remain available during practice.
The arcade CPU difficulty is preserved for the next Arcade match.

MENU INPUT
Keyboard: arrows or Tab move focus; Enter or Space selects; Escape goes back.
Controller: D-pad/left stick navigates; A selects; B goes back; Start resumes.
In Options, controller left/right changes a focused select or slider.
Mouse/touch: use the visible controls. The menu scrolls on smaller screens.
Held controller inputs must be released before gameplay resumes.
The match also pauses when the game loses focus or the tab is hidden.

RETAINED FROM v7
The complete painted fighter selection, all 14 fighters, combat timings,
corrected portraits and post-fight win/loss sequence remain included.
Post-Fight-Preview.html is still available for immediate result previews.
See POST-FIGHT-v7-NOTES.txt and PAINTED-CREST-v6-NOTES.txt for prior details.

EDITABLE SOURCE
 game/player-menu-markup.js — approved layout and real option fields
 game/player-menu.css — appearance and responsive production overlay
 game/player-menu.js — themes, navigation, settings and isolated move preview
 game/game.js — settings bridge, HUD, keyboard and gamepad routing
 game/lab.js — pause integration, title flow, training and WebGL capability flag
 source/template.html / workshop.js / workshop.css — fighter selection
 source/game-entry.js — chosen fighters and game mode entering the arena
 game/post-fight-data.js — approved portrait paths and fighter colors
 rebuild.py — regenerates Fighter-Select.html and game/crest-entry.js

Do not copy only game/ to a new host. The player menu and post-fight sequence
use approved artwork in the parent select-art/ directory.

CHECKS
Run node tests/post-fight.test.cjs for the existing 29 rig/result checks.
The Playwright browser suite is tests/player-menu.browser.cjs; its header
explains setup. Browser checks cover all themes, isolated move previews,
settings, input navigation, training and the title/selector/options flow.
