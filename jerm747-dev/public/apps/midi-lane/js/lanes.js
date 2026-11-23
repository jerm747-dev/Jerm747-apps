// The two lanes, drawn on one canvas each, sharing one horizontal view so switching tabs keeps
// the same bars on screen.
//   Rhythm Lane: 16th-note steps per row (drum kit rows, or the pitches a keys track uses). Tap to
//                toggle, drag to paint. Rows are tall touch targets.
//   Key Lane:    piano roll. Draw tool: tap to add, drag to draw a length. Select tool: drag a box.
//                Either tool: drag a note to move the whole selection, drag its right edge to resize.
// Two fingers pinch to zoom and pan. One finger on the ruler scrolls sideways (tap it to set the
// play start); one finger on the key column scrolls up and down. Mouse: wheel scrolls, Ctrl+wheel zooms.
import { P, STEP, BAR, PPQ, lenTicks, rowsFor, color, snapRound, snapFloor, pushUndo } from './model.js';
import { drumName } from './drumway.js';

export const V = { ppx: 0.24, x0: 0, keysH: 14, keysY: 127 - 84, rowsH: 30, rowsY: 0 };
export const sel = new Set();
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const isBlack = (n) => [1, 3, 6, 8, 10].includes(n % 12);
const RULER = 24, STRIP = 30; // ruler on top, scroll strip along the bottom
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Lane {
  constructor(canvas, mode, hooks) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.mode = mode; this.h = hooks;
    this.ptrs = new Map(); this.act = null; this.gest = null; this.box = null; this.lastLen = STEP * 2;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }
  get track() { return this.h.track(); }
  /** height of the velocity lane (only in full-screen lane mode) */
  vh() { return this.h.velLane?.() ? Math.round(clamp(this.cv.clientHeight * 0.22, 48, 110)) : 0; }
  area() { return this.cv.clientHeight - RULER - STRIP - this.vh(); }
  get gut() { return this.mode === 'rhythm' || this.track.drum ? 96 : 52; }
  // ---------- geometry ----------
  rows() {
    const t = this.track, H = this.area();
    if (this.mode === 'keys' && !t.drum) return { list: null, n: 128, h: V.keysH, key: 'keys' };
    const list = rowsFor(t);
    const h = this.mode === 'rhythm' ? clamp(Math.floor(H / list.length), 26, 46) : V.rowsH;
    return { list, n: list.length, h, key: 'rows' };
  }
  y0(R) { return R.key === 'keys' ? V.keysY : V.rowsY; }
  setY0(R, v) { const vis = this.area() / R.h; const m = Math.max(0, R.n - vis); if (R.key === 'keys') V.keysY = clamp(v, 0, m); else V.rowsY = clamp(v, 0, m); }
  rowOf(R, n) { return R.list ? R.list.indexOf(n) : 127 - n; }
  pitchOf(R, row) { return R.list ? R.list[clamp(row, 0, R.n - 1)] : 127 - clamp(row, 0, 127); }
  tx(t) { return this.gut + (t - V.x0) * V.ppx; }
  xt(x) { return V.x0 + (x - this.gut) / V.ppx; }
  rowAt(R, y) { return Math.floor((y - RULER) / R.h + this.y0(R)); }
  ry(R, row) { return RULER + (row - this.y0(R)) * R.h; }
  clampX() { const vis = (this.cv.clientWidth - this.gut) / V.ppx; V.x0 = clamp(V.x0, 0, Math.max(0, lenTicks() - vis * 0.5)); }
  centerOn(n) { const R = this.rows(); if (R.key !== 'keys') return; this.setY0(R, 127 - n - this.area() / R.h / 2); }

  // ---------- drawing ----------
  draw(pos = null) {
    const cv = this.cv, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = this.g; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = this.track, R = this.rows(), y0 = this.y0(R), GUT = this.gut, len = lenTicks(), col = color(t);
    this.clampX(); this.setY0(R, y0);
    g.fillStyle = '#0d0f11'; g.fillRect(0, 0, W, H);
    const r0 = Math.max(0, Math.floor(y0)), r1 = Math.min(R.n - 1, Math.ceil(y0 + this.area() / R.h));
    const tA = this.xt(GUT), tB = this.xt(W);
    // row backgrounds
    for (let r = r0; r <= r1; r++) {
      const y = this.ry(R, r), p = this.pitchOf(R, r);
      g.fillStyle = R.key === 'keys' ? (isBlack(p) ? '#101316' : '#15191d') : (r % 2 ? '#121518' : '#161a1e');
      g.fillRect(GUT, y, W - GUT, R.h);
      if (R.key === 'keys' && p % 12 === 0) { g.fillStyle = '#262c33'; g.fillRect(GUT, y + R.h - 1, W - GUT, 1); }
    }
    // past the song end
    const xe = this.tx(len); if (xe < W) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(Math.max(GUT, xe), RULER, W, H); }
    // vertical grid
    const snap = this.h.snap(), step = this.mode === 'rhythm' ? STEP : snap;
    const lines = (every, style, minPx) => {
      if (every * V.ppx < minPx) return;
      g.fillStyle = style;
      for (let k = Math.ceil(tA / every) * every; k <= tB; k += every) g.fillRect(Math.round(this.tx(k)), RULER, 1, H - RULER);
    };
    if (this.mode === 'keys') lines(step, '#1b2026', 5);
    lines(PPQ, '#252b33', 4); lines(BAR, '#3a434e', 2);
    if (this.mode === 'rhythm') this.drawCells(g, R, r0, r1, col, pos);
    else this.drawNotes(g, R, r0, r1, col, W);
    if (this.box) { const b = this.box; g.fillStyle = 'rgba(143,240,207,.10)'; g.strokeStyle = 'rgba(143,240,207,.8)'; g.lineWidth = 1; g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h); }
    this.drawGutter(g, R, r0, r1, H, col);
    this.drawRuler(g, W, len);
    if (this.vh()) this.drawVel(g, W, H, col);
    this.drawStrip(g, W, H, len, col, R, pos);
    if (pos != null) { const x = this.tx(pos); if (x >= GUT) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), 0, 1.5, H); } }
  }
  // Rhythm Lane as a black step-sequencer panel: raised keys with an LED each, beat groups
  // in red / orange / yellow / cream across the bar; a lit key glows in its group colour.
  drawCells(g, R, r0, r1, col, pos) {
    const W = this.cv.clientWidth, cells = new Map(), t = this.track;
    for (const x of t.notes) { const r = this.rowOf(R, x.n); if (r < 0) continue; const s = Math.floor(x.t / STEP), k = r * 4096 + s; cells.set(k, Math.max(cells.get(k) || 0, x.v)); }
    const s0 = Math.max(0, Math.floor(this.xt(this.gut) / STEP)), s1 = Math.min(lenTicks() / STEP - 1, Math.ceil(this.xt(W) / STEP));
    const picked = new Set(); for (const x of t.notes) if (sel.has(x)) { const r = this.rowOf(R, x.n); if (r >= 0) picked.add(r * 4096 + Math.floor(x.t / STEP)); }
    const cw = STEP * V.ppx, now = pos == null ? -1 : Math.floor(pos / STEP);
    g.fillStyle = '#060607'; g.fillRect(this.gut, RULER, W - this.gut, this.area());
    for (let r = r0; r <= r1; r++) {
      const y = this.ry(R, r);
      for (let s = s0; s <= s1; s++) {
        const grp = Math.floor((s % 16) / 4), lead = s % 4 === 0 ? 2 : 0;
        const x = this.tx(s * STEP) + 2 + lead, w = cw - 4 - lead, h = R.h - 5, ky = y + 2, rad = Math.min(6, w / 4);
        if (w < 3) continue;
        const v = cells.get(r * 4096 + s), gc = GROUP[grp];
        g.fillStyle = '#000'; rr(g, x, ky + 2, w, h, rad); g.fill();                               // shadow under the key
        const face = g.createLinearGradient(0, ky, 0, ky + h);
        if (v) { face.addColorStop(0, mix(gc, '#ffffff', 0.18)); face.addColorStop(1, mix(gc, '#000000', 0.35 + 0.35 * (1 - v / 127))); }
        else { face.addColorStop(0, s === now ? '#3a3d42' : '#2b2d31'); face.addColorStop(1, s === now ? '#232529' : '#18191c'); }
        g.fillStyle = face; g.globalAlpha = v ? 0.55 + 0.45 * (v / 127) : 1; rr(g, x, ky, w, h, rad); g.fill(); g.globalAlpha = 1;
        g.fillStyle = v ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.07)'; g.fillRect(x + rad, ky + 1, w - rad * 2, 1); // top edge light
        const lw = Math.min(12, w * 0.4), lx = x + (w - lw) / 2, ly = ky + Math.min(6, h * 0.18);  // LED
        if (v) { g.shadowColor = gc; g.shadowBlur = 8; g.fillStyle = mix(gc, '#ffffff', 0.45); }
        else g.fillStyle = mix(gc, '#000000', 0.72);
        rr(g, lx, ly, lw, 3, 1.5); g.fill(); g.shadowBlur = 0;
        if (s === now) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; rr(g, x + 0.5, ky + 0.5, w - 1, h - 1, rad); g.stroke(); }
        if (picked.has(r * 4096 + s)) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; rr(g, x + 1, ky + 1, w - 2, h - 2, rad); g.stroke(); }
      }
    }
  }
  drawNotes(g, R, r0, r1, col, W) {
    const t = this.track;
    if (R.key === 'keys') for (const o of P.tracks) { // ghosts of the other tracks
      if (o === t || o.drum) continue;
      g.fillStyle = color(o); g.globalAlpha = 0.13;
      for (const x of o.notes) { const r = 127 - x.n; if (r < r0 || r > r1) continue; const a = this.tx(x.t), b = this.tx(x.t + x.d); if (b < this.gut || a > W) continue; g.fillRect(a, this.ry(R, r) + 2, b - a, R.h - 4); }
      g.globalAlpha = 1;
    }
    for (const x of t.notes) {
      const r = this.rowOf(R, x.n); if (r < r0 || r > r1 || r < 0) continue;
      const a = this.tx(x.t), b = this.tx(x.t + x.d); if (b < this.gut || a > W) continue;
      const y = this.ry(R, r), w = Math.max(3, b - a);
      g.globalAlpha = 0.35 + 0.65 * (x.v / 127); g.fillStyle = col;
      rr(g, a + 0.5, y + 1, w - 1, R.h - 2, Math.min(3, R.h / 4)); g.fill(); g.globalAlpha = 1;
      if (sel.has(x)) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; rr(g, a + 1, y + 1.5, w - 2, R.h - 3, 3); g.stroke(); }
      if (w > 34 && R.h >= 13) { g.fillStyle = '#0b0d0e'; g.font = '600 10px "Chakra Petch", sans-serif'; g.fillText(R.list ? '' : noteName(x.n), a + 4, y + R.h / 2 + 3.5); }
    }
  }
  drawGutter(g, R, r0, r1, H, col) {
    const GUT = this.gut;
    g.fillStyle = '#0a0b0d'; g.fillRect(0, RULER, GUT, H);
    for (let r = r0; r <= r1; r++) {
      const y = this.ry(R, r), p = this.pitchOf(R, r);
      if (R.key === 'keys') {
        g.fillStyle = isBlack(p) ? '#1a1d21' : '#d9d6cc'; g.fillRect(0, y, GUT - (isBlack(p) ? 14 : 2), R.h - 1);
        if (p % 12 === 0 && R.h >= 9) { g.fillStyle = '#3b3f44'; g.font = '600 10px "Chakra Petch", sans-serif'; g.fillText(noteName(p), 4, y + R.h - 3); }
      } else {
        const hw = this.mode === 'rhythm';
        g.fillStyle = hw ? '#0b0b0c' : r % 2 ? '#14171b' : '#181c20'; g.fillRect(0, y, GUT - 2, R.h - 1);
        g.fillStyle = col; g.fillRect(0, y + (hw ? 4 : 0), 3, R.h - (hw ? 9 : 1));
        if (hw) { g.fillStyle = '#1d1e21'; g.fillRect(9, y + R.h - 3, GUT - 22, 1); }
        g.fillStyle = hw ? '#ffd21f' : '#cfd6dc'; g.font = `${hw ? 600 : 500} ${R.h >= 28 ? 12 : 11}px ${hw ? '"Chakra Petch"' : 'Inter'}, sans-serif`;
        g.fillText(fit(g, this.track.drum ? drumName(p) : noteName(p), GUT - 14), 9, y + R.h / 2 + 4);
      }
    }
  }
  // velocity lane: one bar per note, 25/50/75% guides, readout while you drag
  drawVel(g, W, H, col) {
    const GUT = this.gut, vh = this.vh(), y0 = H - STRIP - vh, top = y0 + 6, hh = vh - 10, len = lenTicks();
    g.fillStyle = '#0a0c0e'; g.fillRect(0, y0, W, vh);
    g.fillStyle = '#262d34'; g.fillRect(0, y0, W, 1);
    g.font = '600 10px "Chakra Petch", sans-serif';
    const marks = [0.25, 0.5, 0.75].map((f) => Math.round(top + hh * (1 - f)));
    marks.forEach((y, i) => { g.fillStyle = i === 1 ? '#2a323a' : '#1c2228'; g.fillRect(GUT, y, W - GUT, 1); });
    const xs = this.xt(GUT), xe = this.xt(W), cw = this.mode === 'rhythm' ? STEP * V.ppx : 0;
    for (const n of this.track.notes) {
      if (n.t + n.d < xs || n.t > xe || n.t >= len) continue;
      const x = this.tx(n.t) + (cw ? Math.min(cw / 2 - 3, 6) : 0), w = clamp((cw || n.d * V.ppx) - 3, 4, 9), h = Math.max(2, hh * (n.v / 127));
      g.globalAlpha = 0.45 + 0.55 * (n.v / 127); g.fillStyle = col;
      g.fillRect(x, top + hh - h, w, h); g.globalAlpha = 1;
      g.fillRect(x - 1, top + hh - h - 1, w + 2, 3);
      if (sel.has(n)) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(x - 0.5, top + hh - h - 0.5, w + 1, h + 1); }
    }
    g.fillStyle = '#0a0b0d'; g.fillRect(0, y0 + 1, GUT, vh - 1);
    g.fillStyle = '#6f7a85'; g.fillText('VEL', 8, y0 + 16);
    if (this.velRead == null && vh >= 80) { g.textAlign = 'right'; g.fillStyle = '#4c5762'; ['25%', '50%', '75%'].forEach((l, i) => g.fillText(l, GUT - 5, marks[i] + 3.5)); g.textAlign = 'start'; }
    if (this.velRead != null) { g.fillStyle = col; g.font = '700 18px "Chakra Petch", sans-serif'; g.fillText(String(this.velRead), 8, y0 + 40); g.font = '600 10px "Chakra Petch", sans-serif'; g.fillStyle = '#8b97a3'; g.fillText(`${Math.round((this.velRead / 127) * 100)}%`, 8, y0 + 54); }
  }
  velNotes(x) {
    // the bars under x (a chord shares one x); if any of them are selected, only the selected ones
    const cw = this.mode === 'rhythm' ? STEP * V.ppx : 0, len = lenTicks();
    const hit = this.track.notes.filter((n) => { if (n.t >= len) return false; const bx = this.tx(n.t) + (cw ? Math.min(cw / 2 - 3, 6) : 0), w = clamp((cw || n.d * V.ppx) - 3, 4, 9); return x >= bx - 6 && x <= bx + w + 6; });
    const picked = hit.filter((n) => sel.has(n));
    return picked.length ? picked : hit;
  }
  velAt(y) {
    const H = this.cv.clientHeight, vh = this.vh(), top = H - STRIP - vh + 6, hh = vh - 10;
    let v = Math.round(clamp((top + hh - y) / hh, 0, 1) * 126) + 1;
    for (const m of [32, 64, 95, 127]) if (Math.abs(v - m) <= 2) v = m; // gentle pull to the 25/50/75/100% lines
    return v;
  }
  velPaint(p) {
    const ns = this.velNotes(p.x); if (!ns.length) return;
    if (!this.act.pushed) { pushUndo(); this.act.pushed = true; }
    const v = this.velAt(p.y); ns.forEach((n) => (n.v = v)); this.velRead = v;
    this.draw(); this.h.edited(false);
  }
  // bottom scroll strip: the whole song in miniature with a window for what's on screen
  drawStrip(g, W, H, len, col, R, pos) {
    const GUT = this.gut, y = H - STRIP, k = (W - GUT) / len, vis = (W - GUT) / V.ppx;
    g.fillStyle = '#08090a'; g.fillRect(0, y, W, STRIP);
    g.fillStyle = '#20262c'; g.fillRect(0, y, W, 1);
    g.fillStyle = '#2a3139';
    for (let b = 1; b < len / BAR; b++) g.fillRect(Math.round(GUT + b * BAR * k), y + 6, 1, STRIP - 12);
    const ns = this.track.notes; let lo = 127, hi = 0;
    if (R.list) { lo = 0; hi = Math.max(1, R.n - 1); } else for (const x of ns) { lo = Math.min(lo, x.n); hi = Math.max(hi, x.n); }
    g.fillStyle = col; g.globalAlpha = 0.75;
    for (const x of ns) {
      if (x.t >= len) continue;
      const v = R.list ? this.rowOf(R, x.n) : hi - x.n, span = R.list ? hi : Math.max(1, hi - lo);
      g.fillRect(GUT + x.t * k, y + 5 + (v / span) * (STRIP - 12), Math.max(1.5, x.d * k), 2);
    }
    g.globalAlpha = 1;
    const wx = GUT + V.x0 * k, ww = Math.max(14, Math.min(W - GUT, vis * k));
    g.fillStyle = 'rgba(143,240,207,.13)'; g.strokeStyle = 'rgba(143,240,207,.85)'; g.lineWidth = 1.5;
    rr(g, wx + 0.75, y + 3.75, ww - 1.5, STRIP - 7.5, 5); g.fill(); g.stroke();
    g.fillStyle = 'rgba(143,240,207,.85)'; for (let i = -1; i <= 1; i++) g.fillRect(Math.round(wx + ww / 2 + i * 4), y + 11, 1.5, STRIP - 22);
    if (pos != null) { g.fillStyle = '#ffffff'; g.fillRect(GUT + pos * k, y + 3, 1.5, STRIP - 6); }
    g.fillStyle = '#0a0b0d'; g.fillRect(0, y + 1, GUT, STRIP - 1);
    g.fillStyle = '#6f7a85'; g.font = '600 10.5px "Chakra Petch", sans-serif'; g.fillText(GUT >= 90 ? '◀ SCROLL ▶' : '◀ ▶', 7, y + STRIP / 2 + 4);
  }
  drawRuler(g, W, len) {
    const GUT = this.gut;
    g.fillStyle = '#08090a'; g.fillRect(0, 0, W, RULER);
    g.fillStyle = '#57616c'; g.font = '600 11px "Chakra Petch", sans-serif';
    const barPx = BAR * V.ppx, every = barPx < 28 ? (barPx < 12 ? 8 : 4) : 1;
    for (let b = Math.max(0, Math.floor(this.xt(GUT) / BAR)); b * BAR <= Math.min(len, this.xt(W)); b++) {
      const x = this.tx(b * BAR); if (x < GUT) continue;
      g.fillStyle = '#3a434e'; g.fillRect(Math.round(x), 12, 1, 12);
      if (b % every === 0 && b * BAR < len) { g.fillStyle = '#8b97a3'; g.fillText(String(b + 1), x + 4, 15); }
    }
    if (this.mode === 'rhythm' && STEP * V.ppx >= 22) {
      g.font = '600 9.5px "Chakra Petch", sans-serif';
      for (let st = Math.max(0, Math.floor(this.xt(GUT) / STEP)); st * STEP < Math.min(len, this.xt(W)); st++) {
        if (st % 16 === 0) continue;
        const x = this.tx(st * STEP); g.fillStyle = GROUP[Math.floor((st % 16) / 4)]; g.globalAlpha = st % 4 ? 0.45 : 0.9;
        g.fillText(String((st % 16) + 1), x + 4, 20); g.globalAlpha = 1;
      }
      g.font = '600 11px "Chakra Petch", sans-serif';
    }
    const sx = this.tx(this.h.start());
    if (sx >= GUT) { g.fillStyle = '#8ff0cf'; g.beginPath(); g.moveTo(sx - 6, 16); g.lineTo(sx + 6, 16); g.lineTo(sx, 24); g.fill(); }
    g.fillStyle = '#0a0b0d'; g.fillRect(0, 0, GUT, RULER);
    // corner: full-screen toggle
    const fs = this.h.velLane?.();
    g.strokeStyle = fs ? '#8ff0cf' : '#6f7a85'; g.lineWidth = 1.5; g.beginPath();
    const cx = 8, cy = 6, sz = 12, a = 4;
    if (!fs) { g.moveTo(cx, cy + a); g.lineTo(cx, cy); g.lineTo(cx + a, cy); g.moveTo(cx + sz - a, cy); g.lineTo(cx + sz, cy); g.lineTo(cx + sz, cy + a); g.moveTo(cx + sz, cy + sz - a); g.lineTo(cx + sz, cy + sz); g.lineTo(cx + sz - a, cy + sz); g.moveTo(cx + a, cy + sz); g.lineTo(cx, cy + sz); g.lineTo(cx, cy + sz - a); }
    else { g.moveTo(cx + a, cy); g.lineTo(cx + a, cy + a); g.lineTo(cx, cy + a); g.moveTo(cx + sz - a, cy); g.lineTo(cx + sz - a, cy + a); g.lineTo(cx + sz, cy + a); g.moveTo(cx + sz, cy + sz - a); g.lineTo(cx + sz - a, cy + sz - a); g.lineTo(cx + sz - a, cy + sz); g.moveTo(cx + a, cy + sz); g.lineTo(cx + a, cy + sz - a); g.lineTo(cx, cy + sz - a); }
    g.stroke();
    if (GUT >= 90) { g.fillStyle = fs ? '#8ff0cf' : '#57616c'; g.fillText(this.mode === 'rhythm' ? 'STEPS' : 'KEYS', 26, 16); }
  }

  // ---------- input ----------
  pt(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  hit(R, x, y) {
    const row = this.rowAt(R, y), tk = this.xt(x);
    const notes = this.track.notes;
    for (let i = notes.length - 1; i >= 0; i--) { const n = notes[i]; if (this.rowOf(R, n.n) === row && tk >= n.t && tk < n.t + Math.max(n.d, 8 / V.ppx)) return n; }
    return null;
  }
  down(e) {
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* synthetic or already released */ }
    const p = this.pt(e); this.ptrs.set(e.pointerId, p);
    if (this.ptrs.size === 2) { this.startGesture(); return; }
    if (this.ptrs.size > 2) return;
    const R = this.rows(); p.sx = p.x; p.sy = p.y;
    if (p.y < RULER && p.x < this.gut) { this.act = { k: 'corner', p }; return; }
    if (p.y < RULER) { this.act = { k: 'ruler', p, x0: V.x0 }; return; }
    if (p.y >= this.cv.clientHeight - STRIP) { this.act = { k: 'strip', p }; this.scrub(p.x); return; }
    if (this.vh() && p.y >= this.cv.clientHeight - STRIP - this.vh()) { if (p.x < this.gut) return; this.act = { k: 'vel', p, pushed: false }; this.velPaint(p); return; }
    if (p.x < this.gut) { this.act = { k: 'gutter', p, y0: this.y0(R), row: this.rowAt(R, p.y) }; return; }
    if (this.mode === 'rhythm' && this.h.tool() === 'select') { this.act = { k: 'box', p, add: e.shiftKey, moved: false }; return; }
    if (this.mode === 'rhythm') { this.act = { k: 'tap', p, x0: V.x0, y0: this.y0(R), done: new Set(), val: null }; return; } // tap toggles, drag scrolls
    const n = this.hit(R, p.x, p.y);
    if (n) {
      if (!sel.has(n)) { if (!e.shiftKey) sel.clear(); sel.add(n); }
      const edge = this.tx(n.t + n.d) - p.x;
      const orig = [...sel].map((x) => ({ x, t: x.t, d: x.d, n: x.n, r: this.rowOf(R, x.n) }));
      this.act = { k: edge < Math.min(14, (n.d * V.ppx) / 3) ? 'resize' : 'move', p, n, orig, a: { t: n.t, d: n.d, r: this.rowOf(R, n.n) }, moved: false };
      this.draw();
    } else if (this.h.tool() === 'draw') this.act = { k: 'create', p, moved: false };
    else this.act = { k: 'box', p, add: e.shiftKey, moved: false };
  }
  move(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    const p = this.pt(e); Object.assign(this.ptrs.get(e.pointerId), p);
    if (this.gest) { this.doGesture(); return; }
    const a = this.act; if (!a) return;
    const R = this.rows(), dx = p.x - a.p.sx, dy = p.y - a.p.sy, far = Math.abs(dx) + Math.abs(dy) > 5;
    const g = this.h.snap();
    if (a.k === 'strip') { this.scrub(p.x); return; }
    if (a.k === 'vel') { this.velPaint(p); return; }
    if (a.k === 'ruler') { if (far) a.moved = true; if (a.moved) { V.x0 = a.x0 - dx / V.ppx; this.h.manual?.(); this.h.redraw(); } return; }
    if (a.k === 'gutter') { if (far) a.moved = true; if (a.moved) { this.setY0(R, a.y0 - dy / R.h); this.h.manual?.(); this.draw(); } return; }
    if (a.k === 'tap') { if (far) a.moved = true; if (a.moved) { V.x0 = a.x0 - dx / V.ppx; this.setY0(R, a.y0 - dy / R.h); this.h.manual?.(); this.h.redraw(); } return; }
    if (!a.moved && !far) return;
    if (!a.moved) { a.moved = true; if (a.k !== 'box') pushUndo(); if (a.k === 'create') this.startCreate(R, a); }
    if (a.k === 'move') {
      const nt = Math.max(0, snapRound(a.a.t + dx / V.ppx, g)), dt = nt - a.a.t;
      const dr = Math.round(dy / R.h), before = a.n.n;
      for (const o of a.orig) { o.x.t = Math.max(0, o.t + dt); o.x.n = this.pitchOf(R, o.r + dr); }
      if (a.n.n !== before) this.h.preview(a.n.n, a.n.v);
    } else if (a.k === 'resize' || a.k === 'create') {
      const end = a.a.t + a.a.d, ne = Math.max(a.a.t + Math.min(g, 15), snapRound(end + dx / V.ppx, g)), dd = ne - end;
      for (const o of a.orig) o.x.d = Math.max(Math.min(g, 15), o.d + dd);
      this.lastLen = a.n.d;
    } else if (a.k === 'box') {
      const x = Math.min(a.p.sx, p.x), y = Math.min(a.p.sy, p.y);
      this.box = { x, y, w: Math.abs(dx), h: Math.abs(dy) };
    }
    this.draw(); this.h.edited(false);
  }
  up(e, cancel = false) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.delete(e.pointerId);
    if (this.gest) { if (this.ptrs.size < 2) this.gest = null; this.act = null; return; }
    const a = this.act; this.act = null; if (!a || cancel) { this.box = null; this.draw(); return; }
    const R = this.rows(), g = this.h.snap();
    if (a.k === 'corner') { this.h.toggleFocus?.(); return; }
    if (a.k === 'vel') { this.velRead = null; if (a.pushed) this.h.edited(true); this.draw(); return; }
    if (a.k === 'ruler' && !a.moved) this.h.setStart(Math.max(0, snapFloor(this.xt(a.p.sx), STEP * 4)));
    else if (a.k === 'gutter' && !a.moved) this.h.preview(this.pitchOf(R, a.row), 100);
    else if (a.k === 'tap') { if (!a.moved) { this.paint(R, a.p, a); if (a.val !== null) this.h.edited(true); } }
    else if (a.k === 'create' && !a.moved) {
      const tk = this.xt(a.p.sx); if (tk >= lenTicks()) return;
      pushUndo();
      const n = { t: Math.max(0, snapFloor(tk, g)), d: Math.max(g, this.lastLen), n: this.pitchOf(R, this.rowAt(R, a.p.sy)), v: this.h.vel() };
      this.track.notes.push(n); sel.clear(); sel.add(n); this.h.preview(n.n, n.v); this.h.edited(true);
    } else if (a.k === 'box') {
      if (!a.moved) { sel.clear(); }
      else {
        const b = this.box; if (!a.add) sel.clear();
        for (const n of this.track.notes) {
          const r = this.rowOf(R, n.n), x1 = this.tx(n.t), x2 = this.tx(n.t + n.d), y1 = this.ry(R, r), y2 = y1 + R.h;
          if (x2 >= b.x && x1 <= b.x + b.w && y2 >= b.y && y1 <= b.y + b.h) sel.add(n);
        }
      }
      this.box = null; this.h.selChanged();
    } else if ((a.k === 'move' || a.k === 'resize') && !a.moved) this.h.preview(a.n.n, a.n.v);
    if ((a.moved && a.k !== 'box') || a.k === 'create') this.h.edited(true);
    this.h.selChanged(); this.draw();
  }
  startCreate(R, a) {
    const g = this.h.snap(), tk = this.xt(a.p.sx);
    const n = { t: Math.max(0, snapFloor(tk, g)), d: g, n: this.pitchOf(R, this.rowAt(R, a.p.sy)), v: this.h.vel() };
    this.track.notes.push(n); sel.clear(); sel.add(n); this.h.preview(n.n, n.v);
    a.n = n; a.a = { t: n.t, d: n.d }; a.orig = [{ x: n, t: n.t, d: n.d }]; a.k = 'create';
  }
  paint(R, p, a = this.act) {
    const row = this.rowAt(R, p.y), s = Math.floor(this.xt(p.x) / STEP);
    if (row < 0 || row >= R.n || s < 0 || s * STEP >= lenTicks()) return;
    const key = row * 4096 + s; if (a.done.has(key)) return; a.done.add(key);
    const t = this.track, n = this.pitchOf(R, row);
    const here = t.notes.filter((x) => x.n === n && x.t >= s * STEP && x.t < (s + 1) * STEP);
    if (a.val === null) { a.val = !here.length; pushUndo(); }
    if (a.val && !here.length) { t.notes.push({ t: s * STEP, d: STEP, n, v: this.h.vel() }); this.h.preview(n, this.h.vel()); }
    else if (!a.val && here.length) t.notes = t.notes.filter((x) => !here.includes(x));
    this.draw(); this.h.edited(false);
  }
  startGesture() {
    const [a, b] = [...this.ptrs.values()], R = this.rows();
    // undo a single-finger edit that the second finger interrupted before it moved
    this.act = null; this.box = null;
    this.gest = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y), ppx: V.ppx, x0: V.x0, h: R.key === 'keys' ? V.keysH : V.rowsH, y0: this.y0(R) };
  }
  doGesture() {
    this.h.manual?.();
    const [a, b] = [...this.ptrs.values()], G = this.gest, R = this.rows();
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    const tAt = G.x0 + (G.cx - this.gut) / G.ppx;
    if (G.dx > 40) V.ppx = clamp(G.ppx * (dx / G.dx), 0.02, 1.6);
    V.x0 = tAt - (cx - this.gut) / V.ppx;
    if (this.mode === 'keys') {
      const rAt = G.y0 + (G.cy - RULER) / G.h;
      if (G.dy > 40) { const h = clamp(G.h * (dy / G.dy), 7, 48); if (R.key === 'keys') V.keysH = h; else V.rowsH = h; }
      const R2 = this.rows(); this.setY0(R2, rAt - (cy - RULER) / R2.h);
    }
    this.h.redraw();
  }
  wheel(e) {
    e.preventDefault(); this.h.manual?.();
    const R = this.rows(), p = this.pt(e);
    if (e.ctrlKey || e.metaKey) { const tAt = this.xt(p.x); V.ppx = clamp(V.ppx * Math.exp(-e.deltaY * 0.006), 0.02, 1.6); V.x0 = tAt - (p.x - this.gut) / V.ppx; }
    else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || this.mode === 'rhythm') V.x0 += (e.deltaX || e.deltaY) / V.ppx;
    else this.setY0(R, this.y0(R) + e.deltaY / R.h / 2);
    this.h.redraw();
  }
  scrub(x) { this.h.manual?.(); const W = this.cv.clientWidth, len = lenTicks(), vis = (W - this.gut) / V.ppx; V.x0 = ((x - this.gut) / (W - this.gut)) * len - vis / 2; this.clampX(); this.h.redraw(); }
  /** Auto: size the view to the notes on this track (the whole song if it's empty). */
  fit() {
    const t = this.track, W = this.cv.clientWidth - this.gut, len = lenTicks(); if (W <= 0) return;
    const ns = t.notes.filter((n) => n.t < len);
    let a = 0, b = len;
    if (ns.length) { a = Math.floor(Math.min(...ns.map((n) => n.t)) / BAR) * BAR; b = Math.min(len, Math.max(a + BAR, Math.ceil(Math.max(...ns.map((n) => n.t + n.d)) / BAR) * BAR)); }
    let ppx = W / (b - a);
    if (this.mode === 'rhythm') ppx = Math.max(ppx, 30 / STEP);   // keys stay big enough to tap
    V.ppx = clamp(ppx, 0.02, 1.6); V.x0 = a;
    if (this.mode === 'keys' && !t.drum) {
      if (ns.length) {
        const ps = ns.map((n) => n.n).sort((x, y) => x - y), lo = ps[0] - 2, hi = ps.at(-1) + 2, rows = hi - lo + 1;
        V.keysH = clamp(this.area() / rows, 9, 30);
        const vis = this.area() / V.keysH, mid = ps[Math.floor(ps.length / 2)];
        // everything fits: centre the range; too tall: centre on the middle of the part
        this.setY0(this.rows(), vis >= rows ? 127 - hi - (vis - rows) / 2 : 127 - mid - vis / 2);
      } else { V.keysH = 14; this.centerOn(66); }
    } else V.rowsY = 0;
    this.clampX();
  }
  /** Zoom around the middle of the view (toolbar buttons). */
  zoom(f) { this.h.manual?.(); const W = this.cv.clientWidth, mid = this.xt((W + this.gut) / 2); V.ppx = clamp(V.ppx * f, 0.02, 1.6); V.x0 = mid - (W - this.gut) / 2 / V.ppx; this.h.redraw(); }
  follow(pos) { const W = this.cv.clientWidth, x = this.tx(pos); if (x > W - 20 || x < this.gut) { V.x0 = pos - 4 / V.ppx; } }
}
const GROUP = ['#ff3b2f', '#ff8a1f', '#ffd21f', '#f2efe6'];
function mix(a, b, f) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',')})`;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, Math.max(0, w), Math.max(0, h), r) : g.rect(x, y, w, h); }
function fit(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 2 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
