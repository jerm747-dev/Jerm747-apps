// Store completed levels only. Retrying a board cannot bank points twice.
window.Jerm747Runs = {
  open(gameId) {
    const key = 'jerm747.arcade.series.v1.' + gameId;
    let checkpoint = {level: 1, total: 0};
    function read() {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && Number.isSafeInteger(saved.level) && saved.level > 0 &&
            Number.isSafeInteger(saved.total) && saved.total >= 0 && saved.level >= checkpoint.level) {
          checkpoint = saved;
        }
      } catch { /* Progress stays available in this session. */ }
      return {...checkpoint};
    }
    return {
      read,
      complete(level, points) {
        read();
        if (checkpoint.level === level && Number.isSafeInteger(points) && points >= 0) {
          checkpoint = {level: level + 1, total: checkpoint.total + points};
          try { localStorage.setItem(key, JSON.stringify(checkpoint)); } catch {}
        }
        return {...checkpoint};
      }
    };
  },
  albumSwaps(level) { return 20 + Math.min(15, Math.floor((level - 1) / 6)); },
  pluginSlots(level) { return 60 + Math.min(60, 3 * Math.floor((level - 1) / 5)); },
  pluginMoves(level) { return 25 + Math.min(7, Math.floor((level - 1) / 12)); }
};
