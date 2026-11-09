/*
 * v72.12 · Touch controls for Groove Squad Get Down / Squad Arcade (from the Controls Lab).
 *
 * Layouts: Ghost Cross (default), Height Map, Record Wheel, Classic (the original blocks).
 * Ghost buttons: outline + soft inner light so the fight shows through; touch areas larger than the drawing;
 * jump above left/right, duck below, block in the middle; slide from button to button without lifting.
 * Sideways (or arcade mode) the buttons sit over the fight; upright they sit in a panel under the fight.
 *
 * Touch layout menu (⚙ on the controls, or Controller → Touch buttons): pick a layout, All buttons size,
 * Arrange (buttons wiggle: drag anywhere, tap one to size just that one), Show touch areas, Fade when idle,
 * Hide/Show buttons, Reset. Saved in localStorage 'jerm747.controls.touch.v1' (follows subscribers to every device).
 *
 * Talks to the game only through window.Jerm747TouchInput (press(id, action) / release(id) / playable()),
 * which the arcade page defines. Actions: left right jump duck block pHigh pMid pLow kHigh kMid kLow wave (the V-Wave).
 */
(function () {
  'use strict';
  if (window.Jerm747TouchPad) return;
  var KEY = 'jerm747.controls.touch.v1';
  var C = { move: '25 195 255', guard: '127 227 168', punch: '245 181 68', kick: '255 111 174', special: '180 140 255' };
  var NAME = { left: 'Move left', right: 'Move right', jump: 'Jump', duck: 'Duck', block: 'Block', pHigh: 'High punch', pMid: 'Mid punch',
    pLow: 'Low punch', kHigh: 'High kick', kMid: 'Mid kick', kLow: 'Low kick', wave: 'V-Wave', wheel: 'Record wheel' };
  var HELD = { left: 1, right: 1, duck: 1, block: 1 };
  var TRI = 'M12 3.34 20.66 18.34H3.34Z';               // one equilateral triangle, rotated: four congruent arrows
  var TURN = { up: 0, right: 90, down: 180, left: 270 };

  function cross(shape) {
    return [
      { a: 'jump', x: .34, y: 0, s: .33, shape: shape, c: 'move', arrow: 'up', t: 'JUMP' },
      { a: 'duck', x: .34, y: .67, s: .33, shape: shape, c: 'move', arrow: 'down', t: 'DUCK' },
      { a: 'left', x: 0, y: .335, s: .33, shape: shape, c: 'move', arrow: 'left' },
      { a: 'right', x: .67, y: .335, s: .33, shape: shape, c: 'move', arrow: 'right' },
      { a: 'block', x: .37, y: .37, s: .26, shape: 'circle', c: 'guard', t: 'BLOCK', inset: '6%' }
    ];
  }
  // Units: fraction of the cluster's height; x runs to the cluster's aspect. "wide" = over the fight, "tall" = panel.
  var LAYOUTS = {
    ghost: { name: 'Ghost Cross', left: { aspect: 1, items: cross('circle') },
      right: { aspect: 1.42, items: [
        { a: 'wave', x: .52, y: -.42, s: .32, shape: 'circle', c: 'special', t: 'V‑WAVE', inset: '8%' },
        { a: 'pHigh', x: .02, y: .02, s: .4, shape: 'circle', c: 'punch', t: 'HIGH', sub: 'PUNCH' },
        { a: 'pMid', x: .44, y: .02, s: .4, shape: 'circle', c: 'punch', t: 'MID', sub: 'PUNCH' },
        { a: 'pLow', x: .86, y: .02, s: .4, shape: 'circle', c: 'punch', t: 'LOW', sub: 'PUNCH' },
        { a: 'kHigh', x: .15, y: .5, s: .4, shape: 'circle', c: 'kick', t: 'HIGH', sub: 'KICK' },
        { a: 'kMid', x: .57, y: .5, s: .4, shape: 'circle', c: 'kick', t: 'MID', sub: 'KICK' },
        { a: 'kLow', x: .99, y: .5, s: .4, shape: 'circle', c: 'kick', t: 'LOW', sub: 'KICK' }] },
      size: { wide: [.56, .30, .46, .40], tall: [.78, .44, .52, .50] } },
    height: { name: 'Height Map', left: { aspect: 1, items: cross('square') },
      right: { aspect: .72, caps: [{ x: .21, y: -.08, t: 'PUNCH' }, { x: .53, y: -.08, t: 'KICK' }], items: [
        { a: 'wave', x: .23, y: -.42, s: .26, shape: 'tri', c: 'special', t: 'V' },
        { a: 'pHigh', x: .05, y: 0, s: .32, shape: 'circle', c: 'punch', t: 'HIGH' },
        { a: 'pMid', x: .08, y: .34, s: .32, shape: 'circle', c: 'punch', t: 'MID' },
        { a: 'pLow', x: .05, y: .68, s: .32, shape: 'circle', c: 'punch', t: 'LOW' },
        { a: 'kHigh', x: .37, y: 0, s: .32, shape: 'square', c: 'kick', t: 'HIGH' },
        { a: 'kMid', x: .4, y: .34, s: .32, shape: 'square', c: 'kick', t: 'MID' },
        { a: 'kLow', x: .37, y: .68, s: .32, shape: 'square', c: 'kick', t: 'LOW' }] },
      size: { wide: [.56, .30, .58, .26], tall: [.78, .44, .64, .30] } },
    wheel: { name: 'Record Wheel', left: { aspect: 1, items: cross('circle') }, right: { aspect: 1, wheel: true, items: [] },
      size: { wide: [.56, .30, .62, .30], tall: [.78, .44, .84, .48] } },
    classic: { name: 'Classic' }
  };
  var ORDER = ['ghost', 'height', 'wheel', 'classic'];

  /* ---------- saved settings ---------- */
  var cfg = { layout: 'ghost', hit: false, idle: true, views: {} };
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v === 'object') { cfg.layout = LAYOUTS[v.layout] ? v.layout : 'ghost'; cfg.hit = !!v.hit; cfg.idle = v.idle !== false; cfg.views = v.views && typeof v.views === 'object' ? v.views : {}; } } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  load();
  var mode = 'wide';                                  // wide = over the fight, tall = panel under it
  function view() { var k = cfg.layout + ':' + mode; var v = cfg.views[k]; if (!v || typeof v !== 'object') v = cfg.views[k] = { size: 1, pieces: {} }; v.pieces = v.pieces || {}; v.size = +v.size || 1; return v; }

  /* ---------- DOM ---------- */
  var root = document.documentElement, host, L, R, gear, sheet, flashTimer = 0, idleTimer = 0, arranging = false, selected = null;
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function arrow(d) { return '<svg class="tp-arrow" viewBox="0 0 24 24" aria-hidden="true" style="rotate:' + TURN[d] + 'deg"><path d="' + TRI + '"/></svg>'; }

  function buildCluster(box, spec) {
    box.replaceChildren();
    box.style.aspectRatio = String(spec.aspect);
    if (spec.wheel) { var piece = el('div', 'tp-piece'); piece.dataset.piece = 'wheel'; buildWheel(piece); box.append(piece); }
    spec.items.forEach(function (it, n) {
      var b = el('div', 'tp-btn ' + it.shape);
      b.dataset.act = it.a; b.dataset.piece = it.a; b.setAttribute('role', 'button'); b.setAttribute('aria-label', NAME[it.a]);
      b.style.cssText = 'left:' + it.x / spec.aspect * 100 + '%;top:' + it.y * 100 + '%;width:' + it.s / spec.aspect * 100 + '%;height:' + it.s * 100 + '%;--c:' + C[it.c] + ';' + (it.inset ? '--inset:' + it.inset + ';' : '') + '--wd:' + (n % 2 ? '-.13s' : '0s');
      var face = el('span', 'tp-face');
      if (it.arrow && it.t) { face.classList.add('tp-lab', it.arrow === 'up' ? 'tp-lab-below' : 'tp-lab-above'); face.innerHTML = arrow(it.arrow) + '<span class="tp-t">' + it.t + '</span>'; }
      else face.innerHTML = (it.arrow ? arrow(it.arrow) : '') + (it.t ? '<span class="tp-t">' + it.t + (it.sub ? '<span class="tp-s">' + it.sub + '</span>' : '') + '</span>' : '');
      b.append(face); box.append(b);
    });
    (spec.caps || []).forEach(function (c) { var cap = el('span', 'tp-cap'); cap.dataset.capFor = c.t === 'PUNCH' ? 'pHigh' : 'kHigh'; cap.textContent = c.t; cap.style.left = c.x / spec.aspect * 100 + '%'; cap.style.top = c.y * 100 + '%'; box.append(cap); });
  }

  function buildWheel(hostEl) {
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'tp-wheel');
    var cx = 50, cy = 50, R0 = 48, R1 = 17;
    function pol(r, deg) { return [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)]; }
    function mk(tag, attrs) { var n = document.createElementNS(ns, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
    [42, 36, 30, 24].forEach(function (r) { svg.append(mk('circle', { class: 'tp-groove', cx: cx, cy: cy, r: r })); });
    [['pHigh', 190, 250, 'punch', 'HIGH', 'PUNCH'], ['pMid', 150, 190, 'punch', 'MID', 'PUNCH'], ['pLow', 110, 150, 'punch', 'LOW', 'PUNCH'],
     ['kHigh', -70, -10, 'kick', 'HIGH', 'KICK'], ['kMid', -10, 30, 'kick', 'MID', 'KICK'], ['kLow', 30, 70, 'kick', 'LOW', 'KICK']].forEach(function (s) {
      var a0 = s[1] + 1.6, a1 = s[2] - 1.6, ri = R1 + 3, p0 = pol(R0, a0), p1 = pol(R0, a1), p2 = pol(ri, a1), p3 = pol(ri, a0);
      var d = 'M' + p0 + ' A' + R0 + ' ' + R0 + ' 0 0 1 ' + p1 + ' L' + p2 + ' A' + ri + ' ' + ri + ' 0 0 0 ' + p3 + 'Z';
      var g = mk('g', { role: 'button', 'aria-label': NAME[s[0]] }); g.dataset.act = s[0]; g.style.setProperty('--c', C[s[3]]);
      g.append(mk('path', { d: d, class: 'tp-slice' }), mk('path', { d: d, class: 'tp-hit' }));
      var m = pol(33, (s[1] + s[2]) / 2), t = mk('text', { x: m[0], y: m[1] - 2.2 }); t.textContent = s[4];
      var t2 = mk('text', { x: m[0], y: m[1] + 3.4, class: 'tp-sub' }); t2.textContent = s[5];
      g.append(t, t2); svg.append(g);
    });
    // the record's label is the GET DOWN button: the special move (the V-Wave), no separate V-Wave button here
    var g = mk('g', { role: 'button', 'aria-label': 'Get Down (special move)' }); g.dataset.act = 'wave'; g.dataset.name = 'GET DOWN'; g.style.setProperty('--c', C.special);
    g.append(mk('circle', { cx: cx, cy: cy, r: R1, class: 'tp-slice tp-label' }), mk('circle', { cx: cx, cy: cy, r: R1, class: 'tp-hit' }));
    var a = mk('text', { x: cx, y: cy - 2.6, class: 'tp-gd' }); a.textContent = 'GET';
    var b = mk('text', { x: cx, y: cy + 4.2, class: 'tp-gd' }); b.textContent = 'DOWN';
    g.append(a, b, mk('circle', { cx: cx, cy: cy + 10.5, r: 1.2, class: 'tp-spindle' })); svg.append(g);
    hostEl.append(svg);
  }

  function ensureHost() {
    if (host) return true;
    var stage = document.getElementById('stage'), ctrl = document.getElementById('controller');
    if (!stage || !ctrl || !window.Jerm747TouchInput) return false;
    host = el('div', 'tp-host'); host.id = 'tp-host'; host.setAttribute('role', 'group'); host.setAttribute('aria-label', 'Touch controls');
    L = el('div', 'tp-cluster tp-l'); R = el('div', 'tp-cluster tp-r');
    gear = el('button', 'tp-gear'); gear.type = 'button'; gear.textContent = '⚙'; gear.title = 'Touch layout'; gear.setAttribute('aria-label', 'Touch layout');
    gear.addEventListener('click', function () { openMenu(); });
    host.append(L, R, gear);
    var fl = el('div', 'tp-flash'); fl.id = 'tp-flash'; host.append(fl);
    bindPointers();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { placeHost(); }).observe(stage);
    window.addEventListener('resize', placeHost);
    // show only while a round is being fought (the game hides #controller otherwise)
    if (typeof MutationObserver !== 'undefined') { new MutationObserver(paintVisible).observe(ctrl, { attributes: true, attributeFilter: ['class'] }); new MutationObserver(paintVisible).observe(root, { attributes: true, attributeFilter: ['class'] }); }
    return true;
  }
  function wideNow() {
    var stage = document.getElementById('stage'), r = stage.getBoundingClientRect(), app = document.querySelector('.app');
    return root.classList.contains('ov-mode') || (app && app.classList.contains('is-compact')) || r.width / Math.max(1, r.height) >= 1.3;
  }
  function placeHost() {
    if (!host) return;
    var stage = document.getElementById('stage'), ctrl = document.getElementById('controller');
    var m = wideNow() ? 'wide' : 'tall';
    if (m === 'wide' && host.parentNode !== stage) stage.append(host);
    if (m === 'tall' && host.previousElementSibling !== ctrl) ctrl.after(host);
    host.classList.toggle('tp-wide', m === 'wide'); host.classList.toggle('tp-tall', m === 'tall');
    if (m !== mode) { mode = m; render(); } else layoutClusters();
  }
  function layoutClusters() {
    if (!host || cfg.layout === 'classic') return;
    var spec = LAYOUTS[cfg.layout], sz = spec.size[mode], r = host.getBoundingClientRect(), W = r.width, H = r.height, k = view().size;
    if (!W || !H) return;
    var lh = Math.min(sz[0] * H, sz[1] * W), rh = Math.min(sz[2] * H, sz[3] * W / spec.right.aspect);
    var pad = mode === 'wide' ? .03 : .03, bot = mode === 'wide' ? .06 : .08;
    Object.assign(L.style, { left: 'max(' + pad * 100 + '%, env(safe-area-inset-left, 0px))', bottom: bot * 100 + '%', height: lh + 'px', transform: 'scale(' + k + ')' });
    Object.assign(R.style, { right: 'max(' + pad * 100 + '%, env(safe-area-inset-right, 0px))', bottom: (mode === 'tall' && spec.right.wheel ? .05 : bot) * 100 + '%', height: rh + 'px', transform: 'scale(' + k + ')' });
    applyPieces();
  }
  // per-button offsets: fraction of the controls area; divided by the overall scale inside a scaled cluster
  function applyPieces() {
    if (!host) return;
    var r = host.getBoundingClientRect(), v = view(), k = v.size;
    host.querySelectorAll('[data-piece]').forEach(function (p) {
      var o = v.pieces[p.dataset.piece] || {};
      p.style.setProperty('--dx', (o.dx || 0) * r.width / k + 'px'); p.style.setProperty('--dy', (o.dy || 0) * r.height / k + 'px');
      p.style.setProperty('--bs', String(o.s || 1)); p.classList.toggle('tp-sel', arranging && p.dataset.piece === selected);
    });
    host.querySelectorAll('.tp-cap').forEach(function (c) { var o = v.pieces[c.dataset.capFor]; c.hidden = !!(o && (o.dx || o.dy)); });
  }
  function render() {
    if (!ensureHost()) return;
    var on = cfg.layout !== 'classic';
    root.classList.toggle('tp-on', on);
    host.classList.toggle('tp-show-hit', cfg.hit);
    if (on) { buildCluster(L, LAYOUTS[cfg.layout].left); buildCluster(R, LAYOUTS[cfg.layout].right); layoutClusters(); }
    else { L.replaceChildren(); R.replaceChildren(); }
    paintVisible(); wake();
  }
  function paintVisible() {
    if (!host) return;
    var ctrl = document.getElementById('controller');
    // v88: with player slots the game says when Player 1 fights on-screen (Jerm747TouchInput.visible); else the old #controller signal
    var T0 = T(), fighting = (T0 && T0.visible ? T0.visible() : (ctrl && !ctrl.classList.contains('hidden'))) && !root.classList.contains('ov-menu');
    host.hidden = cfg.layout === 'classic' || (!fighting && !arranging) || (root.classList.contains('controls-hidden') && !arranging);
    if (!host.hidden) layoutClusters();
    if (host.hidden) releaseAll();
  }

  /* ---------- play: multi-touch, slide between buttons ---------- */
  var pressed = new Map();
  function T() { return window.Jerm747TouchInput; }
  function actAt(x, y) { var t = document.elementFromPoint(x, y), b = t && t.closest && t.closest('[data-act]'); return b && host.contains(b) ? b : null; }
  function pieceAt(x, y) { var t = document.elementFromPoint(x, y), p = t && t.closest && t.closest('[data-piece]'); return p && host.contains(p) ? p : null; }
  function light(b, on) { if (b) b.classList.toggle('tp-on', on); }
  function press(id, b) {
    var act = b.dataset.act;
    if (!T() || !T().press(id, act)) return;
    pressed.set(id, b); light(b, true);
    if (!HELD[act]) { var f = document.getElementById('tp-flash'); if (f && act !== 'jump') { f.textContent = b.dataset.name || NAME[act].toUpperCase(); f.classList.add('on'); clearTimeout(flashTimer); flashTimer = setTimeout(function () { f.classList.remove('on'); }, 380); } }
  }
  function release(id) {
    var b = pressed.get(id); pressed.delete(id);
    var still = false; pressed.forEach(function (v) { if (v === b) still = true; });
    if (b && !still) light(b, false);
    if (T()) T().release(id);
    wake();
  }
  function releaseAll() { Array.from(pressed.keys()).forEach(release); }
  var drag = null;
  function bindPointers() {
    host.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.tp-gear')) return;
      var onControl = e.target.closest('[data-act],[data-piece]');
      if (!onControl && !arranging) return;           // taps on the fight itself go to the game as before
      e.preventDefault(); wake();
      try { (onControl || host).setPointerCapture(e.pointerId); } catch (x) {}
      if (arranging) {
        var p = pieceAt(e.clientX, e.clientY);
        if (!p) { selected = null; syncMenu(); applyPieces(); return; }
        var id = p.dataset.piece, o = view().pieces[id] || {};
        drag = { pid: e.pointerId, id: id, x: e.clientX, y: e.clientY, dx: o.dx || 0, dy: o.dy || 0, moved: false };
        selected = id; syncMenu(); applyPieces(); return;
      }
      var b = actAt(e.clientX, e.clientY); if (b) press(e.pointerId, b);
    });
    host.addEventListener('pointermove', function (e) {
      if (drag && drag.pid === e.pointerId) {
        var r = host.getBoundingClientRect(), mx = e.clientX - drag.x, my = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(mx, my) < 5) return;
        drag.moved = true;
        var o = view().pieces[drag.id] || (view().pieces[drag.id] = {});
        o.dx = Math.max(-.95, Math.min(.95, drag.dx + mx / r.width)); o.dy = Math.max(-.95, Math.min(.95, drag.dy + my / r.height));
        applyPieces(); return;
      }
      if (!pressed.has(e.pointerId)) return;
      var b = actAt(e.clientX, e.clientY), cur = pressed.get(e.pointerId);
      if (b === cur) return;
      release(e.pointerId); if (b) press(e.pointerId, b);
    });
    function end(e) { if (drag && drag.pid === e.pointerId) { if (drag.moved) save(); drag = null; return; } if (pressed.has(e.pointerId)) release(e.pointerId); }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { host.addEventListener(n, end); });
    host.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  function wake() { if (!host) return; host.classList.remove('tp-idle'); clearTimeout(idleTimer); if (cfg.idle && !arranging) idleTimer = setTimeout(function () { if (!pressed.size && !arranging) host.classList.add('tp-idle'); }, 2600); }

  /* ---------- touch layout menu ---------- */
  function paintRange(i) { i.style.setProperty('--fill', (i.value - i.min) / (i.max - i.min) * 100 + '%'); }
  function openMenu() {
    if (!ensureHost()) return;
    var T0 = T(); if (T0 && T0.playable && T0.playable()) { var p = document.getElementById('pause'); if (p && !p.disabled) p.click(); }
    if (!sheet) buildMenu();
    sheet.hidden = false; syncMenu(); sheet.querySelector('[aria-pressed="true"]')?.focus();
  }
  function closeMenu() { if (!sheet) return; setArranging(false); sheet.hidden = true; save(); }
  function setArranging(on) {
    arranging = on; selected = null;
    root.classList.toggle('tp-arranging', on);
    releaseAll(); paintVisible(); applyPieces(); syncMenu(); wake();
  }
  function buildMenu() {
    sheet = el('div', 'tp-sheet'); sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Touch layout');
    sheet.innerHTML =
      '<div class="tp-sheet-head"><b>Touch layout</b><button type="button" class="tp-done" data-x="done">Done</button></div>' +
      '<div class="tp-seg" role="group" aria-label="Layout">' + ORDER.map(function (k) { return '<button type="button" data-layout="' + k + '">' + LAYOUTS[k].name + '</button>'; }).join('') + '</div>' +
      '<div class="tp-row tp-only-new"><span class="tp-lbl">All buttons</span><input type="range" class="tp-range" data-x="all" min="70" max="140" step="1" aria-label="Size of all buttons"><span class="tp-val" data-v="all"></span></div>' +
      '<div class="tp-row tp-only-new"><span class="tp-lbl" data-v="one-lbl">One button</span><input type="range" class="tp-range tp-one" data-x="one" min="60" max="180" step="1" aria-label="Size of the selected button"><span class="tp-val" data-v="one"></span></div>' +
      '<div class="tp-chips">' +
        '<button type="button" class="tp-chip tp-only-new" data-x="arrange">Arrange buttons</button>' +
        '<button type="button" class="tp-chip tp-only-new" data-x="hit">Show touch areas</button>' +
        '<button type="button" class="tp-chip tp-only-new" data-x="idle">Fade when idle</button>' +
        '<button type="button" class="tp-chip" data-x="hide">Hide buttons</button>' +
        '<button type="button" class="tp-chip tp-only-new" data-x="reset">Reset this layout</button>' +
      '</div><p class="tp-hint" data-v="hint"></p>';
    document.body.append(sheet);
    sheet.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.layout) { cfg.layout = b.dataset.layout; setArranging(false); save(); render(); syncMenu(); return; }
      var x = b.dataset.x;
      if (x === 'done') closeMenu();
      else if (x === 'arrange') setArranging(!arranging);
      else if (x === 'hit') { cfg.hit = !cfg.hit; host.classList.toggle('tp-show-hit', cfg.hit); save(); syncMenu(); }
      else if (x === 'idle') { cfg.idle = !cfg.idle; save(); syncMenu(); wake(); }
      else if (x === 'hide') { var V = window.Jerm747GameControlsVisibility; if (V) V.toggle(); syncMenu(); paintVisible(); }
      else if (x === 'reset') { cfg.views[cfg.layout + ':' + mode] = { size: 1, pieces: {} }; selected = null; save(); layoutClusters(); syncMenu(); }
    });
    sheet.addEventListener('input', function (e) {
      var i = e.target; paintRange(i);
      if (i.dataset.x === 'all') { view().size = i.value / 100; layoutClusters(); }
      if (i.dataset.x === 'one' && selected) { var o = view().pieces[selected] || (view().pieces[selected] = {}); o.s = i.value / 100; applyPieces(); }
      syncMenu(); save();
    });
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } });
  }
  function syncMenu() {
    if (!sheet) return;
    var isNew = cfg.layout !== 'classic', v = view(), hidden = !!(window.Jerm747GameControlsVisibility && window.Jerm747GameControlsVisibility.get());
    sheet.querySelectorAll('[data-layout]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.layout === cfg.layout)); });
    sheet.querySelectorAll('.tp-only-new').forEach(function (n) { n.hidden = !isNew; });
    var all = sheet.querySelector('[data-x="all"]'), one = sheet.querySelector('[data-x="one"]');
    all.value = Math.round(v.size * 100); sheet.querySelector('[data-v="all"]').textContent = all.value + '%'; paintRange(all);
    var o = selected ? v.pieces[selected] || {} : null;
    one.disabled = !o; one.value = o ? Math.round((o.s || 1) * 100) : 100; paintRange(one);
    sheet.querySelector('[data-v="one"]').textContent = o ? one.value + '%' : '—';
    var lbl = sheet.querySelector('[data-v="one-lbl"]'); lbl.textContent = selected ? NAME[selected] : 'One button'; lbl.classList.toggle('tp-sel', !!selected);
    sheet.querySelector('[data-x="arrange"]').setAttribute('aria-pressed', String(arranging));
    sheet.querySelector('[data-x="hit"]').setAttribute('aria-pressed', String(cfg.hit));
    sheet.querySelector('[data-x="idle"]').setAttribute('aria-pressed', String(cfg.idle));
    var hb = sheet.querySelector('[data-x="hide"]'); hb.textContent = hidden ? 'Show buttons' : 'Hide buttons'; hb.setAttribute('aria-pressed', String(hidden));
    sheet.querySelector('[data-v="hint"]').textContent = !isNew ? 'Classic is the original block layout.'
      : arranging ? 'Buttons are wiggling: drag any button to move it, tap one to size just that one.'
      : 'Saved on this device (and on every device for subscribers), separately for sideways and upright.';
  }

  window.Jerm747TouchPad = {
    open: openMenu,
    layoutName: function () { return LAYOUTS[cfg.layout].name; },
    get: function () { return JSON.parse(JSON.stringify(cfg)); },
    refresh: function () { load(); render(); }
  };
  // a sync from another device (subscribers) rewrites the saved settings: pick them up
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); render(); } });
  function start() { if (!ensureHost()) { setTimeout(start, 300); return; } placeHost(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
