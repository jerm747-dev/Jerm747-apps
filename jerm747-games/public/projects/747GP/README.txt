747 GP - local build
====================
Run with Python 3 or Node.js. The WebGL renderer is bundled. The optional WebGPU renderer
and some race fonts load from the internet.

PC
  Windows: double-click start-windows.bat
  Mac/Linux: run ./start-mac-linux.sh
  Opens http://localhost:8747. Plug in or pair a controller, then press any button.

The path to a race
  1. Studio card, then the title. Press Start (Enter, Space, A or Start).
  2. Mode select: Arcade (race the field, 3 laps) or Time Trial (solo, best lap).
     Transmission: Automatic or Manual.
  3. Showroom: left/right to browse, A/Enter to choose your ride.
  4. Race setup: track, ride, mode, opponents (0-9) and gearbox, then START.
  5. Race. P / Esc / Start pauses (Resume, Restart, End session in Time Trial,
     Settings, Race setup, Main menu).
  6. Results: your car drives on behind the sheet. Lap times, best lap, top speed,
     race order and the leaderboard. Next race, Restart, Change ride, Race setup, Main menu.

  Menus: arrows / D-pad move, Enter / A choose, left/right change a setting,
  Esc / B go back.
  Manual shifting: Q / E, PageUp / PageDown, LB / RB, or the - / + paddles.
  Controller: R2/A gas, L2/B brake, left stick steer, right stick camera.
  Keyboard: arrows/WASD, Space brake, R reset, C camera, L racing line.

Racing line (1.2.18)
  Every track solves its own racing line when it loads (wide in, clip the apex, wide out)
  and a speed plan for your ride and drive mode. Green = power, yellow = ease off / at the
  grip limit, red = brake. Ahead of you, any part you can no longer slow down for at your
  current speed flashes bright red. Settings > RACING LINE (or L): Full, Braking only, Off.
  The rivals drive the same line as a "soft slot": a pass or a bump moves them off it, they
  ease back on, and a hit costs them a beat of pace while they shake it off.

1.3
  Touch controls: Pro is the default. Settings > TOUCH STYLE switches to Classic (original).
  GP points: every finished race pays out, win or lose (Arcade 100 GP a lap, Time Trial
  50 GP a full lap). Your total shows top-right from mode select on, and on the results;
  tap it for races, wins, podiums, credits and your best finish.
  Contacts and hazards: cars push each other, kerbs, grass, gravel and walls have their own
  sounds and controller rumble. hazards/747GP-Hazard-Test.html auditions them.
  S.S. 55 (the sleeper) now runs in the 1800 class.

1.3.21 (controls)
  Controls screen between the showroom and race setup (also from mode select and the pause menu):
  Touch, Keyboard, Controller or Pocket Player. Place controls opens a full-screen editor: drag and
  turn the stick, gas, brake and camera pads, separately for landscape and portrait. Keys and
  controller buttons can be remapped. The race uses what you set; changes from the pause menu apply
  straight away. Pocket Player hides the touch pads; Start Pocket Player opens the game in the
  jerm747.games cabinet (inside the cabinet it just hands over).

1.3.20 (playtest fixes)
  Bikes have a rider (the podium rider, posed for each bike) and lean into the turn.
  Race setup rebuilt like the showroom: the course turns on a studio table, light runs round START.
  Showroom: switch tick on the press, a light thud as the next ride lands.
  Rivals in monochrome (black, white, greys). Mode select is one tap per step.
  Pause: one press = one pause, the HUD steps back, Full screen on the pause menu.
  Driving: brakes half as strong (gentler in Comfort/Normal), the car coasts off the gas,
  rivals have a quarter less engine and corner a little slower.

Saved on this device
  Your choices (mode, gearbox, ride, track, opponents), every finished race, your
  best laps, GP points and boost credits. "Share times" on the results screen is an opt-in switch for the online
  boards when they open; nothing is sent yet. The other names on the leaderboard
  are made-up arcade rivals.

Phone on the same Wi-Fi
  Find your PC's IP (Windows: ipconfig -> IPv4, e.g. 192.168.1.20)
  On the phone open http://192.168.1.20:8747
  Allow Python through the Windows firewall if asked (Private networks).
  Note: over plain http on a LAN address the browser treats the page as "not secure", so
  WebGPU falls back to WebGL and TILT STEER shows NO SENSOR. Everything else works.
  For tilt + WebGPU on the phone, use the published artifact link or jerm747.games over https.

Files
  index.html     studio card, title, mode select
  showroom.html  ride selection
  controls.html  controls (touch layout editor, remapping, Pocket Player)
  tracks.html    race setup
  race.html      the race, pause menu and results
  finish.html    podium ceremony and rewards (Podium & rewards on the results)
  intro/         title art, logo, fonts, session (shared by every page)
  ui/            menu buttons, spinner and flag loader (shared by every page)
  vendor/        three.js (WebGL)
  sound/         synthesized engines and menu chimes (Sound Kit v1)
  visuals/       picture grading and speed blur (Menu > Display > Visual effects)
  finish/        podium stage, rider and rewards
  cars/          car + wheel models (base64 GLB in .js)
  veg/ tex/ scene/  trackside art
  hazards/       contact physics, hazard sounds, full-field results
