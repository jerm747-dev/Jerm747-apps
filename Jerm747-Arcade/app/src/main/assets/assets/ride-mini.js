/*
 * v72.4 · Let It Ride, small, for pages outside the app (the Character showcase).
 * A shared showcase link has no music library on screen, so a little bar at the bottom offers the same round
 * Let It Ride button as the app: one tap shuffles the whole library, nonstop. Then it shows play/pause, the song,
 * Next, and "Open in player", which hands the same song and spot to the full player.
 *
 * Honors this browser's choices from the app: hidden songs, hidden song types / "only" type, explicit lyrics
 * (hidden unless allowed), volume and mute. Lock-screen controls work too. Song list: /assets/ride-catalog.json
 * (written by `npm run build`, scripts/ride-catalog.mjs).
 * Add to a page with:  <link rel="stylesheet" href="/assets/ride-mini.css?v=72.4"><script defer src="/assets/ride-mini.js?v=172"></script>
 */
(function () {
  'use strict';
  if (window.__jermRideMini) return; window.__jermRideMini = true;
  // v88: opened inside the site (showcase-player-bridge.js panel), the site's own player is right there
  try { if (window.parent !== window && window.parent.document.querySelector('#root')) return; } catch (e) {}
  var CATALOG = '/assets/ride-catalog.json?v=159';
  var reviewRecords = {}, explicitIds = [], labelsReady = false;
  var SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  var read = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  var json = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };

  var all = null, loading = null, queue = [], at = -1, current = null, wantPlay = false, failures = 0;
  var audio = new Audio(); audio.preload = 'none';
  var vol = parseFloat(read('jerm747.volume', '1')); audio.volume = isFinite(vol) ? Math.min(Math.max(vol, 0), 1) : 1;
  audio.muted = read('jerm747.muted', '0') === '1';

  function load() {
    if (!loading) loading = Promise.all([CATALOG, '/api/content-review.php', '/api/explicit.php'].map(function(url) {
      return fetch(url, {cache:'no-store'}).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){if(url===CATALOG)return fetch('/assets/ride-catalog.json?v=172',{cache:'no-store'}).then(function(r){return r.json();});throw e;});
    })).then(function(d) {
      if (!d[1].records || Array.isArray(d[1].records) || !Array.isArray(d[2].ids)) throw new Error('Labels unavailable');
      all = d[0].tracks || []; reviewRecords = d[1].records; explicitIds = d[2].ids; labelsReady = true; loading = null; enforce(); return all;
    }).catch(function(e) { loading = null; labelsReady = false; enforce(); throw e; });
    return loading;
  }
  // Same filters as the app: hidden songs, hidden types / "only" a type, explicit (hidden unless allowed)
  function playable(list) {
    var hidden = json('jerm747.hidden', []), prefs = json('jerm747.typePrefs', {}), off = prefs.off || [], only = prefs.only || '';
    var vocals = json('jerm747.listening.v2', {}).vocals === true;
    var explicit = vocals && read('jerm747.explicit.allow.v2', '') === '1' ? [] : explicitIds;
    if (!labelsReady) return [];
    return list.filter(function (t) {
      if (hidden.indexOf(t.id) >= 0 || explicit.indexOf(t.id) >= 0) return false;
      var kind = reviewRecords[t.id] ? reviewRecords[t.id].type : t.recordingType;
      if (kind !== 'instrumental' && !(kind === 'vocal' && vocals)) return false;
      var types = t.types || [];
      for (var i = 0; i < off.length; i++) if (types.indexOf(off[i]) >= 0) return false;
      return !only || types.indexOf(only) >= 0;
    });
  }
  function shuffle(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  // ---- UI ----
  var bar = document.createElement('div'); bar.className = 'ride-mini is-idle'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Let It Ride music player');
  bar.innerHTML =
    '<button type="button" class="ride-mini-btn" aria-label="Let It Ride: shuffle all the music"><span class="ride-mini-ring" aria-hidden="true"></span><span class="ride-mini-face" aria-hidden="true"></span></button>' +
    '<div class="ride-mini-text"><b class="ride-mini-title">Let It Ride</b><small class="ride-mini-sub">Shuffle all the music</small></div>' +
    '<button type="button" class="ride-mini-next" aria-label="Next song" hidden>' + icon('next') + '</button>' +
    '<a href="/preferences#listening-controls" style="font-size:11px;margin:0 8px">Listening Controls</a>' +
    '<a class="ride-mini-open" href="/ride" hidden title="Open the full player (same song, same spot)">Open player</a>';
  var btn = bar.querySelector('.ride-mini-btn'), face = bar.querySelector('.ride-mini-face'), title = bar.querySelector('.ride-mini-title'),
      sub = bar.querySelector('.ride-mini-sub'), nextBtn = bar.querySelector('.ride-mini-next'), open = bar.querySelector('.ride-mini-open');
  function icon(n) {
    var p = { shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
      play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>', pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
      next: '<path d="M5 4.5v15l10-7.5z" fill="currentColor" stroke="none"/><rect x="16.5" y="4.5" width="2.5" height="15" rx="1" fill="currentColor" stroke="none"/>' }[n];
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function paint() {
    var state = !current ? 'idle' : !audio.paused ? 'playing' : wantPlay ? 'loading' : 'paused';
    bar.className = 'ride-mini is-' + state;
    face.innerHTML = icon(state === 'idle' ? 'shuffle' : state === 'playing' || state === 'loading' ? 'pause' : 'play');
    btn.setAttribute('aria-label', state === 'idle' ? 'Let It Ride: shuffle all the music' : state === 'paused' ? 'Play ' + current.title : 'Pause ' + current.title);
    if (current) { title.textContent = current.title; sub.textContent = state === 'loading' ? 'Loading…' : (current.artists || []).join(', ') + ' · Let It Ride'; }
    nextBtn.hidden = !current; open.hidden = !current;
  }

  // Skip silence (same rule as the app, /silence.json from `npm run silence`): start ~1 s before the sound,
  // move on ~2 s after it runs out. Honors the app's "Skip silence" switch on this browser.
  var marks = null, cut = null, cutFired = false;
  function loadMarks() { if (marks || read('jerm747.skipSilence', '1') === '0') return; marks = {}; fetch('/silence.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { marks = (d && d.songs) || {}; }).catch(function () {}); }
  function trim(t) {
    if (!marks || read('jerm747.skipSilence', '1') === '0') return null;
    var name = ''; try { name = decodeURIComponent(String(t.url).split(/[?#]/)[0].split('/').pop()); } catch (e) {}
    var m = t.silence || marks[name]; if (!m || m.length < 3 || m[1] - m[0] < 1) return null;
    return { from: m[0] > 1.25 ? m[0] - 1 : 0, cutAt: m[2] - m[1] > 2.25 ? m[1] + 2 : null };
  }
  function playAt(i) {
    var target = queue.length ? queue[(i + queue.length) % queue.length] : null;
    queue = playable(queue);
    if (!queue.length) { enforce(); return; }
    i = target ? queue.indexOf(target) : 0; if (i < 0) i = 0;
    at = (i + queue.length) % queue.length; current = queue[at]; wantPlay = true;
    var tr = trim(current); cut = tr && tr.cutAt; cutFired = false;
    audio.src = current.url;
    if (tr && tr.from) audio.addEventListener('loadedmetadata', function () { try { if (audio.currentTime < tr.from) audio.currentTime = tr.from; } catch (e) {} }, { once: true });
    audio.play().catch(onFail); paint(); meta();
  }
  audio.addEventListener('timeupdate', function () {
    if (!cut || cutFired || !wantPlay || audio.paused || audio.seeking) return;
    if (audio.currentTime >= cut) { cutFired = true; failures = 0; playAt(at + 1); }
  });
  function onFail(e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'NotAllowedError') { wantPlay = false; paint(); return; } // needs a tap: the button is right there
    if (!wantPlay) return;
    if (++failures > 4) { wantPlay = false; failures = 0; sub.textContent = "Couldn't load music. Tap to try again."; paint(); return; }
    setTimeout(function () { if (wantPlay) playAt(at + 1); }, 1200); // skip a song that won't load
  }
  function start() {
    // Unlock audio inside the tap (phones need that), then fetch the song list if it isn't here yet
    if (!all) { audio.src = SILENT; audio.play().catch(function () {}); }
    sub.textContent = 'Loading the library…';
    loadMarks();
    load().then(function (list) {
      queue = shuffle(playable(list));
      if (!queue.length) { sub.textContent = 'No songs to play with your current song settings.'; return; }
      failures = 0; playAt(0);
    }).catch(function () { sub.textContent = "Couldn't reach the library. Tap to try again."; paint(); });
  }
  btn.addEventListener('click', function () {
    if (!current) return start();
    if (audio.paused) { if (!current || !playable([current]).length) return enforce(); wantPlay = true; audio.play().catch(onFail); } else { wantPlay = false; audio.pause(); }
    paint();
  });
  nextBtn.addEventListener('click', function () { failures = 0; playAt(at + 1); });
  audio.addEventListener('ended', function () { failures = 0; playAt(at + 1); }); // nonstop
  audio.addEventListener('playing', function () { failures = 0; paint(); });
  audio.addEventListener('pause', paint);
  audio.addEventListener('waiting', paint);
  audio.addEventListener('error', function () { if (current && audio.src.indexOf(SILENT) < 0) onFail({ name: 'MediaError' }); });

  // "Open player": hand the song, the shuffled list and the spot to the full player (it picks up on load)
  open.addEventListener('click', function (e) {
    if (!current) return;
    var from = Math.max(0, at - 20), list = queue.slice(from, from + 400);
    try {
      sessionStorage.setItem('jerm747.player.session', JSON.stringify({ v: 1, at: Date.now(), track: current, override: false, queue: list, index: at - from, source: 'ride', upNext: [], pos: Math.round(audio.currentTime * 10) / 10, playing: !audio.paused }));
    } catch (x) {}
    audio.pause();
    e.preventDefault(); location.href = '/ride';
  });

  // Lock screen / headphones
  function meta() {
    if (!('mediaSession' in navigator) || !current || typeof MediaMetadata === 'undefined') return;
    var cover = current.cover || '/covers/cover-art.svg';
    var art = /\.svg(\?|$)/i.test(cover) ? '/covers/cover-art-512.png' : cover;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: (current.artists || []).join(', '), album: current.project || 'Jerm747 · Let It Ride', artwork: [{ src: new URL(art, location.origin).href, sizes: '512x512' }] });
      navigator.mediaSession.setActionHandler('play', function () { if (!current || !playable([current]).length) return enforce(); wantPlay = true; audio.play().catch(onFail); });
      navigator.mediaSession.setActionHandler('pause', function () { wantPlay = false; audio.pause(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { playAt(at + 1); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { if (audio.currentTime > 3) audio.currentTime = 0; else playAt(at - 1); });
    } catch (x) {}
  }

  function enforce() {
    if (current && !playable([current]).length) {
      wantPlay = false; audio.pause(); audio.removeAttribute('src'); audio.load(); current = null; queue = []; at = -1; paint();
      sub.textContent = 'Recording blocked. Open Listening Controls.';
    }
  }
  window.addEventListener('storage', enforce);
  window.addEventListener('focus', function() { load().catch(function() {}); });
  function mount() { document.body.appendChild(bar); document.documentElement.classList.add('has-ride-mini'); paint(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  // Fetch the list quietly once the page has settled, so the first tap starts right away
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 2500); };
  window.addEventListener('load', function () { idle(function () { load().catch(function () {}); loadMarks(); }); });
  window.Jerm747RideMini = { start: start, state: function () { return { current: current && current.id, playing: !audio.paused, queue: queue.length }; } };
})();
