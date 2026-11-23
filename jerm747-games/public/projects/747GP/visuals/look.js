/* 747 GP display-referred look. Settings and the colour transform are shared by all screens. */
(() => {
  'use strict';
  const key = 'gp747.visuals.v1';
  const defaults = { enabled: true, warmth: 18, light: 24, glow: 28, sharpness: 42, motion: 40 };
  const settings = { ...defaults };
  const listeners = new Set();
  const clamp = x => Math.max(0, Math.min(1, x));
  function read() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch (_) {}
    for (const [name, value] of Object.entries(defaults)) {
      const v = saved?.[name];
      settings[name] = typeof v !== typeof value ? value :
        name === 'enabled' ? v : Number.isFinite(v) ? Math.round(clamp(v / 100) * 100) : value;
    }
  }
  read();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function set(changes) {
    Object.assign(settings, changes);
    try { localStorage.setItem(key, JSON.stringify(settings)); } catch (_) {}
    refresh();
  }
  function ramp(a, b, x) {
    const t = clamp((x-a)/(b-a));
    return t*t*(3-2*t);
  }
  // All grading is in display sRGB, after the game's own lighting and tone mapping.
  function grade(r, g, b) {
    const y = .2126*r + .7152*g + .0722*b;
    const red = ramp(.012, .33, r - Math.max(g,b));
    const blue = ramp(.012, .33, b - Math.max(r,g));
    const peak = Math.max(r,g,b);
    const chroma = peak - Math.min(r,g,b);
    const strength = 1 + .055*red + .075*blue;
    const density = (.027*red + .020*blue) * (.42 + .58*peak);
    const warm = settings.warmth/100 * .092 * ramp(.22,.76,y) *
      (1-ramp(.83,1,y)) * (1-ramp(.08,.46,chroma));
    const lift = settings.light/100 * .113;
    function channel(c, tint) {
      const v = clamp(y + (c-y)*strength);
      const range = v*(1-v);
      // Black and white are fixed points. A gradual toe leaves tyre and asphalt detail.
      return clamp(v + range*((v-.51)*.50 + lift - density*3.6) + tint*warm);
    }
    return [channel(r,1), channel(g,.18), channel(b,-.70)];
  }
  const size = 32;
  function fillLut(bytes) {
    let i = 0;
    for (let g = 0; g < size; g++) {
      for (let b = 0; b < size; b++) {
        for (let r = 0; r < size; r++) {
          const c = grade(r/(size-1), g/(size-1), b/(size-1));
          bytes[i++] = Math.round(255*c[0]); bytes[i++] = Math.round(255*c[1]);
          bytes[i++] = Math.round(255*c[2]); bytes[i++] = 255;
        }
      }
    }
  }
  // Menus use the neutral axis of the same transform plus a mild red/blue colour matrix.
  // SVG affects colour only, so lettering and course diagrams retain their original edges.
  const ns = 'http://www.w3.org/2000/svg';
  let curves = [], panel, colorOnly=false;
  function mount() {
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width','0'); svg.setAttribute('height','0');
    svg.style.position='absolute'; svg.setAttribute('aria-hidden','true');
    svg.innerHTML = '<defs><filter id="gp-menu-tone" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix values="1.025 -.025 0 0 0  0 1 0 0 0  0 -.034 1.034 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="table"/><feFuncG type="table"/><feFuncB type="table"/></feComponentTransfer></filter></defs>';
    document.body.prepend(svg);
    curves = [...svg.querySelector('feComponentTransfer').children];
    panel = document.querySelector('[data-gp-visuals]');
    if (panel) {
      panel.innerHTML = '<summary>Visual effects</summary><div class="gp-tune"><label class="gp-enable"><span>Effects enabled</span><input type="checkbox" name="enabled"></label></div>';
      const box = panel.lastElementChild;
      const labels = { warmth:'Warmth', light:'Light', glow:'Highlight glow', sharpness:'Sharpness', motion:'Race motion blur' };
      for (const [name, label] of Object.entries(labels)) {
        const row = document.createElement('label');
        row.innerHTML = '<span>'+label+'</span><output></output><input type="range" name="'+name+'" min="0" max="100" step="1" aria-label="'+label+'">';
        box.append(row);
      }
      const reset = document.createElement('button');
      reset.type='button'; reset.textContent='Restore defaults';
      reset.onclick=() => set(defaults);
      box.append(reset);
      const status=document.createElement('p');
      status.className='gp-status'; status.textContent='This renderer supports color grading only.';
      box.append(status);
      panel.addEventListener('input', e => {
        const el=e.target;
        if (Object.hasOwn(defaults,el.name)) set({[el.name]:el.name==='enabled' ? el.checked : +el.value});
      });
      panel.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key==='Escape') { panel.open=false; panel.querySelector('summary').focus(); }
      });
    }
    refresh();
  }
  let colorKey = '';
  function refresh() {
    document.documentElement.classList.toggle('gp-graded', settings.enabled);
    const next = settings.warmth+'/'+settings.light;
    if (curves.length && next !== colorKey) {
      colorKey = next;
      const tables = [[],[],[]];
      for (let i=0; i<=64; i++) {
        const v=i/64;
        grade(v,v,v).forEach((c,j)=>tables[j].push(c.toFixed(5)));
      }
      curves.forEach((c,i)=>c.setAttribute('tableValues',tables[i].join(' ')));
    }
    if (panel) {
      panel.querySelector('.gp-status').hidden=!colorOnly;
      for (const el of panel.querySelectorAll('input')) {
        if (el.name==='enabled') el.checked=settings.enabled;
        else {
          el.value=settings[el.name]; el.disabled=!settings.enabled || (colorOnly && ['sharpness','glow','motion'].includes(el.name));
          el.previousElementSibling.value=el.value+'%';
        }
      }
    }
    for (const fn of listeners) fn();
  }
  document.addEventListener('DOMContentLoaded', mount, {once:true});
  addEventListener('pageshow', () => {read(); refresh();});
  addEventListener('storage',e => {if (!e.key || e.key===key) {read(); refresh();}});
  window.GPVisuals = { settings, size, fillLut, listeners,
    setColorOnly() {colorOnly=true; refresh();},
    motionAmount(speedFraction) {
      return settings.enabled && !reduced.matches ? settings.motion/100 * ramp(.37,.86,speedFraction) : 0;
    }
  };
})();
