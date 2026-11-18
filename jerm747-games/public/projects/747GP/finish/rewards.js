/* A completed race owns one immutable award. Independent tabs never rewrite a shared balance. */
window.GPFinish = (() => {
  'use strict';
  const prefix = 'gp747.finish.v1.';
  const valid = r => r && typeof r.id === 'string' && Number.isSafeInteger(r.gp) && r.gp >= 0 && Number.isSafeInteger(r.cr) && r.cr >= 0;
  function entries() {
    const records = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      let entry;
      try { entry = JSON.parse(localStorage.getItem(key)); } catch { continue; }
      if (valid(entry)) records.push(entry);
    }
    return records;
  }
  function total() {
    return entries().reduce((sum,entry) => ({gp:sum.gp+entry.gp,cr:sum.cr+entry.cr}), {gp:0,cr:0});
  }
  function newRun(record, group) {
    try {
      for(const entry of entries()) {
        if(entry.group === group && entry.fastest > 0 && (!record || entry.fastest < record)) record = entry.fastest;
      }
    } catch {}
    const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8,'0')).join('');
    return {id, record, group, laps:[], delivered:false};
  }
  function complete(run, info, opts) {
    if (run.delivered || run.laps.length !== 3 || run.laps.some(t => !Number.isFinite(t) || t <= 0)) return false;
    run.delivered = true;
    const fastest = Math.min(...run.laps);
    const bonus = Number.isFinite(run.record) && run.record > 0 && fastest < run.record;
    const gp = run.laps.length * 100 * (bonus ? 1.25 : 1);
    let row = {...info, id:run.id, group:run.group, fastest, laps:run.laps.length, bonus, gp, cr:Math.floor(gp/10)};
    let balance, saved = false;
    try {
      const old = JSON.parse(localStorage.getItem(prefix + row.id));
      if (valid(old)) row = old;
      else localStorage.setItem(prefix + row.id, JSON.stringify(row));
      balance = total(); saved = true;
    } catch { balance = {gp:row.gp, cr:row.cr}; }
    const dest = new URL('finish.html', location.href);
    dest.hash = new URLSearchParams({r:JSON.stringify({row,balance,saved})}).toString();
    if (opts && opts.navigate === false) return {url: dest.href, row, balance, saved};
    location.replace(dest.href);
    return true;
  }
  return {newRun, complete, total, valid, prefix};
})();
