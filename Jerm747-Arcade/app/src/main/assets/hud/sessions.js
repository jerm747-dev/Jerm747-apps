// The cabinet keeps parked frames attached. Detaching an iframe discards its document.
window.ArcadeSessions = (() => {
  const parked = new Map();
  const key = 'jerm747.arcade.preserveSessions';
  function clocks(frame) {
    const result = [];
    function visit(w) {
      try {
        if (w.ArcadeGameClock) result.push(w.ArcadeGameClock);
        for (let i = 0; i < w.frames.length; i++) visit(w.frames[i]);
      } catch { /* Independent origins own their execution. */ }
    }
    if (frame) visit(frame.contentWindow);
    return result;
  }
  return {
    get enabled() { return localStorage.getItem(key) === 'on'; },
    set enabled(value) { localStorage.setItem(key, value ? 'on' : 'off'); },
    has(id) { return parked.has(String(id)); },
    ids() { return [...parked.keys()]; },
    supported(frame) { try { return !!frame?.contentWindow.ArcadeGameClock; } catch { return false; } },
    hold(frame) { for (const clock of clocks(frame)) clock.hold(); },
    release(frame) { if(frame && window.Arcade?.holding?.(frame.contentWindow))return; for (const clock of clocks(frame)) clock.release(); },
    park(id, frame, data) {
      if (!this.enabled || !this.supported(frame)) return false;
      this.hold(frame);
      frame.hidden = true; frame.inert = true;
      parked.set(String(id), {frame, data});
      return true;
    },
    take(id) {
      const item = parked.get(String(id));
      if (item) {
        parked.delete(String(id));
        item.frame.hidden = false; item.frame.inert = false;
      }
      return item;
    },
    close(id) {
      const item = parked.get(String(id));
      if (item) { parked.delete(String(id)); item.frame.remove(); }
    }
  };
})();
