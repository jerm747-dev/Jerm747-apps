/* The cabinet owns the visor. Keep each embedded game's time local so a timed
   run resumes on the same frame, even after a long visit to settings. */
(() => {
  'use strict';
  if (parent === window || window.ArcadeGameClock) return;
  let host = parent;
  try {
    while (!host.Arcade && host !== host.parent) host = host.parent;
    if (!host.Arcade) return;
  } catch { return; }
  const raf = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window);
  const later = setTimeout.bind(window), stop = clearTimeout.bind(window);
  const realNow = performance.now.bind(performance);
  const frames = new Map(), timers = new Map(), keys = new Map(), sounds = new Set();
  let paused = false, since = 0, offset = 0, sequence = 0, animations = [], playing = [], media = [];
  const now = () => (paused ? since : realNow()) - offset;
  Object.defineProperty(performance, 'now', {configurable: true, value: now});
  function armFrame(id, item) {
    item.handle = raf(t => { frames.delete(id); item.fn(t - offset); });
  }
  window.requestAnimationFrame = fn => {
    const id = ++sequence, item = {fn};
    frames.set(id, item);
    if (!paused) armFrame(id, item);
    return id;
  };
  window.cancelAnimationFrame = id => { cancel(frames.get(id)?.handle); frames.delete(id); };
  function armTimer(id, item) {
    item.due = now() + item.left;
    item.handle = later(() => {
      if (item.repeat) { item.left = item.delay; armTimer(id, item); }
      else timers.delete(id);
      item.fn.apply(window, item.args);
    }, item.left);
  }
  function timer(fn, delay, args, repeat) {
    if (typeof fn !== 'function') throw new TypeError('Game timers require a callback');
    delay = Math.max(0, Number(delay) || 0);
    const id = ++sequence, item = {fn, delay, args, repeat, left: delay};
    timers.set(id, item);
    if (!paused) armTimer(id, item);
    return id;
  }
  window.setTimeout = (fn, ms, ...args) => timer(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => timer(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = id => { stop(timers.get(id)?.handle); timers.delete(id); };
  if (window.AudioContext) {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); sounds.add(this); }
      close() { sounds.delete(this); return super.close(); }
    };
  }
  addEventListener('keydown', e => keys.set(e.code, {key:e.key, code:e.code, target:e.target}), true);
  addEventListener('keyup', e => keys.delete(e.code), true);
  window.ArcadeGameClock = {
    hold() {
      if (paused) return;
      since = realNow(); paused = true;
      window.dispatchEvent(new Event('arcade-visor-hold'));
      for (const item of frames.values()) cancel(item.handle);
      for (const item of timers.values()) { stop(item.handle); item.left = Math.max(0, item.due - now()); }
      for (const item of [...keys.values()]) item.target.dispatchEvent(new KeyboardEvent('keyup', {...item, bubbles:true}));
      keys.clear();
      animations = (document.getAnimations?.() || []).filter(a => a.playState === 'running');
      for (const a of animations) a.pause();
      playing = [...sounds].filter(ctx => ctx.state === 'running');
      for (const ctx of playing) ctx.suspend().catch(() => {});
      media = [...document.querySelectorAll('audio,video')].filter(el => !el.paused);
      for (const el of media) el.pause();
    },
    release() {
      if (!paused) return;
      offset += realNow() - since; paused = false;
      for (const [id,item] of frames) armFrame(id,item);
      for (const [id,item] of timers) armTimer(id,item);
      for (const a of animations) if (a.playState === 'paused') a.play();
      for (const ctx of playing) if (ctx.state !== 'closed') ctx.resume().catch(() => {});
      for (const el of media) el.play().catch(() => {});
      animations = []; playing = []; media = [];
      window.dispatchEvent(new Event('arcade-visor-resume'));
    },
    get held() { return paused; }
  };
  if (host.Arcade.holding?.(window)) window.ArcadeGameClock.hold();
})();
