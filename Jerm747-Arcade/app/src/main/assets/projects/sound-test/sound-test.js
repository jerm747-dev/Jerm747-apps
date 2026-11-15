/* Game Music · jerm747.games
   Arcade adaptation of the original Get Down music-panel styling and interactions.
   Tracks come from tracks.json, so adding a song is: drop an mp3 in music/, a cover in covers/, add an entry. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const audio = $('audio'), app = $('app'), list = $('list');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('j747.soundtest.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('j747.soundtest.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const widget = new URLSearchParams(location.search).has('widget');
  const embedded = parent !== window;
  document.documentElement.classList.toggle('widget', widget);
  let active = true;
  let ready = false;
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function notice(message) {
    $('notice').textContent = message;
    $('notice').hidden = !message;
  }
  function report() {
    if (!embedded) return;
    parent.postMessage({ type: 'sound-test-status', title: tracks[cur]?.title || '',
      artist: tracks[cur]?.local ? '' : 'Jerm747', playing: !audio.paused, shuffle, ready }, location.origin);
  }
  function requestClose(destination) {
    if (embedded && widget) parent.postMessage({ type: 'sound-test-close', destination }, location.origin);
    else {
      audio.pause();
      if (embedded) parent.postMessage({type: 'arcade-return'},location.origin);
      else location.href = '/';
    }
  }
  let hostAway = false;
  let pageAway = false;
  function outsideArcade() { return document.hidden || hostAway || pageAway; }
  function setHostAway(away) {
    hostAway = Boolean(away);
    if (outsideArcade()) audio.pause();
  }
  // Used synchronously by the Android activity before its WebView suspends.
  window.GameMusicLifecycle = {setHostAway};
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); });
  window.addEventListener('pagehide', () => { pageAway = true; audio.pause(); });
  window.addEventListener('pageshow', () => { pageAway = false; });

  function playAudio() {
    if (outsideArcade()) return;
    notice('');
    audio.play().catch(error => {
      if (error.name !== 'AbortError') notice('Tap Play to start this track. If it still will not play, try the next track.');
    });
  }
  let tracks = [];
  let order = [];          // play order (indexes into tracks); shuffled when shuffle is on
  let cur = 0;             // index into tracks
  let sel = 0;             // highlighted row (keyboard / controller)
  let songAt = -1;         // track shown on the song page, -1 = closed
  let shuffle = store.get('shuffle', false);
  let repeat = store.get('repeat', 'all'); // all | one | off
  let started = false;

  const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const no = (i) => 'No. ' + String(i + 1).padStart(2, '0');

  // ---------------------------------------------------------------- audio graph (meter)
  let ctx = null, analyser = null, bins = null;
  let dryGain, punchGain;
  let punch = store.get('punch', false) === true;
  const punchButton = $('punch');
  function showPunch() {
    punchButton.setAttribute('aria-pressed', String(punch));
    $('punchState').textContent = punch ? 'On' : 'Off';
  }
  const eqDialog=$('eqDialog');
  const bands=[['Bass','lowshelf',180],['Mid','peaking',1100],['Treble','highshelf',4800]];
  const equalizers=[];
  for(const [name] of bands){
    const slider=$('eq'+name);
    slider.value=Number(store.get('eq'+name,0))||0;
    const apply=()=>{
      const value=Number(slider.value), current=bands.findIndex(b=>b[0]===name);
      slider.nextElementSibling.value=(value>0?'+':'')+value+' dB';
      slider.setAttribute('aria-valuetext',slider.nextElementSibling.value);
      if(equalizers[current]&&ctx)equalizers[current].gain.setTargetAtTime(value,ctx.currentTime,.018);
    };
    apply();slider.oninput=()=>{apply();store.set('eq'+name,Number(slider.value))};
  }
  $('eq').onclick=()=>{ensureAudio();eqDialog.showModal();$('eqBass').focus()};
  $('eqDone').onclick=()=>eqDialog.close();
  function ensureAudio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    let graph;
    try {
      graph = new (window.AudioContext || window.webkitAudioContext)();
      const meterNode = graph.createAnalyser();
      meterNode.fftSize = 256;
      meterNode.smoothingTimeConstant = 0.72;
      const direct = graph.createGain();
      const effect = graph.createGain();
      const body = graph.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 125;
      body.Q.value = 0.85;
      body.gain.value = 2;
      const drive = graph.createWaveShaper();
      // The normalized tanh curve used by Beat Room's tape saturation.
      const amount = 1.8;
      drive.curve = Float32Array.from({length:2048}, (_, i) =>
        Math.tanh(amount * (2 * i / 2047 - 1)) / Math.tanh(amount));
      drive.oversample = '2x';
      direct.gain.value = punch ? 0.42 : 1;
      effect.gain.value = punch ? 0.49 : 0;
      direct.connect(meterNode);
      body.connect(drive).connect(effect).connect(meterNode);
      let stage=meterNode;
      for(const [name,type,freq] of bands){
        const filter=graph.createBiquadFilter();filter.type=type;filter.frequency.value=freq;filter.Q.value=.8;
        filter.gain.value=Number($('eq'+name).value);stage.connect(filter);stage=filter;equalizers.push(filter);
      }
      stage.connect(graph.destination);
      const input = graph.createMediaElementSource(audio);
      input.connect(direct);
      input.connect(body);
      ctx = graph; analyser = meterNode;
      bins = new Uint8Array(analyser.frequencyBinCount);
      dryGain = direct; punchGain = effect;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      graph?.close().catch(() => {});
      equalizers.length=0;$('eq').disabled=true;
      punch = false;
      showPunch();
      punchButton.disabled = true;
      punchButton.title = 'Punch is unavailable on this device';
    }
  }
  function togglePunch() {
    ensureAudio();
    if (!dryGain) return;
    punch = !punch;
    // Crossfade while the same media element continues from its current sample.
    dryGain.gain.setTargetAtTime(punch ? 0.42 : 1, ctx.currentTime, 0.009);
    punchGain.gain.setTargetAtTime(punch ? 0.49 : 0, ctx.currentTime, 0.009);
    store.set('punch', punch);
    showPunch();
  }
  showPunch();
  punchButton.addEventListener('click', togglePunch);

  const meter = $('meter'), g = meter.getContext('2d');
  const levels = new Float32Array(16);
  function drawMeter() {
    requestAnimationFrame(drawMeter);
    if (!active) return;
    const W = meter.width, H = meter.height, cols = 16, cw = W / cols;
    if (analyser && !audio.paused) analyser.getByteFrequencyData(bins);
    g.clearRect(0, 0, W, H);
    const color = tracks[cur]?.color || '#F2B35E';
    for (let c = 0; c < cols; c++) {
      let v = 0;
      if (analyser && !audio.paused) {
        const a = Math.floor(Math.pow(c / cols, 1.6) * 60) + 1, b = Math.floor(Math.pow((c + 1) / cols, 1.6) * 60) + 2;
        for (let i = a; i < b; i++) v = Math.max(v, bins[i]);
        v = v / 255;
      }
      levels[c] = Math.max(v, levels[c] * 0.88);
      const h = Math.round(levels[c] * (H - 2));
      for (let y = 0; y < h; y += 2) {
        g.fillStyle = y > H * 0.72 ? '#f06e5a' : y > H * 0.45 ? '#ffd27a' : color;
        g.fillRect(Math.round(c * cw) + 1, H - 1 - y, Math.max(1, Math.round(cw) - 2), 1);
      }
    }
  }

  const loadDialog = $('loadDialog');
  const picker = $('localFiles');
  const folder = $('localFolder');
  const audioExtension = /\.(mp3|wav|wave|ogg|oga|opus|m4a|aac|flac|aif|aiff|weba|amr)$/i;
  const androidFolder = typeof window.EncoreAndroid?.soundTestFolderPicker === 'function';
  let database;
  let importing = false;

  function musicDatabase() {
    if (!database) {
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open('jerm747.soundtest.device-library', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('songs', {keyPath:'id'});
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); database = null; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Music storage is busy'));
      }).catch(error => { database = null; throw error; });
    }
    return database;
  }
  function importStatus(text) {
    $('importStatus').textContent = text;
    $('importStatus').hidden = !text;
  }
  function deviceTrack(row) {
    return {id:row.id, title:row.name.replace(/\.[^.]+$/, '') || row.name, file:URL.createObjectURL(row.file),
      cover:document.querySelector('.st-banner').src, color:'#86daca', stage:'On this device',
      about:row.name, local:true, sequence:row.sequence, seconds:null};
  }
  async function restoreMusic() {
    try {
      const db = await musicDatabase();
      const rows = await new Promise((resolve,reject) => {
        const r = db.transaction('songs').objectStore('songs').getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      return rows.sort((a,b)=>a.sequence-b.sequence || a.name.localeCompare(b.name)).map(deviceTrack);
    } catch { return []; }
  }
  async function saveSong(row) {
    const db = await musicDatabase();
    return new Promise((resolve,reject) => {
      const tx = db.transaction('songs','readwrite');
      tx.objectStore('songs').put(row);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  }
  async function importMusic(selection) {
    if (importing || !ready || !selection.length) return;
    importing = true;
    $('loadMusic').disabled = true;
    let added = 0, skipped = 0, repeats = 0, sessionOnly = 0;
    const known = new Set(tracks.map(t=>t.id));
    const timestamp = Date.now();
    try {
      importStatus('Loading music…');
      for (const [index,file] of selection.entries()) {
        if (!file.size || !(file.type.startsWith('audio/') || audioExtension.test(file.name))) { skipped++; continue; }
        // File names are not unique. Compare the actual audio bytes across file and folder imports.
        let id;
        try {
          const bytes = await file.arrayBuffer();
          const hash = await crypto.subtle.digest('SHA-256',bytes);
          id = 'device-' + Array.from(new Uint8Array(hash), b=>b.toString(16).padStart(2,'0')).join('');
        } catch {
          // HTTP development origins may lack Web Crypto. Keep a stable file fingerprint there.
          id = 'device-file-' + JSON.stringify([file.name,file.size,file.lastModified]);
        }
        if (known.has(id)) { repeats++; continue; }
        const row = {id, name:file.name, file, sequence:timestamp + index/Math.max(1,selection.length)};
        const track = deviceTrack(row);
        try { await saveSong(row); } catch { sessionOnly++; }
        known.add(id);
        tracks.push(track);
        added++;
      }
      if (added) {
        renderList();
        buildOrder();
        markSel();
      }
      const parts = [];
      if (added) parts.push('Added ' + added + (added === 1 ? ' song.' : ' songs.'));
      if (repeats) parts.push(repeats + ' already in Game Music.');
      if (skipped) parts.push('Skipped ' + skipped + (skipped === 1 ? ' non-audio or empty file.' : ' non-audio or empty files.'));
      if (sessionOnly) parts.push(sessionOnly + ' available for this session only. Device storage could not save them.');
      importStatus(parts.join(' '));
    } finally {
      importing = false;
      $('loadMusic').disabled = false;
    }
  }
  $('loadMusic').onclick = () => { loadDialog.showModal(); $('chooseFiles').focus(); };
  $('loadClose').onclick = () => loadDialog.close();
  $('chooseFolder').hidden = !androidFolder && !('webkitdirectory' in folder);
  $('chooseFiles').onclick = () => { loadDialog.close(); picker.click(); };
  $('chooseFolder').onclick = () => {
    loadDialog.close();
    if (androidFolder) {
      // The native chooser returns audio document URIs to a normal multi-file input.
      // A directory-input callback expects a filesystem directory, not a provider URI.
      picker.dataset.pickFolder = 'true';
      picker.click();
    } else folder.click();
  };
  for (const input of [picker,folder]) {
    input.addEventListener('change', () => {
      const selected = Array.from(input.files || []);
      input.value = '';
      delete picker.dataset.pickFolder;
      importMusic(selected).catch(() => importStatus('Could not read the selected music. Please choose the files again.'));
    });
    input.addEventListener('cancel', () => { delete picker.dataset.pickFolder; });
  }
  loadDialog.addEventListener('close',()=>{ if (active) $('loadMusic').focus({preventScroll:true}); });

  // ---------------------------------------------------------------- list + song page
  function renderList() {
    list.innerHTML = '';
    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'st-row';
      li.style.setProperty('--pick', t.color);
      const safe = {title:escapeText(t.title), cover:escapeText(t.cover), stage:escapeText(t.stage), key:escapeText(t.key)};
      li.innerHTML = `
        <button type="button" class="st-row-play" aria-label="Play ${safe.title}">
          <img src="${safe.cover}" alt="" width="60" height="60" loading="lazy" />
          <span class="st-row-text">
            <span class="st-row-no">${no(i)}</span>
            <span class="st-row-title">${safe.title}</span>
            <span class="st-row-meta">${[safe.stage,safe.key].filter(Boolean).join(' · ')}</span>
          </span>
          <span class="st-row-len"><span class="st-bars" aria-hidden="true"><i></i><i></i><i></i></span><span data-len>${t.seconds ? fmt(t.seconds) : '—'}</span></span>
        </button>
        <button type="button" class="st-row-info" aria-label="About ${safe.title}">i</button>`;
      li.querySelector('.st-row-play').addEventListener('click', () => { sel = i; if (i === cur && started) toggle(); else playIndex(i); });
      li.querySelector('.st-row-info').addEventListener('click', () => { sel = i; openSong(i); });
      li.querySelector('.st-row-play').addEventListener('focus', () => { sel = i; markSel(); });
      list.appendChild(li);
    });
    $('count').textContent = tracks.length + (tracks.length === 1 ? ' track' : ' tracks');
  }

  function markSel() {
    [...list.children].forEach((li, i) => {
      li.classList.toggle('is-on', i === cur);
      li.classList.toggle('is-sel', i === sel && document.documentElement.classList.contains('using-gamepad'));
    });
  }

  function openSong(i) {
    if (!tracks[i]) return;
    songAt = i;
    $('playerMain').hidden = true;
    document.querySelector('.st-banner').hidden = true;
    const t = tracks[i];
    $('songArt').src = t.cover;
    $('songNo').textContent = no(i) + ' · ' + t.stage;
    $('songTitle').textContent = t.title;
    $('songMood').textContent = t.mood || '';
    $('songAbout').textContent = t.about || '';
    const facts = [['Album', t.album], ['Key', t.key], ['Tempo', t.bpm ? t.bpm + ' BPM' : ''], ['Length', t.seconds ? fmt(t.seconds) : ''], ['Sound', t.voices]];
    $('songFacts').innerHTML = facts.filter(f => f[1]).map(([k, v]) => `<dt>${escapeText(k)}</dt><dd>${escapeText(v)}</dd>`).join('');
    $('songPlay').textContent = i === cur && !audio.paused ? 'Pause' : 'Play';
    $('songPrev').disabled = i <= 0;
    $('songNext').disabled = i >= tracks.length - 1;
    $('song').style.setProperty('--accent', t.color);
    $('song').hidden = false;
    requestAnimationFrame(() => $('songPlay').focus({ preventScroll: true }));
  }
  function closeSong() {
    if (songAt < 0) return;
    $('song').hidden = true;
    $('playerMain').hidden = false;
    document.querySelector('.st-banner').hidden = false;
    const i = songAt;
    songAt = -1;
    list.children[i]?.querySelector('.st-row-play')?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- playback
  function buildOrder() {
    order = tracks.map((_, i) => i);
    if (shuffle) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const at = order.indexOf(cur); // keep the playing song first
      if (at > 0) { order.splice(at, 1); order.unshift(cur); }
    }
  }

  function load(i) {
    if (!tracks.length || !Number.isInteger(i)) return;
    cur = (i + tracks.length) % tracks.length;
    const t = tracks[cur];
    audio.src = t.file;
    $('art').src = t.cover;
    $('art').alt = t.local ? '' : 'Game Music cover';
    $('nowNo').textContent = 'Now playing · ' + t.stage;
    $('nowTitle').textContent = t.title;
    $('nowMeta').textContent = [t.key, t.bpm && t.bpm + ' BPM'].filter(Boolean).join(' · ');
    document.documentElement.style.setProperty('--accent', t.color);
    $('tDur').textContent = fmt(t.seconds);
    setSeek(0, t.seconds);
    store.set('track', t.id);
    markSel();
    report();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title, artist: t.local ? '' : 'Jerm747', album: 'jerm747.games Game Music',
          artwork: [{ src: new URL(t.cover, document.baseURI).href }],
        });
      } catch { /* older browsers */ }
    }
  }

  function playIndex(i) {
    if (!ready || !tracks[i]) return;
    ensureAudio();
    started = true;
    load(i);
    sel = cur;
    markSel();
    playAudio();
    if (songAt >= 0) openSong(songAt);
  }
  function toggle() {
    if (!ready) return;
    ensureAudio();
    if (!started) { playIndex(cur); return; }
    if (audio.paused) playAudio(); else audio.pause();
  }
  function step(dir) {
    if (!tracks.length) return;
    if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const at = order.indexOf(cur);
    playIndex(order[(at + dir + order.length) % order.length]);
  }
  function seekBy(s) { if (started && isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.2, audio.currentTime + s)); }

  audio.addEventListener('ended', () => {
    if (outsideArcade()) return;
    if (repeat === 'one') { audio.currentTime = 0; playAudio(); return; }
    const at = order.indexOf(cur);
    if (at === order.length - 1) {
      if (repeat === 'off') { audio.pause(); syncPlaying(); return; }
      if (shuffle) { buildOrder(); step(1); return; }
    }
    step(1);
  });
  audio.addEventListener('play', () => { if (outsideArcade()) audio.pause(); syncPlaying(); });
  audio.addEventListener('pause', syncPlaying);
  audio.addEventListener('loadedmetadata', () => {
    if (tracks[cur]?.local && Number.isFinite(audio.duration)) tracks[cur].seconds = audio.duration;
    $('tDur').textContent = fmt(audio.duration);
    const len = list.children[cur]?.querySelector('[data-len]');
    if (len) len.textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => { if (!dragging) setSeek(audio.currentTime, audio.duration); });

  function syncPlaying() {
    const on = !audio.paused;
    report();
    app.classList.toggle('is-playing', on);
    $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (songAt >= 0) $('songPlay').textContent = songAt === cur && on ? 'Pause' : 'Play';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
  }

  // seek + volume
  const seek = $('seek'), vol = $('vol');
  let dragging = false;
  function setSeek(t, d) {
    d = isFinite(d) && d > 0 ? d : 1;
    seek.max = d;
    seek.value = t;
    seek.style.setProperty('--pct', (t / d) * 100 + '%');
    $('tCur').textContent = fmt(t);
  }
  seek.addEventListener('input', () => { dragging = true; setSeek(Number(seek.value), Number(seek.max)); });
  seek.addEventListener('change', () => { dragging = false; if (started) audio.currentTime = Number(seek.value); });
  function setVol(v, save = true) {
    v = Math.max(0,Math.min(1,Number.isFinite(Number(v)) ? Number(v) : .8));
    audio.volume = v;
    vol.value = v;
    vol.style.setProperty('--pct', v * 100 + '%');
    if (save) store.set('vol', v);
  }
  vol.addEventListener('input', () => { setVol(Number(vol.value)); if (audio.muted) toggleMute(); });
  function toggleMute() {
    audio.muted = !audio.muted;
    $('mute').setAttribute('aria-pressed', audio.muted);
    $('mute').setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
  }

  function setShuffle(on) {
    shuffle = on;
    store.set('shuffle', on);
    $('shuffle').setAttribute('aria-pressed', on);
    buildOrder();
    report();
  }
  function cycleRepeat() {
    repeat = repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all';
    store.set('repeat', repeat);
    paintRepeat();
  }
  function paintRepeat() {
    const b = $('repeat');
    b.classList.toggle('is-on', repeat !== 'off');
    b.classList.toggle('is-one', repeat === 'one');
    b.setAttribute('aria-label', 'Repeat: ' + repeat);
  }

  $('play').addEventListener('click', toggle);
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('shuffle').addEventListener('click', () => setShuffle(!shuffle));
  $('repeat').addEventListener('click', cycleRepeat);
  $('mute').addEventListener('click', toggleMute);
  $('songBack').addEventListener('click', closeSong);
  $('songPrev').addEventListener('click', () => songAt > 0 && openSong(songAt - 1));
  $('songNext').addEventListener('click', () => songAt < tracks.length - 1 && openSong(songAt + 1));
  $('songPlay').addEventListener('click', () => { if (songAt === cur && started) toggle(); else playIndex(songAt); });
  $('back').addEventListener('click', () => requestClose('shelf'));
  $('resumeGame').addEventListener('click', () => requestClose('game'));
  $('nowTitle').addEventListener('click', () => openSong(cur));

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => { ensureAudio(); if (audio.paused) { started = true; playAudio(); } });
      ms.setActionHandler('pause', () => audio.pause());
      ms.setActionHandler('previoustrack', () => step(-1));
      ms.setActionHandler('nexttrack', () => step(1));
      ms.setActionHandler('seekto', (e) => { audio.currentTime = e.seekTime; });
    } catch { /* not all actions supported */ }
  }

  // ---------------------------------------------------------------- splash
  const splash = $('splash');
  function start() {
    if (!ready || !splash.isConnected || splash.classList.contains('is-leaving')) return;
    splash.classList.add('is-leaving');
    app.hidden = false;
    setTimeout(() => splash.remove(), 360);
    playIndex(cur);
    requestAnimationFrame(() => list.children[cur]?.querySelector('.st-row-play')?.focus({ preventScroll: true }));
  }
  $('start').addEventListener('click', start);
  if (widget) { splash.remove(); app.hidden = false; }

  // ---------------------------------------------------------------- keyboard
  addEventListener('keydown', (e) => {
    if (!ready || !active || loadDialog.open || eqDialog.open) return;
    if (splash.isConnected) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); } return; }
    if (e.target.closest?.('input[type=range]') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const k = e.key;
    if (widget && k === 'Tab' && songAt < 0) {
      const items = [...app.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el => el.offsetWidth && el.offsetHeight);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return; }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); return; }
    }
    if (k === 'Escape') { e.preventDefault(); songAt >= 0 ? closeSong() : requestClose(); return; }
    if (k === 'Tab' && songAt >= 0) {
      const items = [...$('song').querySelectorAll('button:not(:disabled)')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (k === ' ' || k === 'k' || k === 'K') { if (e.target.tagName === 'BUTTON' && k === ' ') return; e.preventDefault(); toggle(); }
    else if (k === 'ArrowRight' && e.shiftKey) { e.preventDefault(); seekBy(10); }
    else if (k === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); seekBy(-10); }
    else if (k === 'ArrowRight' || k === 'n' || k === 'N') { e.preventDefault(); songAt >= 0 ? (songAt < tracks.length - 1 && openSong(songAt + 1)) : step(1); }
    else if (k === 'ArrowLeft' || k === 'p' || k === 'P') { e.preventDefault(); songAt >= 0 ? (songAt > 0 && openSong(songAt - 1)) : step(-1); }
    else if ((k === 'ArrowDown' || k === 'ArrowUp') && songAt < 0) { e.preventDefault(); moveSel(k === 'ArrowDown' ? 1 : -1); }
    else if (k === 's' || k === 'S') setShuffle(!shuffle);
    else if (k === 'r' || k === 'R') cycleRepeat();
    else if (k === 'm' || k === 'M') toggleMute();
    else if (k.toLowerCase() === 'd' && !e.repeat) togglePunch();
    else if (k === 'i' || k === 'I') songAt >= 0 ? closeSong() : openSong(sel);
  });
  function moveSel(d) {
    sel = Math.max(0, Math.min(tracks.length - 1, sel + d));
    list.children[sel]?.querySelector('.st-row-play')?.focus();
    markSel();
  }

  // ---------------------------------------------------------------- controller (shared cabinet input)
  window.Jerm747Pad?.listen((action) => {
    if (!ready || !active) return;
    if(eqDialog.open){
      if(action==='back'){eqDialog.close();return}
      const controls=[...eqDialog.querySelectorAll('input'),$('eqDone')],current=document.activeElement;
      if(current?.type==='range'&&['left','right'].includes(action)){
        action==='left'?current.stepDown():current.stepUp();current.dispatchEvent(new Event('input'));return;
      }
      if(action==='up'||action==='down'){controls[(controls.indexOf(current)+(action==='up'?-1:1)+controls.length)%controls.length].focus();return}
      if(action==='accept'&&current===$('eqDone'))eqDialog.close();
      return;
    }
    if (loadDialog.open) {
      if (action === 'back') loadDialog.close();
      else window.Jerm747Pad.menu(window.Jerm747Pad.controls(loadDialog),action);
      return;
    }
    if (splash.isConnected) { start(); return; }
    if (songAt >= 0) {
      if (action === 'back') closeSong();
      else if (action === 'left' || action === 'previous') { if (songAt > 0) openSong(songAt - 1); }
      else if (action === 'right' || action === 'next') { if (songAt < tracks.length - 1) openSong(songAt + 1); }
      else if (action === 'accept' || action === 'alternate') $('songPlay').click();
      else if (action === 'tools') closeSong();
      return;
    }
    if (action === 'back') { requestClose(); return; }
    if(document.activeElement===$('eq')){
      if(action==='accept')$('eq').click();else if(action==='right')punchButton.focus();else if(action==='down')$('loadMusic').focus();return;
    }
    if (document.activeElement === punchButton) {
      if(action==='left'||action==='up'){$('eq').focus();return}
      if (action === 'accept') { togglePunch(); return; }
      if (action === 'down') { $('loadMusic').focus(); return; }
    }
    if (document.activeElement === $('loadMusic')) {
      if (action === 'up' && !punchButton.disabled) { punchButton.focus(); return; }
      if (action === 'accept') { $('loadMusic').click(); return; }
      if (action === 'down') { sel = 0; moveSel(0); return; }
    }
    if (action === 'up' && sel === 0) { $('loadMusic').focus(); return; }
    if (action === 'up') moveSel(-1);
    else if (action === 'down') moveSel(1);
    else if (action === 'accept') { if (sel === cur && started) toggle(); else playIndex(sel); }
    else if (action === 'alternate') toggle();
    else if (action === 'tools') openSong(sel);
    else if (action === 'previous') step(-1);
    else if (action === 'next') step(1);
    else if (action === 'left') seekBy(-10);
    else if (action === 'right') seekBy(10);
    markSel();
  });

  audio.addEventListener('error', () => notice('This track could not load. Try another track or refresh the player.'));
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || !embedded) return;
    if (event.data?.type === 'sound-test-visibility') {
      active = !!event.data.visible;
      $('resumeGame').hidden = !event.data.inGame;
      if (active) window.dispatchEvent(new Event('arcade-visor-resume'));
      if (active) requestAnimationFrame(() => (songAt >= 0 ? $('songPlay') : $('play')).focus());
    }
    if (event.data?.type === 'sound-test-action' && ready) {
      const actions = { toggle, play: () => { ensureAudio(); started = true; playAudio(); },
        pause: () => audio.pause(), next: () => step(1), previous: () => step(-1), shuffle: () => setShuffle(!shuffle) };
      if (Object.hasOwn(actions,event.data.action)) actions[event.data.action]();
    }
    if (event.data?.type === 'sound-test-request') report();
  });

  // ---------------------------------------------------------------- boot
  fetch('tracks.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('Track list unavailable'); return r.json(); })
    .then(async (d) => {
      tracks = (d.tracks || []).filter((t) => t.file).concat(await restoreMusic());
      if (!tracks.length) throw new Error('no tracks');
      ready = true;
      const startButton = $('start');
      if (startButton) { startButton.disabled = false; startButton.textContent = 'Start listening'; }
      const last = tracks.findIndex((t) => t.id === store.get('track', ''));
      cur = sel = Math.max(0, last);
      renderList();
      buildOrder();
      $('shuffle').setAttribute('aria-pressed', shuffle);
      paintRepeat();
      setVol(store.get('vol', 0.8), false);
      load(cur);
      const hint = $('hint');
      hint.innerHTML = '<kbd>Space</kbd> play · <kbd>←</kbd><kbd>→</kbd> track · <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> seek · <kbd>S</kbd> shuffle · <kbd>R</kbd> repeat · <kbd>I</kbd> about';
      report();
      if (widget && embedded) parent.postMessage({type:'sound-test-ready'},location.origin);
      drawMeter();
    })
    .catch(() => {
      ready = false;
      const startButton = $('start');
      if (startButton) startButton.textContent = 'Music did not load. Refresh to try again.';
      notice('Music did not load. Refresh to try again.');
      report();
    });
})();
