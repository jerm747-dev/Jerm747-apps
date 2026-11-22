// 747 GP session: the launch choices travel with the URL (so two open games keep independent
// sessions) and are remembered in localStorage (so a fresh visit starts where you left off).
// Keys: mode (arcade | time-trial), transmission (automatic | manual), car, track, opp (0-9 opponents).
window.GPLaunch = (() => {
  const params = new URLSearchParams(location.search);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
  const pick = (name, key, ok, dflt) => {
    const u = params.get(name);
    if (u !== null && ok(u)) { store(key, u); return u; }
    const s = store(key);
    return s !== null && ok(s) ? s : dflt;
  };
  const MAX_OPP = 9;
  const s = {
    mode: pick('mode', 'gp747game', v => v === 'arcade' || v === 'time-trial', 'arcade'),
    transmission: pick('transmission', 'gp747trans', v => v === 'automatic' || v === 'manual', 'automatic'),
    car: pick('car', 'gp747car', v => /^[a-z0-9_-]{1,24}$/i.test(v), ''),
    track: pick('track', 'gp747track', v => /^[a-z0-9_-]{1,32}$/i.test(v), ''),
    opp: +pick('opp', 'gp747opp', v => /^\d$/.test(v) && +v <= MAX_OPP, '3')
  };
  // older builds stored 'manual'/'auto' and 'arcade'/'trial' under these keys
  if (store('gp747trans') === 'auto') store('gp747trans', 'automatic');
  function set(k, v) {
    s[k] = v;
    const key = {mode: 'gp747game', transmission: 'gp747trans', car: 'gp747car', track: 'gp747track', opp: 'gp747opp'}[k];
    if (key) store(key, String(v));
  }
  // link(page) keeps every choice; link(page, {track:'suzuka'}) overrides some.
  // link(page, mode, transmission) still works for the intro.
  function link(page, a, b) {
    const o = typeof a === 'object' && a ? a : (a !== undefined ? {mode: a, transmission: b} : {});
    const url = new URL(page, location.href);
    const q = {...s, ...o};
    const sp = new URLSearchParams({mode: q.mode, transmission: q.transmission});
    if (q.car) sp.set('car', q.car);
    if (q.track) sp.set('track', q.track);
    sp.set('opp', String(q.opp));
    url.search = sp;
    return url.href;
  }
  return {
    get mode() { return s.mode; }, get transmission() { return s.transmission; },
    get car() { return s.car; }, get track() { return s.track; }, get opp() { return s.opp; },
    MAX_OPP, set, link
  };
})();

// Controller calibration (controls.html > Controller > Calibrate), shared by every page.
// Saved in gp747.controls.v1 as pad.cal: the resting value of each axis, and for each direction of the
// left stick (ls), right stick (rs) and D-pad (dp) either {axis, v} (value at full push) or {btn}.
// Without a calibration everything falls back to the standard layout (axes 0-3, D-pad buttons 12-15).
window.GPPad = (() => {
  let cal = null, at = 0;
  function load() {
    const now = Date.now(); if (now - at < 1000) return cal; at = now;
    try { const c = JSON.parse(localStorage.getItem('gp747.controls.v1') || 'null'); cal = c && c.pad && c.pad.cal || null; } catch { cal = null; }
    return cal;
  }
  const clamp = v => Math.max(-1, Math.min(1, v));
  function dirVal(gp, d, rest) {   // 0..1 for one direction
    if (!d) return 0;
    if (d.btn != null) { const b = gp.buttons[d.btn]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; }
    if (d.eq) return Math.abs((gp.axes[d.axis] || 0) - d.v) < 0.12 ? 1 : 0;   // hat-style D-pad: one axis, a value per direction
    const r = gp.axes[d.axis] || 0, c = rest && rest[d.axis] || 0, span = d.v - c;
    if (Math.abs(span) < 1e-3) return 0;
    return Math.max(0, Math.min(1, (r - c) / span));
  }
  // [x, y] in -1..1 (right / down positive), or null when there's no calibration for it
  function stick(gp, which) {
    const c = load(); const k = c && c[which]; if (!k) return null;
    return [clamp(dirVal(gp, k.r, c.rest) - dirVal(gp, k.l, c.rest)), clamp(dirVal(gp, k.d, c.rest) - dirVal(gp, k.u, c.rest))];
  }
  function dpad(gp, dir) {   // dir: l d r u
    const c = load(); const k = c && c.dp && c.dp[dir];
    if (!k) { const b = gp.buttons[{l: 14, d: 13, r: 15, u: 12}[dir]]; return !!(b && b.pressed); }
    return dirVal(gp, k, c.rest) > 0.5;
  }
  // face buttons: cal.fb = physical index for each standard slot [bottom, right, left, top] (A B X Y / ✕ ○ □ △)
  function phys(i) { const c = load(), f = c && c.fb; return f && i >= 0 && i <= 3 && f[i] != null ? f[i] : i; }
  function std(i) { const c = load(), f = c && c.fb; const k = f ? f.indexOf(i) : -1; return k >= 0 ? k : i; }   // physical → slot
  return {stick, dpad, phys, std, get cal() { return load(); }, reload() { at = 0; return load(); }};
})();

// Menu navigation responds to new presses. Holding Start through a page transition
// should never select a car, enter a race, or dismiss another screen.
window.watchMenuPad = function (onAction) {
  let previous = {};
  let index = -1;
  let armed = false;
  function poll() {
    let pad;
    try { pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected); } catch {}
    if (pad && !document.hidden) {
      const pressed = i => !!pad.buttons[i]?.pressed;
      const st = GPPad.stick(pad, 'ls') || [pad.axes[0] || 0, pad.axes[1] || 0];
      const buttons = {
        back: pressed(GPPad.phys(1)), confirm: pressed(GPPad.phys(0)) || pressed(9),
        up: GPPad.dpad(pad, 'u') || st[1] < -.6, down: GPPad.dpad(pad, 'd') || st[1] > .6,
        left: GPPad.dpad(pad, 'l') || st[0] < -.6, right: GPPad.dpad(pad, 'r') || st[0] > .6,
        lb: pressed(4), rb: pressed(5)
      };
      // ignore anything already held when the page opened
      if (!armed) { armed = !Object.values(buttons).some(Boolean); }
      else if (index === pad.index) {
        const next = Object.keys(buttons).find(k => buttons[k] && !previous[k]);
        if (next) onAction(next);
      }
      previous = buttons;
      index = pad.index;
    } else {
      index = -1;
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
};
