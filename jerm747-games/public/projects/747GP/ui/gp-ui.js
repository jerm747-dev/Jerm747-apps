// 747 GP shared UI: flag loader + menu focus helper. No dependencies.
window.GPUI = (() => {
  // ---------- waving chequered flag (canvas 2D, pinned at the left like a flag on a pole) ----------
  function flag(canvas) {
    const g = canvas.getContext('2d');
    let raf = 0, t0 = performance.now(), on = false;
    function size() {
      const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function draw(now) {
      if (!on) return;
      size();
      const W = canvas.width, H = canvas.height, t = (now - t0) / 1000;
      g.clearRect(0, 0, W, H);
      const cols = 18, rows = 7, cw = W / cols, ch = H * 0.78 / rows, top = H * 0.1;
      const A = H * 0.075, k = 2 * Math.PI / (W * 0.62), w = 3.1;
      const yOff = x => A * Math.sin(x * k - t * w) * (0.15 + 0.85 * x / W) + A * 0.35 * Math.sin(x * k * 2.3 - t * w * 1.7) * (x / W);
      const shade = x => 0.72 + 0.28 * Math.cos(x * k - t * w - 0.6);
      for (let c = 0; c < cols; c++) {
        const x0 = c * cw, x1 = x0 + cw + 0.6, y0o = yOff(x0), y1o = yOff(x1), s = shade(x0 + cw / 2);
        for (let r = 0; r < rows; r++) {
          const dark = (c + r) & 1, base = dark ? 22 : 236, v = Math.round(base * s + (dark ? 0 : 6));
          g.fillStyle = dark ? `rgb(${v},${v},${v + 2})` : `rgb(${v},${v - 4},${v - 14})`;
          const ya = top + r * ch, yb = ya + ch + 0.6;
          g.beginPath(); g.moveTo(x0, ya + y0o); g.lineTo(x1, ya + y1o); g.lineTo(x1, yb + y1o); g.lineTo(x0, yb + y0o); g.closePath(); g.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    return {
      start() { if (on) return; on = true; raf = requestAnimationFrame(draw); },
      stop() { on = false; cancelAnimationFrame(raf); }
    };
  }

  // ---------- loader: <div class="gp-loader"> built here so every page looks the same ----------
  const TIPS = [
    'Manual gearbox: Q / E, LB / RB or the – / + paddles.',
    'Brake in a straight line, then turn in. The car rotates better off the brakes.',
    'Arcade races run three laps. Your best lap goes on the board.',
    'C or View changes the camera. The right stick looks around.',
    'Grass costs half your grip. Kerbs are fine.',
    'P, Esc or Start pauses the race.'
  ];
  function loader(opts = {}) {
    let el = opts.el || document.getElementById(opts.id || 'gpLoad');
    if (!el) { el = document.createElement('div'); el.id = opts.id || 'gpLoad'; document.body.appendChild(el); }
    el.classList.add('gp-loader');
    const base = opts.base || 'ui/';
    el.innerHTML =
      '<div class="gp-lmid"><canvas aria-hidden="true"></canvas><img class="gp-logo" src="' + (opts.logo || 'intro/747-gp-mark.png') + '" alt="747 GP"></div>' +
      '<div class="gp-lbot"><div class="gp-lrow"><span class="gp-spin" aria-hidden="true"><i></i><i></i><i></i></span><span class="gp-lword">LOADING</span></div>' +
      '<div class="gp-lname"></div><div class="gp-ltip"></div></div>';
    el.setAttribute('role', 'status');
    const f = flag(el.querySelector('canvas'));
    const tip = el.querySelector('.gp-ltip');
    let ti = Math.floor(Math.random() * TIPS.length), tipTimer = 0;
    function nextTip() { tip.style.opacity = 0; setTimeout(() => { tip.textContent = TIPS[ti++ % TIPS.length]; tip.style.opacity = 1; }, 380); }
    const api = {
      el,
      show(name, word) {
        if (name !== undefined) el.querySelector('.gp-lname').textContent = name;
        el.querySelector('.gp-lword').textContent = word || 'LOADING';
        if (!el.classList.contains('on')) { el.classList.add('on'); f.start(); tip.textContent = TIPS[ti++ % TIPS.length]; clearInterval(tipTimer); tipTimer = setInterval(nextTip, 3600); }
      },
      hide() { el.classList.remove('on'); clearInterval(tipTimer); setTimeout(() => { if (!el.classList.contains('on')) f.stop(); }, 600); },
      get visible() { return el.classList.contains('on'); }
    };
    if (opts.show) api.show(opts.name);
    return api;
  }

  // ---------- vertical menu: arrows / D-pad move focus, Enter / A activate, Esc / B back ----------
  // items: () => array of elements (evaluated each time so hidden rows drop out)
  function menu(items, o = {}) {
    let i = 0, active = true;
    const list = () => items().filter(e => e && !e.disabled && e.offsetParent !== null);
    function mark(n) {
      const L = list(); if (!L.length) return;
      i = (n + L.length) % L.length;
      L.forEach((e, k) => e.classList.toggle('is-focused', k === i));
      L[i].focus({preventScroll: true});
      L[i].scrollIntoView?.({block: 'nearest'});
    }
    function cur() { const L = list(); const k = L.indexOf(document.activeElement); if (k >= 0) i = k; return L[i]; }
    function act(a) {
      if (!active) return;
      const L = list(); if (!L.length) return;
      const e = cur();
      if (a === 'up') mark(i - 1);
      else if (a === 'down') mark(i + 1);
      else if (a === 'left' || a === 'right') { if (e && e.gpStep) e.gpStep(a === 'left' ? -1 : 1); else if (o.onSide) o.onSide(a, e); }
      else if (a === 'confirm') e && e.click();
      else if (a === 'back') o.onBack && o.onBack();
      else if (o.onOther) o.onOther(a, e);
    }
    const keys = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back'};
    addEventListener('keydown', e => {
      if (!active || e.altKey || e.ctrlKey || e.metaKey) return;
      const a = keys[e.key]; if (!a || (o.noBack && a === 'back')) return;
      if (a === 'confirm' && document.activeElement && document.activeElement.matches('button,a') && !list().includes(document.activeElement)) return;
      e.preventDefault(); if (!e.repeat || a !== 'confirm') act(a);
    });
    addEventListener('pointerover', e => { const L = list(), k = L.indexOf(e.target.closest('.gp-button,.gp-chip')); if (k >= 0) { L.forEach(x => x.classList.remove('is-focused')); i = k; } });
    if (o.pad !== false && window.watchMenuPad) watchMenuPad(a => act(a));
    return {
      focus: mark, act,
      set active(v) { active = v; if (!v) list().forEach(e => e.classList.remove('is-focused')); },
      get active() { return active; }
    };
  }

  // stepper row: <button class="gp-button gp-custom gp-step"> with .gp-val
  function stepper(btn, values, idx, render, onChange) {
    btn.gpStep = d => { idx = Math.max(0, Math.min(values.length - 1, idx + d)); upd(); onChange && onChange(values[idx], idx); };
    // tap / Enter / A cycles forward and wraps; left / right step without wrapping
    btn.addEventListener('click', () => { idx = (idx + 1) % values.length; upd(); onChange && onChange(values[idx], idx); });
    function upd() { btn.querySelector('.gp-val').textContent = render(values[idx], idx); }
    upd();
    return {get value() { return values[idx]; }, set(i) { idx = i; upd(); }};
  }

  return {flag, loader, menu, stepper, TIPS};
})();
