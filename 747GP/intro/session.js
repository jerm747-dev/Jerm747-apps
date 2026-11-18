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
      const buttons = {
        back: pressed(1), confirm: pressed(0) || pressed(9),
        up: pressed(12) || pad.axes[1] < -.6, down: pressed(13) || pad.axes[1] > .6,
        left: pressed(14) || pad.axes[0] < -.6, right: pressed(15) || pad.axes[0] > .6,
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
