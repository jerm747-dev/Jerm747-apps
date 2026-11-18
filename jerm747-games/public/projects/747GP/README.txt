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
  Keyboard: arrows/WASD, Space brake, R reset, C camera.

Saved on this device
  Your choices (mode, gearbox, ride, track, opponents), every finished race and your
  best laps. "Share times" on the results screen is an opt-in switch for the online
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
  tracks.html    race setup
  race.html      the race, pause menu and results
  intro/         title art, logo, fonts, session (shared by every page)
  ui/            menu buttons, spinner and flag loader (shared by every page)
  vendor/        three.js (WebGL)
  cars/          car + wheel models (base64 GLB in .js)
  veg/ tex/ scene/  trackside art
