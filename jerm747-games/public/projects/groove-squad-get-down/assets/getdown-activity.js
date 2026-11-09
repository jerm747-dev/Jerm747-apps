/* V52 · Groove Squad Get Down activity → api/getdown-activity.php → the "Get Down" tab on /admin/chart.
   Loaded by groove-squad-get-down.html (home button) and groove-squad-arcade.html (Level 10 reward).
   Watches the game from the outside (window.SquadArcadeReview / Jerm747GameControls), so the fight code
   is untouched. Anonymous: the same visitor key as the song stats; controllers only as a brand group.
   Never blocks or slows the game; if the server isn't there, it quietly does nothing. */
(function () {
  'use strict';
  if (window.__jermGetDownActivity) return;
  window.__jermGetDownActivity = true;

  var ENDPOINT = '/api/getdown-activity.php';
  var store = null;
  try { store = window.localStorage; } catch (e) { /* blocked */ }

  function visitor() {
    var v = null;
    try { v = store && store.getItem('jerm747.visitor'); } catch (e) {}
    if (!v || !/^[a-f0-9]{32}$/.test(v)) {
      var b = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256 | 0; });
      v = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      try { store && store.setItem('jerm747.visitor', v); } catch (e) {}
    }
    return v;
  }

  // ---------- where, what device ----------
  var path = location.pathname;
  var embedded = window.parent !== window;
  var entry = /groove-squad-arcade/.test(path) ? (embedded ? 'arcade' : 'direct') : (embedded ? 'home' : 'direct');
  function device() {
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    var small = Math.min(screen.width || 9999, screen.height || 9999);
    return coarse ? (small < 600 ? 'phone' : 'tablet') : 'desktop';
  }

  // ---------- sending ----------
  var queue = [], failures = 0;
  function push(e) { queue.push(e); if (queue.length >= 40) flush(false); }
  function flush(closing) {
    if (!queue.length || failures > 3) return;
    var batch = queue.splice(0, 60);
    var body = JSON.stringify({ visitor: visitor(), events: batch });
    try {
      if (closing && navigator.sendBeacon) { navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })); return; }
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .then(function (r) { if (!r.ok) failures++; }).catch(function () { failures++; });
    } catch (e) { failures++; }
  }

  // ---------- once-per-visit flags ----------
  var once = {};
  function first(k) { if (once[k]) return false; once[k] = 1; return true; }

  push({ t: 'open', entry: entry, device: device() });

  // ---------- time on screen / time fighting ----------
  var visitSec = 0, pendSec = 0, pendFight = 0, last = performance.now();
  function fighting() {
    try { var c = window.Jerm747GameControls && Jerm747GameControls.context(); return !!(c && c.screen === 'fight' && !c.paused); } catch (e) { return false; }
  }
  function tickTime() {
    var now = performance.now(), dt = Math.min(5, (now - last) / 1000); last = now;
    if (document.visibilityState !== 'visible') return;
    visitSec += dt; pendSec += dt;
    if (fighting()) pendFight += dt;
  }
  function pushTime() {
    if (pendSec >= 1) push({ t: 'time', sec: Math.round(pendSec), fight: Math.round(Math.min(pendFight, pendSec)) });
    pendSec = 0; pendFight = 0;
  }

  // ---------- runs, rounds, results ----------
  var seenRun = null, seenResults = 0, ended = false;
  function watchRun() {
    var run = null;
    try { run = window.SquadArcadeReview && SquadArcadeReview.getState(); } catch (e) {}
    if (!run || !run.member) return;
    // The game keeps a placeholder run while the fighter-select screen is up; only count runs actually started.
    var screenNow = null;
    try { screenNow = window.Jerm747GameControls && Jerm747GameControls.context().screen; } catch (e) {}
    if (run !== seenRun && (screenNow === 'lobby' || screenNow == null)) { seenRun = run; seenResults = (run.results || []).length; ended = run.mode === 'complete'; return; }
    if (run !== seenRun) {
      seenRun = run; seenResults = 0; ended = false;
      push({ t: 'run', f: run.member, d: run.difficulty, entry: entry });
    }
    var results = run.results || [];
    while (seenResults < results.length) {
      var r = results[seenResults++];
      push({ t: 'round', f: run.member, o: r.opponent, r: r.outcome });
    }
    if (!ended && run.mode === 'complete') {
      ended = true;
      push({ t: 'end', f: run.member, d: run.difficulty, won: run.outcome === 'win' ? 1 : 0, score: run.score || 0,
        beat: run.matchesWon || 0, of: (run.queue || []).length });
      pushTime(); flush(false);
    }
  }

  // ---------- how they play ----------
  var GAME_KEYS = /^(Arrow(Left|Right|Up)|Space|Key[A-Z]|Shift(Left|Right))$/;
  document.addEventListener('keydown', function (e) {
    if (!GAME_KEYS.test(e.code) || !fighting()) return;
    if (first('kb')) {
      var layout = 'classic';
      try { layout = window.Jerm747Keys ? Jerm747Keys.id() : 'classic'; } catch (x) {}
      push({ t: 'input', k: 'keyboard', layout: layout });
    }
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && first('touch')) push({ t: 'input', k: 'touch' });
  }, true);
  function brand(id) {
    id = String(id || '');
    if (/xbox|xinput|045e/i.test(id)) return 'xbox';
    if (/playstation|dualshock|dualsense|054c|wireless controller/i.test(id)) return 'playstation';
    if (/nintendo|switch|pro controller|joy-?con|057e/i.test(id)) return 'switch';
    if (/8bitdo|2dc8/i.test(id)) return '8bitdo';
    return 'other';
  }
  window.addEventListener('gamepadconnected', function (e) {
    var g = e.gamepad;
    if (g && first('pad')) push({ t: 'pad', brand: brand(g.id), std: g.mapping === 'standard' ? 1 : 0 });
  });
  function watchPads() {
    if (once.gp || !navigator.getGamepads) return;
    var pads; try { pads = navigator.getGamepads(); } catch (e) { return; }
    for (var i = 0; pads && i < pads.length; i++) {
      var g = pads[i]; if (!g) continue;
      if (first('pad')) push({ t: 'pad', brand: brand(g.id), std: g.mapping === 'standard' ? 1 : 0 });
      var used = g.buttons.some(function (b) { return b && b.pressed; }) || g.axes.some(function (a) { return Math.abs(a) > 0.5; });
      if (used && fighting() && first('gp')) push({ t: 'input', k: 'gamepad' });
    }
  }

  // ---------- extras they turned on ----------
  var extraCount = {};
  function extra(x) { extraCount[x] = (extraCount[x] || 0) + 1; if (extraCount[x] <= 5) push({ t: 'extra', x: x }); }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button');
    if (!b) return;
    var txt = (b.textContent || '').trim().toLowerCase();
    if (b.id === 'full' && !/exit/.test(txt)) extra('fullscreen');
    else if (b.id === 'haptic') setTimeout(function () { if (/off/i.test(b.textContent)) extra('haptics-off'); }, 0);
    else if (b.closest('.game-console-row') && txt === 'music') extra('music');
    else if (b.closest('.game-console-row') && txt === 'controller') extra('controller-help');
    else if (b.id === 'close') { pushTime(); push({ t: 'close', sec: Math.round(visitSec) }); closedSent = true; flush(true); }
  }, true);
  window.addEventListener('jerm747-keys-change', function () { extra('keys-change'); });
  var orient = window.matchMedia && matchMedia('(orientation: portrait)');
  if (orient) {
    var onRotate = function () { extra('rotate'); };
    if (orient.addEventListener) orient.addEventListener('change', onRotate); else if (orient.addListener) orient.addListener(onRotate);
  }

  // ---------- heartbeat & leaving ----------
  var closedSent = false, beats = 0;
  setInterval(function () {
    tickTime(); watchRun(); watchPads();
    if (++beats % 30 === 0) { pushTime(); flush(false); } // about every 30 seconds
  }, 1000);
  function leaving() {
    tickTime(); watchRun(); pushTime();
    if (!closedSent) { push({ t: 'close', sec: Math.round(visitSec) }); closedSent = true; }
    flush(true);
  }
  window.addEventListener('pagehide', leaving);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { tickTime(); pushTime(); flush(true); } });
})();
