747 GP - local build
====================
Needs Python 3 (or Node.js) and an internet connection (three.js and fonts load from CDN).

PC
  Windows: double-click start-windows.bat
  Mac/Linux: run ./start-mac-linux.sh
  Opens http://localhost:8747. Plug in or pair a controller, then press any button.
  Controller: R2/A gas, L2/B brake, left stick steer, right stick camera.
  Keyboard: arrows/WASD, Space brake, R reset, C camera.

Phone on the same Wi-Fi
  Find your PC's IP (Windows: ipconfig -> IPv4, e.g. 192.168.1.20)
  On the phone open http://192.168.1.20:8747
  Allow Python through the Windows firewall if asked (Private networks).
  Note: over plain http on a LAN address the browser treats the page as "not secure", so
  WebGPU falls back to WebGL and TILT STEER shows NO SENSOR. Everything else works.
  For tilt + WebGPU on the phone, use the published artifact link or (later) jerm747.games over https.

Files
  index.html   the whole game
  cars/        car + wheel models (base64 GLB in .js)
  veg/         tree/plant cutouts and ground textures
