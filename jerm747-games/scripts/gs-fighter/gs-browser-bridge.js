/* GS Fighter on jerm747.games: a browser stand-in for the Android app's native bridge (window.GSAndroid).
   The 1.0.17 APK features (staged fighter select, arcade opening/results, GS MENU, exports) only switch on
   when the bridge exists, so this provides it with web equivalents:
   - GS MENU: the same seven choices as the Android Back menu, as an on-page menu (touch, mouse, keyboard, pad)
   - Exit: back to the jerm747.games shelf (or the site home when opened on its own)
   - exports (PNG/GIF/JSON/WAV from the workshops): saved as normal browser downloads
   - vibration: the browser's own vibrate where supported; controllers come straight from the browser. */
(() => {
  'use strict';
  if (window.GSAndroid) return;
  const nativeVibrate = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
  const makeURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
  const nativeClick = HTMLAnchorElement.prototype.click;
  const exports = new Map();
  let menuEl = null, padLoop = 0;

  function download(blob, name) {
    const a = document.createElement('a'), url = makeURL(blob);
    a.href = url; a.download = name || 'gs-fighter-export';
    document.body.append(a); nativeClick.call(a); a.remove();
    setTimeout(() => revokeURL(url), 4000);
  }
  function exitGame() {
    if (parent !== window) parent.postMessage({ type: 'jerm747-games-exit' }, location.origin);
    else location.href = '/';
  }
  const ROUTES = { 'Fighter select': 'index.html', 'Parallax Run': 'runner.html', 'Sprite Workshop': 'workshop.html', 'Sound Workshop': 'sound-workshop.html' };
  const ITEMS = ['Resume', 'Fighter select', 'Parallax Run', 'Sprite Workshop', 'Sound Workshop', 'Controller setup', 'Exit'];

  function choose(item) {
    closeMenu();
    if (item === 'Resume') { window.GSAndroidLifecycle?.resume(); return; }
    if (item === 'Exit') { exitGame(); return; }
    if (item === 'Controller setup') { window.Jerm747Controls?.openHelp?.('pad'); return; }
    if (ROUTES[item]) location.href = ROUTES[item];
  }
  function closeMenu() {
    cancelAnimationFrame(padLoop);
    if (menuEl) { menuEl.remove(); menuEl = null; }
  }
  function openMenu() {
    if (menuEl) return;
    window.GSAndroidLifecycle?.pause();
    menuEl = document.createElement('div');
    menuEl.className = 'gs-web-menu';
    menuEl.setAttribute('role', 'dialog'); menuEl.setAttribute('aria-modal', 'true'); menuEl.setAttribute('aria-label', 'GS Fighter menu');
    menuEl.innerHTML = '<div class="gs-web-menu-card"><h2>GS Fighter</h2><div class="gs-web-menu-list"></div><button type="button" class="gs-web-menu-close">Close</button></div>';
    const list = menuEl.querySelector('.gs-web-menu-list');
    for (const item of ITEMS) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = item;
      b.onclick = () => choose(item); list.append(b);
    }
    menuEl.querySelector('.gs-web-menu-close').onclick = closeMenu;
    menuEl.addEventListener('click', e => { if (e.target === menuEl) closeMenu(); });
    menuEl.addEventListener('keydown', e => {
      const btns = [...menuEl.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
      e.stopPropagation();
    });
    document.body.append(menuEl);
    list.querySelector('button').focus();
    // Controller: D-pad / stick to move, A to choose, B to close (like the Android dialog).
    let held = {}, armed = false;
    const tick = () => {
      if (!menuEl) return;
      const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
      if (pad) {
        const btns = [...menuEl.querySelectorAll('button')], i = Math.max(0, btns.indexOf(document.activeElement));
        const ax = pad.axes[1] || 0;
        const state = { up: pad.buttons[12]?.pressed || ax < -0.6, down: pad.buttons[13]?.pressed || ax > 0.6, a: pad.buttons[0]?.pressed, b: pad.buttons[1]?.pressed };
        if (!armed) { armed = !state.a && !state.b; }
        else {
          if (state.down && !held.down) btns[(i + 1) % btns.length].focus();
          if (state.up && !held.up) btns[(i - 1 + btns.length) % btns.length].focus();
          if (state.a && !held.a) { document.activeElement?.click(); }
          if (state.b && !held.b) closeMenu();
        }
        held = state;
      }
      padLoop = requestAnimationFrame(tick);
    };
    padLoop = requestAnimationFrame(tick);
  }

  window.GSAndroid = {
    web: true,
    vibrate(ms) { try { if (navigator.userActivation?.hasBeenActive !== false) nativeVibrate?.(ms); } catch {} },
    requestPads() {},
    menu() { openMenu(); },
    beginExport(name, type) { const t = Math.random().toString(36).slice(2); exports.set(t, { name, type, parts: [] }); return t; },
    appendExport(token, b64) {
      const e = exports.get(token); if (!e) return false;
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      e.parts.push(bytes); return true;
    },
    finishExport(token) { const e = exports.get(token); if (!e) return; exports.delete(token); download(new Blob(e.parts, { type: e.type }), e.name); },
    cancelExport(token) { exports.delete(token); },
  };

  // The Android app gives the first controller to Player 1 when it connects; do the same here.
  window.addEventListener('gamepadconnected', e => {
    try {
      const setup = window.Jerm747PlayerSetup, s = setup?.getState();
      if (s && s.human[0] && !s.padBindings[0]) setup.assignPad(e.gamepad.index, 0);
      window.GSSound?.unlock?.();
    } catch {}
  });

  const style = document.createElement('style');
  // Online challenges run on jerm747.com accounts, which this site doesn't have.
  style.textContent = 'a[href$="groove-squad-challenge.html"]{display:none!important}'
    + '.gs-web-menu{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#05060bcc;font:15px system-ui,sans-serif}'
    + '.gs-web-menu-card{min-width:260px;max-width:90vw;max-height:92dvh;overflow:auto;background:#161a2b;border:1px solid #4f5a7d;border-radius:14px;padding:16px;color:#f4ecdf;box-shadow:0 20px 60px #000a}'
    + '.gs-web-menu h2{margin:0 0 10px;font-size:18px;letter-spacing:.04em}.gs-web-menu-list{display:grid;gap:6px}'
    + '.gs-web-menu button{font:inherit;color:inherit;text-align:left;padding:10px 12px;border-radius:9px;border:1px solid #3c4566;background:#222842;cursor:pointer}'
    + '.gs-web-menu button:focus-visible,.gs-web-menu button:focus{outline:3px solid #7fe7e4;outline-offset:1px}.gs-web-menu-close{margin-top:10px;width:100%;text-align:center!important;background:#2e2236!important}';
  document.head.append(style);
})();
