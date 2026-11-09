/* V53 · Site extras, loaded on every page (index.html template):
   1. Counts page views for the admin Network tab (api/traffic.php): page, where the visitor came from,
      device, time zone, language, new or returning. Anonymous: the same visitor key as the song stats.
   2. Marks a visitor "engaged" (once a day) after 30 seconds of listening or opening a game.
   3. Adds "Newsletter" to the site menu, under Contact.
   Admin pages aren't counted, and the admin chart switches counting off for the owner's own browser
   (localStorage "jerm747.notrack"). Never blocks or slows the site. */
(function () {
  'use strict';
  if (window.__jermSiteExtras) return;
  window.__jermSiteExtras = true;
  var ENDPOINT = '/api/traffic.php';
  var store = null;
  try { store = window.localStorage; } catch (e) {}
  function get(k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (store) store.setItem(k, v); } catch (e) {} }

  // ---------------- 3. Newsletter link in the menu ----------------
  function addMenuLink() {
    var contact = document.querySelector('.menu-nav a.menu-link[href="/contact"]');
    if (!contact || document.querySelector('.menu-nav [data-newsletter-link]')) return;
    var li = contact.closest('li');
    var a = document.createElement('a');
    a.href = '/newsletter/'; a.className = 'menu-link'; a.setAttribute('data-newsletter-link', '');
    a.innerHTML = '<span class="menu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>'
      + '<span class="menu-text"><span class="menu-label">Newsletter</span><span class="menu-sub">New music in your inbox</span></span>';
    if (li) { var item = document.createElement('li'); item.appendChild(a); li.parentNode.insertBefore(item, li.nextSibling); }
    else contact.parentNode.insertBefore(a, contact.nextSibling);
  }
  new MutationObserver(addMenuLink).observe(document.documentElement, { childList: true, subtree: true });

  // ---------------- 1. page views ----------------
  if (get('jerm747.notrack') === '1') return;
  function visitor() {
    var v = get('jerm747.visitor');
    if (!v || !/^[a-f0-9]{32}$/.test(v)) {
      var b = new Uint8Array(16); crypto.getRandomValues(b);
      v = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      set('jerm747.visitor', v);
    }
    return v;
  }
  function device() {
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    var small = Math.min(screen.width || 9999, screen.height || 9999);
    return coarse ? (small < 600 ? 'phone' : 'tablet') : 'desktop';
  }
  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  var firstSource = (function () {
    try {
      var q = new URLSearchParams(location.search), tag = q.get('ref') || q.get('utm_source');
      if (tag && /^[A-Za-z0-9.-]{2,40}$/.test(tag)) return tag.toLowerCase();
      if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) return h; }
    } catch (e) {}
    return '';
  })();
  var lastPath = null, views = 0;
  function view() {
    var p = location.pathname;
    if (p === lastPath || /^\/admin/.test(p)) { lastPath = p; return; }
    lastPath = p;
    var isNew = !get('jerm747.firstSeen');
    if (isNew) set('jerm747.firstSeen', String(Date.now()));
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    send({ visitor: visitor(), t: 'view', path: p, ref: views === 0 ? firstSource : '', tz: tz, lang: navigator.language || '', device: device(), isNew: isNew && views === 0 ? 1 : 0 });
    views++;
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(view, 0); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(view, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', view); else view();

  // ---------------- 2. engaged (once a day) ----------------
  function engaged(kind) {
    var today = new Date().toISOString().slice(0, 10);
    if (get('jerm747.engagedDay') === today) return;
    set('jerm747.engagedDay', today);
    send({ visitor: visitor(), t: 'engaged', kind: kind });
  }
  var heard = 0, since = 0;
  document.addEventListener('playing', function (e) { if (e.target && e.target.tagName === 'AUDIO') since = Date.now(); }, true);
  ['pause', 'ended', 'waiting'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (since && e.target && e.target.tagName === 'AUDIO') { heard += Date.now() - since; since = 0; } }, true);
  });
  var squadSince = 0;
  setInterval(function () {
    if (since && heard + (Date.now() - since) >= 30000) engaged('listen');
    if (document.querySelector('.get-down-launcher')) engaged('game');
    if (/^\/groove-squad/.test(location.pathname)) { squadSince = squadSince || Date.now(); if (Date.now() - squadSince >= 30000) engaged('game'); } else squadSince = 0;
  }, 5000);
})();
