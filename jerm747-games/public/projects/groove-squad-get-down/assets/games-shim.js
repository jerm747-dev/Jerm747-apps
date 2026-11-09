/* jerm747.games shim for Groove Squad Get Down.
   The game was written for jerm747.com, where a music player, accounts and PHP endpoints sit around it.
   Here it runs on its own inside the arcade, so:
   - /api/ calls are answered locally (no jerm747.com accounts, no tracking, no network errors);
   - Ranked Run keeps a leaderboard on this device instead of the site-wide subscriber board;
   - the "Match music" buttons are hidden, because there is no site music player to drive. */
(() => {
  'use strict';
  const RK_KEY = 'jerm747.games.getdown.ranked.board';
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const read = () => { try { return JSON.parse(localStorage.getItem(RK_KEY) || '[]') || []; } catch { return []; } };
  const write = (rows) => { try { localStorage.setItem(RK_KEY, JSON.stringify(rows)); } catch {} };
  const top = (n = 10) => read().sort((a, b) => a.time - b.time || a.at - b.at).slice(0, n).map((r, i) => ({ ...r, rank: i + 1, mine: true }));
  const best = () => { const t = top(1)[0]; return t ? { name: t.name, time: t.time, rank: 1, hidden: false } : null; };
  const tokens = new Set();

  function ranked(method, body) {
    if (method === 'GET') return json({ ok: true, top: top(10), me: best() });
    if (body.action === 'start') { const token = Math.random().toString(36).slice(2); tokens.add(token); return json({ ok: true, token }); }
    if (body.action === 'submit') {
      let name = String(body.name || '').trim();
      if (!name) { try { name = localStorage.getItem('jerm747.getdown.ranked.name') || ''; } catch {} }
      if (!/^[\p{L}\p{N} ._'-]{2,18}$/u.test(name)) return json({ ok: false, code: 'name_needed' });
      const time = Math.round(Number(body.time) * 10) / 10;
      if (!Number.isFinite(time) || time <= 0) return json({ ok: false, code: 'bad_time' });
      const before = best();
      const rows = read(); rows.push({ name, member: String(body.member || ''), time, retries: body.retries | 0, at: Math.floor(Date.now() / 1000) });
      write(rows.sort((a, b) => a.time - b.time).slice(0, 50));
      const me = best(), mine = top(50).findIndex(r => r.time === time && r.name === name);
      return json({ ok: true, improved: !before || time < before.time, me: { ...me, rank: mine + 1 || me.rank }, top: top(10) });
    }
    return json({ ok: false });
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const m = url.pathname.match(/\/api\/([a-z0-9_-]+)\.php$/i);
    if (!m) return nativeFetch(input, init);
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch {}
    if (m[1] === 'ranked') return ranked(method, body);
    if (m[1] === 'me') return json({ ok: true, loggedIn: true, subscribed: true });
    return json({ ok: false, code: 'offline', message: 'Not available on jerm747.games' }, 404);
  };
  // sendBeacon is used for activity pings on jerm747.com; nothing to send here.
  try { const nb = navigator.sendBeacon?.bind(navigator); navigator.sendBeacon = (u, d) => /\/api\//.test(String(u)) ? true : nb ? nb(u, d) : false; } catch {}

  const style = document.createElement('style');
  style.textContent = '[data-match-music]{display:none!important}';
  document.head.append(style);

  window.JERM747_GAMES = true;
})();
