// The instrument rack, Reason-style: each instrument starts as one slim strip (name, preset, two
// main knobs). Tap the strip to fold it open into its sections; tap a section to open that part.
// Avionyx: Oscillators · FM · Filter · Envelope · Keys. Drumway: one section per drum.
// Both end with Black Box (tape) and 747 Drive.
import { PRESETS, WAVES, WAVE_NAMES, ALGOS } from './avionyx.js';
import { KITS, VOICES, KNOB_NAMES, defaultKit } from './drumway.js';
import { DRIVE_MODES } from './audio.js';
import { pushUndo, changed } from './model.js';
import { noteName } from './lanes.js';

const open = new Map(); // track id -> Set of open section ids ('' = strip only, 'all' = folded open)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getp = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const setp = (o, path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

// ---------- knob ----------
function knob(path, label, v, { min = 0, max = 1, def = 0, fmt = pct, step = 0 } = {}) {
  const f = (v - min) / (max - min), a0 = -135, a = a0 + f * 270;
  const arc = (from, to) => { const p = (deg) => [24 + 18 * Math.sin((deg * Math.PI) / 180), 24 - 18 * Math.cos((deg * Math.PI) / 180)]; const [x1, y1] = p(from), [x2, y2] = p(to); return `M${x1} ${y1}A18 18 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  return `<div class="knob" data-path="${path}" data-min="${min}" data-max="${max}" data-def="${def}" data-step="${step}" data-fmt="${fmtName(fmt)}" tabindex="0" role="slider" aria-label="${esc(label)}" aria-valuenow="${v}">
    <svg viewBox="0 0 48 48"><path class="k-track" d="${arc(a0, 135)}"/><path class="k-arc" d="${arc(a0, Math.max(a0 + 0.1, a))}"/><circle class="k-body" cx="24" cy="24" r="12"/><line class="k-ptr" x1="24" y1="24" x2="${24 + 10 * Math.sin((a * Math.PI) / 180)}" y2="${24 - 10 * Math.cos((a * Math.PI) / 180)}"/></svg>
    <span class="k-val">${fmt(v)}</span><span class="k-lab">${esc(label)}</span></div>`;
}
const pct = (v) => `${Math.round(v * 100)}`;
const semis = (v) => (v > 0 ? `+${v}` : `${v}`);
const cents = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}c`;
const bip = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
const FMTS = { pct, semis, cents, bip };
const fmtName = (f) => Object.keys(FMTS).find((k) => FMTS[k] === f) || 'pct';
const toggle = (path, label, on) => `<button class="tg ${on ? 'on' : ''}" data-toggle="${path}" aria-pressed="${on}"><i></i>${esc(label)}</button>`;
const select = (path, opts, v) => `<select data-sel="${path}">${Object.entries(opts).map(([k, n]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;

function section(id, title, sum, body, isOpen) {
  return `<section class="rk-sec ${isOpen ? 'open' : ''}" data-sec="${id}"><button class="rk-head" data-tsec="${id}"><span>${esc(title)}</span><small>${esc(sum)}</small><b>${isOpen ? '−' : '+'}</b></button>${isOpen ? `<div class="rk-body">${body}</div>` : ''}</section>`;
}
const fxSections = (t, o) => {
  const tp = t.fx.tape, dr = t.fx.drive;
  return section('tape', 'Black Box', tp.on ? `wow ${pct(tp.wow)} · sat ${pct(tp.sat)}` : 'off', `<div class="row">${toggle('fx.tape.on', 'On', tp.on)}</div><div class="knobs">
      ${knob('fx.tape.wow', 'Wow', tp.wow, { def: 0.25 })}${knob('fx.tape.flutter', 'Flutter', tp.flutter, { def: 0.2 })}${knob('fx.tape.sat', 'Saturate', tp.sat, { def: 0.3 })}
      ${knob('fx.tape.low', 'Low', tp.low, { min: -1, max: 1, fmt: bip })}${knob('fx.tape.high', 'High', tp.high, { min: -1, max: 1, fmt: bip })}</div>`, o.has('tape'))
  + section('drive', '747 Drive', dr.on ? `${DRIVE_MODES[dr.mode]?.name || 'Custom'} · drive ${pct(dr.drive)}` : 'off', `<div class="row">${toggle('fx.drive.on', 'On', dr.on)}${select('fx.drive.mode', Object.fromEntries(Object.entries(DRIVE_MODES).map(([k, m]) => [k, m.name])), dr.mode)}${toggle('fx.drive.glue', 'Glue', dr.glue)}</div><div class="knobs">
      ${knob('fx.drive.drive', 'Drive', dr.drive, { def: 0.25 })}${knob('fx.drive.iron', 'Iron', dr.iron, { def: 0.14 })}${knob('fx.drive.warmth', 'Warmth', dr.warmth, { def: 0.05 })}
      ${knob('fx.drive.air', 'Air', dr.air, { max: 2, step: 1, def: 1, fmt: (v) => ['Off', '+3', '+6'][v] })}${knob('fx.drive.out', 'Output', dr.out, { min: -1, max: 1, fmt: bip })}</div>`, o.has('drive'));
};

// ---------- panels ----------
function avionyx(t, o) {
  const p = t.patch;
  const oscs = p.osc.map((x, i) => `<div class="osc"><div class="row"><b class="on-num">${i + 1}</b>${toggle(`patch.osc.${i}.on`, 'On', x.on)}${select(`patch.osc.${i}.wave`, Object.fromEntries(WAVES.map((w) => [w, WAVE_NAMES[w]])), x.wave)}</div><div class="knobs">
    ${knob(`patch.osc.${i}.coarse`, 'Coarse', x.coarse, { min: -24, max: 24, step: 1, fmt: semis })}${knob(`patch.osc.${i}.fine`, 'Fine', x.fine, { min: -50, max: 50, fmt: cents })}${knob(`patch.osc.${i}.level`, 'Level', x.level, { def: 0.6 })}</div></div>`).join('');
  const kb = keyboard(t);
  return section('osc', 'Oscillators', p.osc.map((x) => (x.on ? WAVE_NAMES[x.wave] : '–')).join(' · '), `<div class="oscs">${oscs}</div>`, o.has('osc'))
    + section('fm', 'FM', p.algo === 'mix' ? 'Mix (no FM)' : `${ALGOS[p.algo]} · depth ${pct(p.fm.depth)}`, `<div class="row">${select('patch.algo', ALGOS, p.algo)}<span class="note">2→1: osc 2 bends osc 1. Mix: all three heard.</span></div><div class="knobs">
      ${knob('patch.fm.depth', 'Depth', p.fm.depth, { def: 0.4 })}${knob('patch.fm.decay', 'FM decay', p.fm.decay, { def: 0.4 })}${knob('patch.fm.sus', 'FM sustain', p.fm.sus, { def: 0.3 })}</div>`, o.has('fm'))
    + section('filter', 'Filter', `cut ${pct(p.filter.cut)} · res ${pct(p.filter.res)}`, `<div class="knobs">${knob('patch.filter.cut', 'Cutoff', p.filter.cut, { def: 0.85 })}${knob('patch.filter.res', 'Resonance', p.filter.res, { def: 0.1 })}${knob('patch.filter.env', 'Env amount', p.filter.env, { def: 0.2 })}</div>`, o.has('filter'))
    + section('env', 'Envelope', `A ${pct(p.env.a)} D ${pct(p.env.d)} S ${pct(p.env.s)} R ${pct(p.env.r)}`, `<div class="knobs">${knob('patch.env.a', 'Attack', p.env.a, { def: 0.05 })}${knob('patch.env.d', 'Decay', p.env.d, { def: 0.35 })}${knob('patch.env.s', 'Sustain', p.env.s, { def: 0.7 })}${knob('patch.env.r', 'Release', p.env.r, { def: 0.3 })}</div>`, o.has('env'))
    + fxSections(t, o)
    + section('keys', 'Keys', 'play to audition', kb, o.has('keys'));
}
const kbOct = new Map();
function keyboard(t) {
  const base = kbOct.get(t.id) ?? 48, keys = [];
  for (let n = base; n < base + 25; n++) keys.push(`<button class="pk ${[1, 3, 6, 8, 10].includes(n % 12) ? 'blk' : ''}" data-play="${n}" aria-label="${noteName(n)}"></button>`);
  return `<div class="row"><button class="sm" data-oct="-12">Oct −</button><span class="note">${noteName(base)}–${noteName(base + 24)}</span><button class="sm" data-oct="12">Oct +</button></div><div class="piano">${keys.join('')}</div>`;
}
function drumway(t, o) {
  const p = t.patch;
  return Object.entries(VOICES).map(([k, vc]) => {
    const kn = p.voices[k];
    return section(`v-${k}`, vc.name, `tune ${bip(kn.tune - 0.5)} · decay ${pct(kn.decay)}`,
      `<div class="row"><button class="sm hit" data-play="${vc.note}">Hit</button></div><div class="knobs">${Object.keys(VOICES[k].knobs).map((kk) => knob(`patch.voices.${k}.${kk}`, KNOB_NAMES[kk], kn[kk], { def: VOICES[k].knobs[kk] })).join('')}</div>`, o.has(`v-${k}`));
  }).join('') + fxSections(t, o);
}

export function renderRack(el, t) {
  if (t.inst === 'none') { el.innerHTML = `<div class="rk-strip none"><span class="rk-name">MIDI only</span><span class="note">No built-in sound. Notes go to the MIDI out.</span><button class="sm" data-inst="${t.drum ? 'drumway' : 'avionyx'}">Use ${t.drum ? 'Drumway' : 'Avionyx'}</button></div>`; return; }
  const o = open.get(t.id) || new Set(), folded = o.has('all');
  const isA = t.inst === 'avionyx', p = t.patch;
  const presets = isA ? PRESETS.map((x) => x.name) : KITS.map((x) => x.name);
  const cur = presets.includes(p.name) ? p.name : '';
  const macros = isA
    ? knob('patch.filter.cut', 'Tone', p.filter.cut, { def: 0.85 }) + knob('patch.vol', 'Level', p.vol, { def: 0.8 })
    : knob('patch.tune', 'Tune', p.tune, { def: 0.5, fmt: (v) => bip(v - 0.5) }) + knob('patch.decay', 'Decay', p.decay, { def: 0.5 });
  el.innerHTML = `<div class="rk ${isA ? 'avx' : 'dwy'} ${folded ? 'folded' : ''}">
    <div class="rk-strip"><button class="rk-fold" data-fold aria-expanded="${folded}"><span class="rk-name">${isA ? 'Avionyx' : 'Drumway'}</span><small>${isA ? 'FM keys synth' : 'drum synth'}</small></button>
      <select data-preset aria-label="Preset">${cur ? '' : `<option value="">${esc(p.name || 'Custom')}</option>`}${presets.map((n) => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="knobs macro">${macros}</div><button class="rk-chev" data-fold aria-label="${folded ? 'Fold' : 'Open'} rack">${folded ? '▴' : '▾'}</button></div>
    ${folded ? `<div class="rk-secs">${isA ? avionyx(t, o) : drumway(t, o)}<div class="row rk-foot"><button class="sm" data-allsec>Open all</button><button class="sm" data-nosec>Close all</button></div></div>` : ''}</div>`;
}

/** Wire one rack container. hooks: track(), refresh(track), preview(track, n, v), rerender() */
export function bindRack(el, hooks) {
  let drag = null;
  const done = () => { const t = hooks.track(); hooks.refresh(t); changed('patch'); };
  el.addEventListener('click', (e) => {
    const t = hooks.track(), b = e.target.closest('button,[data-tsec]'); if (!b) return;
    const o = open.get(t.id) || new Set(); open.set(t.id, o);
    if (b.hasAttribute('data-fold')) { o.has('all') ? o.delete('all') : o.add('all'); hooks.rerender(); }
    else if (b.dataset.tsec) { const id = b.dataset.tsec; o.has(id) ? o.delete(id) : o.add(id); hooks.rerender(); }
    else if (b.hasAttribute('data-allsec')) { el.querySelectorAll('[data-sec]').forEach((s) => o.add(s.dataset.sec)); hooks.rerender(); }
    else if (b.hasAttribute('data-nosec')) { [...o].filter((k) => k !== 'all').forEach((k) => o.delete(k)); hooks.rerender(); }
    else if (b.dataset.toggle) { pushUndo(); setp(t, b.dataset.toggle, !getp(t, b.dataset.toggle)); done(); hooks.rerender(); }
    else if (b.dataset.oct) { kbOct.set(t.id, Math.max(12, Math.min(96, (kbOct.get(t.id) ?? 48) + +b.dataset.oct))); hooks.rerender(); }
    else if (b.dataset.inst) { pushUndo(); t.inst = b.dataset.inst; done(); hooks.rerender(); }
  });
  el.addEventListener('pointerdown', (e) => { const k = e.target.closest('[data-play]'); if (k) { e.preventDefault(); hooks.preview(hooks.track(), +k.dataset.play, 105); } });
  el.addEventListener('change', (e) => {
    const t = hooks.track(), s = e.target;
    if (s.hasAttribute('data-preset')) {
      pushUndo();
      if (t.inst === 'avionyx') { const pr = PRESETS.find((x) => x.name === s.value); if (pr) t.patch = JSON.parse(JSON.stringify(pr)); }
      else { const k = KITS.find((x) => x.name === s.value); t.patch = k ? JSON.parse(JSON.stringify(k)) : defaultKit(); }
      done(); hooks.rerender(); return;
    }
    if (s.dataset.sel) {
      pushUndo();
      const v = s.dataset.sel.endsWith('mode') ? s.value : s.value;
      setp(t, s.dataset.sel, v);
      if (s.dataset.sel === 'fx.drive.mode' && DRIVE_MODES[v]) { const { name, ...m } = DRIVE_MODES[v]; Object.assign(t.fx.drive, m, { on: v === 'clean' ? t.fx.drive.on : true }); }
      if (s.dataset.sel.startsWith('patch.')) t.patch.name = t.patch.name.replace(/\*?$/, '*');
      done(); hooks.rerender();
    }
  });
  // knobs: drag up/down (Shift = fine), double-tap resets, arrow keys nudge
  el.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.knob'); if (!k) return;
    e.preventDefault(); try { k.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const t = hooks.track(), now = performance.now();
    if (drag && drag.k === k && now - drag.at < 300) { pushUndo(); setp(t, k.dataset.path, +k.dataset.def); paint(k, +k.dataset.def); done(); drag = null; return; }
    pushUndo();
    drag = { k, y: e.clientY, v: +getp(t, k.dataset.path), at: now, id: e.pointerId };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const k = drag.k, min = +k.dataset.min, max = +k.dataset.max, st = +k.dataset.step;
    let v = drag.v + ((drag.y - e.clientY) / (e.shiftKey ? 600 : 160)) * (max - min);
    v = Math.max(min, Math.min(max, v)); if (st) v = Math.round(v / st) * st;
    const t = hooks.track(); setp(t, k.dataset.path, v); paint(k, v);
    if (k.dataset.path.startsWith('patch.')) t.patch.name = t.patch.name.replace(/\*?$/, '*');
    hooks.refresh(t);
  });
  const end = (e) => { if (drag && drag.id === e.pointerId) { done(); drag.id = null; } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    const k = e.target.closest('.knob'); if (!k || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); const t = hooks.track(), min = +k.dataset.min, max = +k.dataset.max, st = +k.dataset.step || (max - min) / 50;
    const v = Math.max(min, Math.min(max, +getp(t, k.dataset.path) + (['ArrowUp', 'ArrowRight'].includes(e.key) ? st : -st)));
    setp(t, k.dataset.path, v); paint(k, v); done();
  });
}
function paint(k, v) {
  const min = +k.dataset.min, max = +k.dataset.max, f = (v - min) / (max - min), a0 = -135, a = a0 + f * 270;
  const p = (deg) => [24 + 18 * Math.sin((deg * Math.PI) / 180), 24 - 18 * Math.cos((deg * Math.PI) / 180)];
  const [x1, y1] = p(a0), [x2, y2] = p(Math.max(a0 + 0.1, a));
  k.querySelector('.k-arc').setAttribute('d', `M${x1} ${y1}A18 18 0 ${a - a0 > 180 ? 1 : 0} 1 ${x2} ${y2}`);
  const l = k.querySelector('.k-ptr'); l.setAttribute('x2', 24 + 10 * Math.sin((a * Math.PI) / 180)); l.setAttribute('y2', 24 - 10 * Math.cos((a * Math.PI) / 180));
  const fmt = FMTS[k.dataset.fmt] || pct;
  k.querySelector('.k-val').textContent = k.dataset.path === 'fx.drive.air' ? ['Off', '+3', '+6'][Math.round(v)] : k.dataset.path === 'patch.tune' ? bip(v - 0.5) : fmt(v);
  k.setAttribute('aria-valuenow', v);
}
