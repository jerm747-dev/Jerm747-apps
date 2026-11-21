/* 747 GP rival liveries (1.3.20)
 * Each rival gets a base paint, an accent, an optional pinstripe colour and a style. The accent shapes
 * (racing stripes, a curved side sweep, two-tone splits, pinstripes) are drawn in the car's own 3D space,
 * then baked into its texture, so they sit on the body the same way on every car and in both renderers.
 * Only the clear-coated paint changes: glass, tyres, carbon and decals keep their original look.
 *
 * Workshop: livery-workshop.html edits these on your device (saved as gp747liveries); race.html and the
 * race-setup grid read the saved set first, then fall back to DEFAULTS below. "Copy JSON" in the workshop
 * gives you a block to paste over DEFAULTS when you want a set to ship for everyone.
 */
(function () {
  'use strict';
  // House rule: no cyan, yellow or magenta paint. Deep, saturated or classic racing colours instead.
  const DEFAULTS = [
    { n: 'Crimson',  tag: 'CRM', base: '#a8102a', accent: '#f1f1ee', pin: '#15161a', style: 'stripes' },
    { n: 'Verde',    tag: 'VRD', base: '#0f4a2c', accent: '#e6d9bd', pin: '#c9853a', style: 'sweep' },
    { n: 'Navy',     tag: 'NVY', base: '#13244e', accent: '#ff7416', pin: '#f1f1ee', style: 'split' },
    { n: 'Pearl',    tag: 'PRL', base: '#e7e8ea', accent: '#c4122e', pin: '#13244e', style: 'sweep' },
    { n: 'Gunmetal', tag: 'GUN', base: '#3b4048', accent: '#2f6fe0', pin: '#f1f1ee', style: 'stripes' },
    { n: 'Ember',    tag: 'EMB', base: '#c9561a', accent: '#121316', pin: '#f1f1ee', style: 'split' },
    { n: 'Bordeaux', tag: 'BDX', base: '#561021', accent: '#c7cbd1', pin: '#c9853a', style: 'pin' },
    { n: 'Onyx',     tag: 'ONX', base: '#121316', accent: '#d42a2a', pin: '#d42a2a', style: 'sweep' },
    { n: 'Steel',    tag: 'STL', base: '#4c6f8c', accent: '#f1f1ee', pin: '#13244e', style: 'stripes' }
  ];
  const STYLES = [
    { id: 'stripes', n: 'Racing stripes', d: 'Twin stripes nose to tail over the top, pinstripe edges' },
    { id: 'sweep',   n: 'Side sweep',     d: 'A curved accent rising from the front wheel to the tail' },
    { id: 'split',   n: 'Two-tone split', d: 'Accent lower body under a curved line, pinstripe on the edge' },
    { id: 'pin',     n: 'Pinstripes',     d: 'Fine beltline and bonnet pinstripes in the accent colour' },
    { id: 'solid',   n: 'Solid',          d: 'Base paint only' }
  ];
  const KEY = 'gp747liveries';
  const hex = h => { const v = parseInt(String(h).replace('#', ''), 16) || 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
  // hue in degrees, saturation, value
  function hsv(h) {
    const [r, g, b] = hex(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hu = 0;
    if (d > 0) hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hu * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  // the three colours that never look right on these models
  function banned(h) {
    const [hu, s, v] = hsv(h);
    if (s < 0.38 || v < 0.3) return null;
    if (hu >= 42 && hu <= 80) return 'yellow';
    if (hu >= 160 && hu <= 205) return 'cyan';
    if (hu >= 285 && hu <= 335) return 'magenta';
    return null;
  }
  function clean(l, i) {
    const d = DEFAULTS[i % DEFAULTS.length];
    const o = Object.assign({}, d, l || {});
    if (!STYLES.some(s => s.id === o.style)) o.style = d.style;
    for (const k of ['base', 'accent', 'pin']) if (!/^#[0-9a-f]{6}$/i.test(o[k]) || banned(o[k])) o[k] = d[k];
    o.tag = String(o.tag || d.tag).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || d.tag;
    o.n = String(o.n || d.n).slice(0, 14);
    return o;
  }
  function list() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
    return DEFAULTS.map((d, i) => clean(Array.isArray(saved) ? saved[i] : null, i));
  }
  function save(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr.map(clean))); } catch (_) {} }
  function reset() { try { localStorage.removeItem(KEY); } catch (_) {} }

  // ---- automatic workshop: colour-wheel palettes that skip the banned hues ----
  const SAFE_HUES = [0, 8, 16, 24, 30, 36, 90, 110, 130, 145, 158, 210, 218, 225, 235, 250, 262, 275, 345, 352];
  function fromHsv(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  function shuffle(seed) {
    let s = (seed || Date.now()) >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const hues = SAFE_HUES.slice().sort(() => rnd() - 0.5);
    const neutrals = ['#f1f1ee', '#121316', '#c7cbd1', '#3b4048'];
    const styles = ['stripes', 'sweep', 'split', 'pin', 'sweep', 'stripes', 'split', 'sweep', 'pin'];
    return DEFAULTS.map((d, i) => {
      const h = hues[i % hues.length];
      const base = i === 3 ? '#e7e8ea' : i === 7 ? '#121316' : fromHsv(h, 0.62 + rnd() * 0.3, 0.32 + rnd() * 0.45);
      // accent: the colour-wheel complement half the time, a neutral the rest
      let accent = rnd() < 0.5 ? fromHsv((h + 150 + rnd() * 60) % 360, 0.75, 0.85) : neutrals[Math.floor(rnd() * neutrals.length)];
      const lum = c => { const [r, g, b] = hex(c); return 0.299 * r + 0.587 * g + 0.114 * b; };
      if (banned(accent) || Math.abs(lum(accent) - lum(base)) < 0.18) accent = lum(base) > 0.45 ? '#121316' : '#f1f1ee';
      const pin = lum(base) > 0.45 ? '#121316' : '#f1f1ee';
      return clean({ n: d.n, tag: d.tag, base, accent, pin, style: styles[(i + Math.floor(rnd() * 9)) % styles.length] }, i);
    });
  }

  // ---- texture-space bake of the model's own 3D position and normal (once per model) ----
  const BAKES = new WeakMap();
  function bake(geo, N) {
    const hit = BAKES.get(geo);
    if (hit && hit.N === N) return hit;
    const P = geo.attributes.position.array, Nm = geo.attributes.normal.array, U = geo.attributes.uv.array;
    const I = geo.index ? geo.index.array : null, tris = I ? I.length / 3 : P.length / 9;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const pos = new Float32Array(N * N * 3), nor = new Int8Array(N * N * 3), cov = new Uint8Array(N * N);
    for (let t = 0; t < tris; t++) {
      const a = I ? I[t * 3] : t * 3, b = I ? I[t * 3 + 1] : t * 3 + 1, c = I ? I[t * 3 + 2] : t * 3 + 2;
      // texture wraps (RepeatWrapping): bring each corner into the 0..1 tile
      let ua = U[a * 2], va = U[a * 2 + 1], ub = U[b * 2], vb = U[b * 2 + 1], uc = U[c * 2], vc = U[c * 2 + 1];
      const fu = Math.floor(Math.min(ua, ub, uc)), fv = Math.floor(Math.min(va, vb, vc));
      ua -= fu; ub -= fu; uc -= fu; va -= fv; vb -= fv; vc -= fv;
      const x0 = ua * N, y0 = va * N, x1 = ub * N, y1 = vb * N, x2 = uc * N, y2 = vc * N;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(N - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(N - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) / area;
        const w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const o = py * N + px;
        for (let k = 0; k < 3; k++) {
          pos[o * 3 + k] = P[a * 3 + k] * w0 + P[b * 3 + k] * w1 + P[c * 3 + k] * w2;
          nor[o * 3 + k] = Math.round(127 * (Nm[a * 3 + k] * w0 + Nm[b * 3 + k] * w1 + Nm[c * 3 + k] * w2));
        }
        cov[o] = 1;
      }
    }
    // grow each island by a few texels so filtering never pulls in unbaked texels at the seams
    for (let pass = 0; pass < 3; pass++) {
      const add = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const o = y * N + x; if (cov[o]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
          const q = Y * N + X; if (cov[q] === 1) { add.push(o, q); break; }
        }
      }
      for (let i = 0; i < add.length; i += 2) { const o = add[i], q = add[i + 1]; pos.set(pos.subarray(q * 3, q * 3 + 3), o * 3); nor.set(nor.subarray(q * 3, q * 3 + 3), o * 3); }
      for (let i = 0; i < add.length; i += 2) cov[add[i]] = 1;
    }
    const out = { N, pos, nor, cov, min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] };
    BAKES.set(geo, out);
    return out;
  }

  // ---- the shapes: return [accent weight, pin weight] for a point on the body ----
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const band = (x, lo, hi, e) => sm(lo - e, lo + e, x) * (1 - sm(hi - e, hi + e, x));
  const line = (x, c, w, e) => band(x, c - w, c + w, e);
  function shape(style, X, Y, Z, nx, ny, nz, dims) {
    // X: -1..1 across, Y: 0 (ground)..1 (roof), Z: 0 (tail)..1 (nose); e = edge softness ~ 1.5 cm
    const [W, H, L] = dims, ex = 0.015 / W, ey = 0.015 / H, ax = Math.abs(X), side = Math.abs(nx) > 0.42, top = ny > 0.3;
    const t = 1 - Z; // 0 at the nose, 1 at the tail
    if (style === 'stripes') {
      const over = top || (Math.abs(nz) > 0.45 && Y > 0.45);   // over the top, and the upper nose/tail only (keeps grilles clear)
      if (!over) return [0, 0];
      const s = band(ax, 0.07, 0.25, ex);
      const p = line(ax, 0.285, 0.012, ex * 0.6);   // pinstripe just outside each stripe
      return [s, p];
    }
    if (style === 'sweep') {
      if (!side) return [0, 0];
      const c = 0.34 + 0.24 * sm(0.12, 0.95, t);          // rises from the front wheel to the tail
      const w = 0.075 * sm(0.04, 0.3, t);                  // tapers to a point at the nose
      const a = line(Y, c, w, ey);
      const p = line(Y, c + w + 0.035, 0.008 * sm(0.1, 0.4, t), ey * 0.6);
      return [a, p];
    }
    if (style === 'split') {
      const c = 0.36 + 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.1)); // gentle curve along the flank
      let a = 1 - sm(c - ey, c + ey, Y);
      if (top && Y > c) a = 0;
      const p = (side || Math.abs(nz) > 0.4) ? line(Y, c + 0.022, 0.007, ey * 0.6) : 0;
      return [a, p];
    }
    if (style === 'pin') {
      const p = (side ? line(Y, 0.52 - 0.05 * t, 0.009, ey * 0.6) + line(Y, 0.47 - 0.05 * t, 0.005, ey * 0.6) : 0) +
        (top ? line(ax, 0.2, 0.012, ex * 0.6) : 0);
      return [0, Math.min(1, p)];
    }
    return [0, 0];
  }

  // ---- paint one livery onto a model texture ----
  const CACHE = {};
  function paint(THREE, kind, mat, geo, livery, opts) {
    opts = opts || {};
    const key = kind + '|' + [livery.base, livery.accent, livery.pin, livery.style].join(',');
    if (CACHE[key]) return CACHE[key];
    const src = mat.map && mat.map.image, mk = mat.metalnessMap && mat.metalnessMap.image;
    const drawable = i => i && (i instanceof HTMLImageElement || i instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && i instanceof ImageBitmap));
    if (!drawable(src) || !drawable(mk)) return null;
    const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, N, N); const im = x.getImageData(0, 0, N, N), d = im.data;
    const cm = document.createElement('canvas'); cm.width = cm.height = N;
    const xm = cm.getContext('2d', { willReadFrequently: true }); xm.drawImage(mk, 0, 0, N, N);
    const md = xm.getImageData(0, 0, N, N).data;
    // the model's main paint colour: the most common colour among clear-coated texels;
    // a strong coloured body (blue truck) wins over black trim when it covers enough of the paint
    const hist = new Map(), hsat = new Map(); let tot = 0, satTot = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (md[i] < 128) continue; tot++;
      const q = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); hist.set(q, (hist.get(q) || 0) + 1);
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx > 40 && (mx - mn) / mx > 0.35) { satTot++; const q2 = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5); hsat.set(q2, (hsat.get(q2) || 0) + 1); }
    }
    let bq = 0, bn = -1; for (const [q, n] of hist) if (n > bn) { bn = n; bq = q; }
    if (satTot > tot * 0.15) { let sq = 0, sn = -1; for (const [q, n] of hsat) if (n > sn) { sn = n; sq = q; } bq = (((sq >> 6) * 2 + 1) << 8) | ((((sq >> 3) & 7) * 2 + 1) << 4) | ((sq & 7) * 2 + 1); }
    const Dr = ((bq >> 8) * 16 + 8) / 255, Dg = (((bq >> 4) & 15) * 16 + 8) / 255, Db = ((bq & 15) * 16 + 8) / 255;
    const Dl = 0.299 * Dr + 0.587 * Dg + 0.114 * Db, Dsum = Dr + Dg + Db + 1e-3, darkBase = Dl < 0.14;
    const cols = [hex(livery.base), hex(livery.accent), hex(livery.pin)];
    const lums = cols.map(c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
    const B = livery.style === 'solid' ? null : bake(geo, N);
    const lo = B && B.min, hi = B && B.max;
    const W = B ? (hi[0] - lo[0]) / 2 : 1, H = B ? hi[1] - lo[1] : 1, L = B ? hi[2] - lo[2] : 1, cx = B ? (hi[0] + lo[0]) / 2 : 0;
    const dims = [W, H, L];
    const mix = [0, 0, 0];
    for (let i = 0, o = 0; i < d.length; i += 4, o++) {
      const m = md[i] / 255; if (m < 0.05) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, l = 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
      let sim;
      if (darkBase) sim = Math.max(0, 1 - Math.max(0, l - 0.22) / 0.12) * Math.max(0, 1 - Math.max(0, sat - 0.3) / 0.2);
      else {
        const sum = r + g + b + 1e-3, dc = Math.hypot(r / sum - Dr / Dsum, g / sum - Dg / Dsum, b / sum - Db / Dsum);
        sim = Math.min(1, Math.max(0, 1 - (dc - 0.07) / 0.1)) * (l > Dl * 0.2 && l < Math.min(1, Dl * 2.8 + 0.15) ? 1 : 0);
      }
      const w = m * sim; if (w < 0.01) continue;
      // which colour this texel takes: base, then the accent shape, then the pinstripe on top
      let wa = 0, wp = 0;
      if (B && B.cov[o]) {
        const X = (B.pos[o * 3] - cx) / W, Y = (B.pos[o * 3 + 1] - lo[1]) / H, Z = (B.pos[o * 3 + 2] - lo[2]) / L;
        const s = shape(livery.style, X, Y, Z, B.nor[o * 3] / 127, B.nor[o * 3 + 1] / 127, B.nor[o * 3 + 2] / 127, dims);
        wa = s[0]; wp = Math.min(1, s[1]);
      }
      for (let k = 0; k < 3; k++) mix[k] = cols[0][k] + (cols[1][k] - cols[0][k]) * wa;
      for (let k = 0; k < 3; k++) mix[k] = mix[k] + (cols[2][k] - mix[k]) * wp;
      const tl = 0.299 * mix[0] + 0.587 * mix[1] + 0.114 * mix[2], darkT = tl < 0.12;
      // keep the paint's light and shade, moved onto the new colour
      const sh = darkBase ? (darkT ? Math.min(2, 0.6 + l * 5) : Math.min(1.35, Math.max(0.35, 0.62 + (l - Dl) * 3)))
        : Math.min(1.6, Math.max(0.25, l / Math.max(0.04, Dl))) * (darkT ? 0.35 : 1);
      d[i] = 255 * (r + (Math.min(1, mix[0] * sh) - r) * w);
      d[i + 1] = 255 * (g + (Math.min(1, mix[1] * sh) - g) * w);
      d[i + 2] = 255 * (b + (Math.min(1, mix[2] * sh) - b) * w);
    }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.flipY = false;
    if (mat.map) { t.wrapS = mat.map.wrapS; t.wrapT = mat.map.wrapT; }
    if (opts.srgb) opts.srgb(t);
    if (opts.aniso) t.anisotropy = opts.aniso;
    return CACHE[key] = t;
  }

  window.GPLivery = { DEFAULTS, STYLES, KEY, list, save, reset, shuffle, banned, paint, bake, hex };
})();
