/* Plugin Twist selection + swap effect ("showpiece").
   - Selection: one glowing rounded outline around the chosen tokens. A pair becomes a capsule, a twist
     becomes a rounded L. It breathes (pulse) and pops in when the selection changes.
   - Swap: tokens travel on a short arc (one passes over, one under), land with a spring overshoot and a
     small squash. Twists orbit the corner the same way.
   Used by index.html (the game) and swap-lab.html (the workshop). Settings: PTSwapFX.DEFAULTS, overridden
   per device by the lab ("Use in the game on this device") through localStorage. */
(function (root) {
  'use strict';
  const STORE = 'plugin-twist-swap-fx-v1';
  const DEFAULTS = {
    style: 'capsule',      // capsule | rings | halo
    color: '#d6b4ff',      // ring color
    color2: '#ffc061',     // second gradient color
    ring: 2.5,             // ring thickness, px
    pad: 1.16,             // outline size relative to the token
    glow: 10,              // glow radius at the top of the pulse, px
    pulse: 1.5,            // seconds per breath
    pulseDepth: 0.55,      // 0 = steady, 1 = deep pulse
    duration: 460,         // swap time, ms
    arc: 0.32,             // how far the tokens curve apart (× token size)
    lift: 0.1,             // the passing token grows by this much
    bounce: 0.55,          // 0 = no overshoot, 1 = springy
    squash: 0.1,           // landing squash
    missBounce: 0.25,      // bounce when a non-matching swap returns
  };
  const PRESETS = {
    Showpiece: {},
    Subtle: { style: 'capsule', ring: 2, glow: 5, pulseDepth: 0.3, arc: 0.18, lift: 0.05, bounce: 0.25, squash: 0.04, duration: 380 },
    Punchy: { ring: 3, glow: 16, pulse: 1.1, pulseDepth: 0.8, arc: 0.45, lift: 0.16, bounce: 0.8, squash: 0.16, duration: 520 },
    'Gold rings': { style: 'rings', color: '#ffd27a', color2: '#ff9e5e', ring: 2.5, glow: 9 },
    'Soft halo': { style: 'halo', glow: 14, pulseDepth: 0.5 },
  };
  const load = () => { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORE)) || {}) }; } catch { return { ...DEFAULTS }; } };

  const css = `
.ptfx-layer{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:visible}
.ptfx-sel{transform-box:fill-box;transform-origin:center;animation:ptfxBreathe var(--ptfx-pulse,1.5s) ease-in-out infinite}
.ptfx-sel.ptfx-in{animation:ptfxIn .26s cubic-bezier(.3,1.6,.5,1) both,ptfxBreathe var(--ptfx-pulse,1.5s) ease-in-out .26s infinite}
.ptfx-layer.ptfx-hide .ptfx-sel{opacity:0;animation:none;transition:opacity .08s}
@keyframes ptfxBreathe{0%,100%{opacity:var(--ptfx-lo,.55);filter:drop-shadow(0 0 calc(var(--ptfx-glow,10px)*.35) var(--ptfx-c))}50%{opacity:1;filter:drop-shadow(0 0 var(--ptfx-glow,10px) var(--ptfx-c)) drop-shadow(0 0 calc(var(--ptfx-glow,10px)*.4) var(--ptfx-c))}}
@keyframes ptfxIn{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.ptfx-board .cell.selected{background:transparent!important;box-shadow:none!important}
.ptfx-board .cell.anchor:after{content:none!important}
.ptfx-ghost{position:absolute;left:0;top:0;will-change:transform;pointer-events:none;z-index:9}
.ptfx-ghost .bubble{width:100%;height:100%}
.ptfx-board .cell.ptfx-moving .bubble{visibility:hidden}
@media (prefers-reduced-motion:reduce){.ptfx-sel{animation:none!important;opacity:1}}`;
  function injectCSS() {
    if (document.getElementById('ptfx-css')) return;
    const s = document.createElement('style'); s.id = 'ptfx-css'; s.textContent = css; document.head.append(s);
  }

  let uid = 0;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // Damped spring 0→1 over t∈[0,1]. bounce 0 = critically damped, 1 = clearly springy.
  function spring(t, bounce) {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const z = 1 - 0.58 * Math.min(1, Math.max(0, bounce));   // damping ratio 1 → .42
    const w = Math.max(9, 6.2 / z);
    if (z >= 0.999) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  class FX {
    constructor(boardEl, opts = {}) {
      injectCSS();
      this.board = boardEl; this.cfg = { ...load(), ...opts }; this.id = ++uid; this.key = '';
      boardEl.classList.add('ptfx-board');
      if (getComputedStyle(boardEl).position === 'static') boardEl.style.position = 'relative';
      this.svg = el('svg', { class: 'ptfx-layer', 'aria-hidden': 'true' });
      boardEl.append(this.svg);
      this.indices = [];
      this.ro = new ResizeObserver(() => this.draw(true)); this.ro.observe(boardEl);
      this.apply();
    }
    set(cfg) { Object.assign(this.cfg, cfg); this.apply(); this.draw(true); }
    apply() {
      const c = this.cfg, s = this.board.style;
      s.setProperty('--ptfx-c', c.color); s.setProperty('--ptfx-glow', c.glow + 'px');
      s.setProperty('--ptfx-pulse', c.pulse + 's'); s.setProperty('--ptfx-lo', String(1 - 0.6 * c.pulseDepth));
    }
    // Token centres and size in board coordinates.
    geo(i) {
      const cells = this.board.querySelectorAll('.cell'), b = this.board.getBoundingClientRect();
      const tok = cells[i]?.querySelector('.bubble') || cells[i];
      if (!tok) return null;
      const r = tok.getBoundingClientRect();
      return { x: r.left - b.left - this.board.clientLeft + r.width / 2, y: r.top - b.top - this.board.clientTop + r.height / 2, d: r.width };
    }
    // indices: the selected cells. Pass [] to clear.
    select(indices) {
      const key = indices.join(',');
      if (key === this.key) return;
      this.key = key; this.indices = indices.slice(); this.draw(false);
    }
    hide(on) { this.svg.classList.toggle('ptfx-hide', on); }
    draw(quiet) {
      const svg = this.svg, c = this.cfg; svg.replaceChildren();
      if (!this.indices.length) return;
      const pts = this.order(this.indices.map((i) => this.geo(i)).filter(Boolean));
      if (!pts.length) return;
      const w = this.board.clientWidth, h = this.board.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
      const d0 = pts[0].d, W = d0 * c.pad, rw = Math.min(c.ring, W / 4);
      const joined = c.style !== 'rings';
      const d = joined ? 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') : pts.map((p) => `M${p.x.toFixed(1)},${p.y.toFixed(1)} h0.01`).join(' ');
      const id = `ptfx${this.id}`;
      const defs = el('defs');
      const grad = el('linearGradient', { id: id + 'g', x1: '0', y1: '0', x2: '1', y2: '1' });
      grad.append(el('stop', { offset: '0', 'stop-color': c.color }), el('stop', { offset: '1', 'stop-color': c.color2 }));
      const mask = el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h });
      const line = { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      mask.append(el('path', { ...line, stroke: '#fff', 'stroke-width': W }), el('path', { ...line, stroke: '#000', 'stroke-width': W - 2 * rw }));
      defs.append(grad, mask); svg.append(defs);
      const g = el('g', { class: 'ptfx-sel' + (quiet ? '' : ' ptfx-in') });
      if (c.style === 'halo') {
        g.append(el('path', { ...line, stroke: `url(#${id}g)`, 'stroke-width': W * 1.02, 'stroke-opacity': 0.34 }));
        g.append(el('rect', { x: 0, y: 0, width: w, height: h, fill: `url(#${id}g)`, mask: `url(#${id}m)`, opacity: 0.55 }));
      } else {
        g.append(el('path', { ...line, stroke: c.color, 'stroke-width': W - 2 * rw, 'stroke-opacity': 0.05 }));
        g.append(el('rect', { x: 0, y: 0, width: w, height: h, fill: `url(#${id}g)`, mask: `url(#${id}m)` }));
      }
      svg.append(g);
    }
    // For an L of three, put the corner token in the middle so the outline bends around it.
    order(pts) {
      if (pts.length !== 3) return pts;
      const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < a.d * 1.6;
      const mid = pts.findIndex((p, i) => pts.every((q, j) => i === j || near(p, q)));
      return mid < 0 ? pts : [pts[(mid + 1) % 3], pts[mid], pts[(mid + 2) % 3]];
    }

    /* Animate a swap/twist. indices: cells in cycle order; token at indices[k] moves to indices[k+dir].
       Calls onLand() as the tokens touch down (haptics hook). Resolves when settled. */
    async animate(indices, direction = 1, { returning = false, onLand } = {}) {
      const c = this.cfg, cells = this.board.querySelectorAll('.cell');
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !indices?.length || typeof Element.prototype.animate !== 'function') { onLand?.(); return; }
      const n = indices.length, from = indices.map((i) => this.geo(i));
      const to = indices.map((_, k) => from[(k + (direction > 0 ? 1 : n - 1)) % n]);
      const cx = from.reduce((s, p) => s + p.x, 0) / n, cy = from.reduce((s, p) => s + p.y, 0) / n;
      const dur = returning ? Math.round(c.duration * 0.75) : c.duration;
      const bounce = returning ? c.missBounce : c.bounce;
      // landing moment = first time the spring reaches 1
      let land = 0.6; for (let t = 0.05; t <= 1; t += 0.01) if (spring(t, bounce) >= 0.995) { land = t; break; }
      this.hide(true);
      const ghosts = [], anims = [];
      indices.forEach((idx, k) => {
        const orig = cells[idx]?.querySelector('.bubble'); if (!orig) return;
        const g = document.createElement('div'); g.className = 'ptfx-ghost';
        g.style.width = g.style.height = from[k].d + 'px';
        g.append(orig.cloneNode(true)); this.board.append(g); ghosts.push(g);
        cells[idx].classList.add('ptfx-moving');
        const a = from[k], b = to[k], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        // pair: perpendicular arc (first token over, second under); twist: bow outward from the corner centre
        let px = -dy / len, py = dx / len, side = 1; // the two tokens travel in opposite directions, so the same side bends them apart
        if (n !== 2) { const mx = (a.x + b.x) / 2 - cx, my = (a.y + b.y) / 2 - cy; if (px * mx + py * my < 0) { px = -px; py = -py; } }
        const over = n === 2 ? k === 0 : true;
        g.style.zIndex = over ? 10 : 9;
        const frames = [];
        for (let s = 0; s <= 40; s++) {
          const t = s / 40, p = spring(t, bounce), e = smooth(Math.min(1, t / land));
          const arc = Math.sin(Math.PI * e) * c.arc * a.d * side;
          const x = a.x + dx * p + px * arc, y = a.y + dy * p + py * arc;
          const sc = 1 + (over ? c.lift : -c.lift * 0.6) * Math.sin(Math.PI * e);
          const q = t > land ? c.squash * Math.sin(Math.PI * Math.min(1, (t - land) / 0.28)) * (1 - (t - land)) : 0;
          frames.push({ offset: t, transform: `translate(${(x - a.d / 2).toFixed(2)}px,${(y - a.d / 2).toFixed(2)}px) rotate(${ang}deg) scale(${(sc * (1 - q)).toFixed(4)},${(sc * (1 + q)).toFixed(4)}) rotate(${-ang}deg)` });
        }
        anims.push(g.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }));
      });
      const landTimer = setTimeout(() => onLand?.(), dur * land);
      const guard = setTimeout(() => anims.forEach((a) => { try { a.finish(); } catch { a.cancel(); } }), dur + 600);
      try { await Promise.all(anims.map((a) => a.finished.catch(() => {}))); }
      finally {
        clearTimeout(guard); clearTimeout(landTimer);
        ghosts.forEach((g) => g.remove());
        indices.forEach((i) => cells[i]?.classList.remove('ptfx-moving'));
        this.hide(false);
      }
    }
  }

  root.PTSwapFX = { FX, DEFAULTS, PRESETS, STORE, load, spring,
    save(cfg) { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch { /* ignore */ } },
    clear() { try { localStorage.removeItem(STORE); } catch { /* ignore */ } } };
})(typeof window !== 'undefined' ? window : globalThis);
