/* GS Fighter III — Fight HUD Kit 1.0.0. No dependencies or network requests. */
(function (global) {
  'use strict';
  var script = document.currentScript;
  var defaultAssets = new URL('../assets/', script ? script.src : document.baseURI).href;

  function create(options) {
    options = options || {};
    var stage = options.stage;
    if (!(stage instanceof HTMLElement)) throw new TypeError('Pass the gameplay stage as options.stage.');
    var assets = new URL(options.assetsBase || defaultAssets, document.baseURI).href.replace(/\/?$/, '/');
    var previousPosition = stage.style.position;
    var adjustedPosition = getComputedStyle(stage).position === 'static';
    if (adjustedPosition) stage.style.position = 'relative';
    var overlay = document.createElement('div');
    overlay.className = 'gsfh-announcer';
    overlay.hidden = true;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    var frame = document.createElement('div');
    frame.className = 'gsfh-announcer-frame';
    var art = document.createElement('img');
    art.className = 'gsfh-announcement-art';
    art.alt = '';
    art.width = 1774;
    art.height = 887;
    art.draggable = false;
    var fallback = document.createElement('span');
    fallback.className = 'gsfh-fallback';
    fallback.hidden = true;
    frame.append(art, fallback);
    overlay.append(frame);
    stage.append(overlay);

    var clock = document.createElement('span');
    clock.className = 'gsfh-clock';
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'off');
    var digits = [document.createElement('img'), document.createElement('img')];
    digits.forEach(function (img) {
      img.alt = ''; img.width = 164; img.height = 170; img.draggable = false;
      clock.append(img);
    });
    if (options.timerHost) options.timerHost.append(clock);
    var roundLabel = document.createElement('span');
    roundLabel.className = 'gsfh-round-label';
    if (options.roundHost) options.roundHost.append(roundLabel);

    var destroyed = false, sequence = 0, pending = null, animation = null, displayedTime = null;
    var urgentAt = Number.isFinite(options.urgentAt) ? options.urgentAt : 10;
    var loaded = {};
    var files = ['fight.png', 'round-1.png', 'round-2.png'];
    for (var d = 0; d < 10; d++) files.push('timer/' + d + '.svg', 'timer/' + d + '-urgent.svg');
    var ready = Promise.all(files.map(function (file) {
      return new Promise(function (resolve) {
        var image = new Image();
        image.onload = function () { loaded[file] = true; resolve(file); };
        image.onerror = function () { loaded[file] = false; resolve(file); };
        image.src = assets + file;
      });
    })).then(function () {
      return { missing: files.filter(function (file) { return !loaded[file]; }) };
    });

    function alive() { if (destroyed) throw new Error('This HUD instance was destroyed.'); }
    function roundNumber(n) {
      if (n !== 1 && n !== 2) throw new RangeError('This artwork kit contains rounds 1 and 2 only.');
      return n;
    }
    function hide() {
      if (pending) { var p = pending; pending = null; clearTimeout(p.id); p.resolve(false); }
      if (animation) { animation.cancel(); animation = null; }
      overlay.hidden = true;
    }
    function cancel() { sequence++; hide(); }
    function wait(ms) {
      return new Promise(function (resolve) {
        pending = { resolve: resolve, id: setTimeout(function () { pending = null; resolve(true); }, ms) };
      });
    }
    function duration(ms, defaultMs) {
      return Number.isFinite(ms) ? Math.max(200, ms) : defaultMs;
    }
    async function display(file, label, ms, token) {
      await ready;
      if (destroyed || token !== sequence) return false;
      art.src = assets + file;
      art.hidden = !loaded[file];
      fallback.hidden = !!loaded[file];
      fallback.textContent = label;
      overlay.setAttribute('aria-label', label);
      overlay.hidden = false;
      var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var frames = reduced ? [
        { opacity: 0, offset: 0 }, { opacity: 1, offset: .12 },
        { opacity: 1, offset: .78 }, { opacity: 0, offset: 1 }
      ] : [
        { opacity: 0, transform: 'scale(1.14) translateY(-3px)', offset: 0 },
        { opacity: 1, transform: 'scale(.98)', offset: .16 },
        { opacity: 1, transform: 'scale(1)', offset: .29 },
        { opacity: 1, transform: 'scale(1)', offset: .75 },
        { opacity: 0, transform: 'scale(1.04)', offset: 1 }
      ];
      if (frame.animate) animation = frame.animate(frames, { duration: ms, easing: 'ease-out', fill: 'both' });
      var finished = await wait(ms);
      if (token === sequence) {
        overlay.hidden = true;
        if (animation) { animation.cancel(); animation = null; }
      }
      return finished && token === sequence && !destroyed;
    }
    function setTime(seconds) {
      alive();
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) throw new TypeError('Time must be a finite number.');
      var value = Math.min(99, Math.max(0, Math.ceil(seconds)));
      if (value === displayedTime) return;
      displayedTime = value;
      var text = String(value).padStart(2, '0'), urgent = value <= urgentAt;
      digits.forEach(function (img, index) { img.src = assets + 'timer/' + text[index] + (urgent ? '-urgent' : '') + '.svg'; });
      clock.dataset.seconds = String(value);
      clock.classList.toggle('is-urgent', urgent);
      clock.setAttribute('aria-label', value + (value === 1 ? ' second remaining' : ' seconds remaining'));
    }
    function setRound(n) {
      alive(); roundNumber(n); roundLabel.textContent = 'ROUND ' + n;
    }
    function showRound(n, ms) {
      alive(); roundNumber(n); cancel(); setRound(n);
      return display('round-' + n + '.png', 'ROUND ' + n, duration(ms, 1100), sequence);
    }
    function showFight(ms) {
      alive(); cancel();
      return display('fight.png', 'FIGHT!', duration(ms, 800), sequence);
    }
    async function playIntro(n, timings) {
      alive(); roundNumber(n); cancel(); setRound(n);
      timings = timings || {};
      var token = sequence;
      if (!await display('round-' + n + '.png', 'ROUND ' + n, duration(timings.roundMs, 1100), token)) return false;
      if (!await wait(Number.isFinite(timings.gapMs) ? Math.max(0, timings.gapMs) : 120)) return false;
      if (destroyed || token !== sequence) return false;
      return display('fight.png', 'FIGHT!', duration(timings.fightMs, 800), token);
    }
    function destroy() {
      if (destroyed) return;
      cancel(); destroyed = true;
      overlay.remove(); clock.remove(); roundLabel.remove();
      if (adjustedPosition && stage.style.position === 'relative') stage.style.position = previousPosition;
    }
    setTime(99); setRound(1);
    return Object.freeze({ ready: ready, showRound: showRound, showFight: showFight, playIntro: playIntro,
      setTime: setTime, setRound: setRound, cancel: cancel, destroy: destroy,
      elements: Object.freeze({ overlay: overlay, clock: clock, round: roundLabel }) });
  }
  global.GSFightHUD = Object.freeze({ version: '1.0.0', create: create });
})(window);
