import * as pads from '../engine/pads.js';
import * as synth from '../engine/synth.js';
import * as map from '../engine/padMap.js';

const modules = '.tool-tray,.plate,.metro,.tuner,.master,.songbar,.drive,.tape-section,.pads-section,.vinyl-section,.synth-section';
const controls = 'button:not(:disabled),select:not(:disabled),input:not(:disabled):not([hidden]),[role="slider"],[data-note]';
const visible = el => !!el?.getClientRects().length && !el.closest('[hidden],[inert]');
const within = (el, selector) => [...el.querySelectorAll(selector)].filter(visible);
const cycle = (items, i, delta) => items[(i + delta + items.length) % items.length];
const keyEvent = key => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
const zone = value => Math.abs(value) < 0.12 ? 0 : Math.sign(value) * (Math.abs(value) - 0.12) / 0.88;

export function installController() {
  let section = null, inside = false, heldNote = null, bend = 0, vibrato = 0, choosing = null;
  let previous = [], previousPad = '', requireNeutral = false, flickReady = true;
  let lastMove = '', moveAt = 0, knobAt = 0, frame = 0, hidden = false;

  function stopNote() {
    if (heldNote != null) synth.noteOff(heldNote);
    heldNote = null;
  }
  function pitch(value, depth = 0) {
    if (value !== bend || depth !== vibrato) {
      synth.setControllerExpression(value * synth.BEND, depth);
      bend = value; vibrato = depth;
    }
  }
  function stopExpression() { stopNote(); pitch(0); }
  function finishChoice(apply) {
    if (!choosing) return;
    const { el, original } = choosing;
    choosing = null;
    delete el.dataset.padChoosing;
    if (apply && el.selectedIndex !== original) el.dispatchEvent(new Event('change', { bubbles: true }));
    else el.selectedIndex = original;
  }
  function clearFocus() {
    document.querySelector('[data-pad-section]')?.removeAttribute('data-pad-section');
    document.querySelector('[data-pad-focus]')?.removeAttribute('data-pad-focus');
  }
  function focus(el, internal) {
    if (!el) return;
    if (el !== document.activeElement) { finishChoice(false); stopExpression(); }
    clearFocus();
    section = el.closest(modules);
    inside = internal;
    if (!section) return;
    section.dataset.padSection = internal ? 'inside' : 'outside';
    if (!internal) section.tabIndex = -1;
    el.dataset.padFocus = '';
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function availableSections() {
    const full = document.fullscreenElement || document.querySelector('.section.is-max');
    return full?.matches(modules) ? [full] : within(document, modules);
  }
  function sectionStep(delta) {
    const all = availableSections(), index = all.indexOf(section);
    focus(index < 0 ? (delta < 0 ? all.at(-1) : all[0]) : cycle(all, index, delta), false);
  }
  function entry() {
    const all = availableSections();
    if (!all.includes(section)) section = all.includes(document.querySelector('.pads-section')) ? document.querySelector('.pads-section') : all[0];
    if (!section) return;
    focus(section.querySelector('.step') || within(section, controls)[0], true);
  }
  function stepState(el, on) {
    if (el?.matches('.step') && (el.getAttribute('aria-pressed') === 'true') !== on) el.click();
  }
  function adjust(el, delta) {
    if (el?.matches('[role="slider"]')) el.dispatchEvent(keyEvent(delta > 0 ? 'ArrowUp' : 'ArrowDown'));
    else if (el?.matches('input[type="range"]')) {
      const step = Number(el.step) || 1, span = Number(el.max || 100) - Number(el.min || 0);
      const value = Number(el.value) + delta * Math.max(1, Math.round(span / (40 * step))) * step;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function choose(delta) {
    const el = choosing.el, options = [...el.options].filter(o => !o.disabled);
    if (!options.length) return;
    const i = options.indexOf(el.selectedOptions[0]);
    el.selectedIndex = (i < 0 ? (delta < 0 ? options.at(-1) : options[0]) : cycle(options, i, delta)).index;
  }
  function move(direction) {
    const delta = ['left', 'up'].includes(direction) ? -1 : 1;
    if (choosing) { choose(delta); return; }
    if (!inside) { sectionStep(delta); return; }
    const el = document.activeElement, all = within(section, controls);
    if (!all.includes(el)) { entry(); return; }
    const horizontal = direction === 'left' || direction === 'right';
    const row = el.closest('.pad-row');
    if (row) {
      const items = within(row, controls), col = items.indexOf(el);
      if (horizontal) { focus(items[Math.max(0, Math.min(items.length - 1, col + delta))], true); return; }
      const rows = within(section, '.pad-row'), next = rows[rows.indexOf(row) + delta];
      if (next) { focus(within(next, controls)[col], true); return; }
      const edge = delta < 0 ? items[0] : items.at(-1);
      focus(all[all.indexOf(edge) + delta], true); return;
    }
    if (el.matches('[data-note]') && !horizontal) {
      const keys = within(section, '[data-note]');
      const edge = direction === 'up' ? keys[0] : keys.at(-1);
      focus(cycle(all, all.indexOf(edge), delta), true); return;
    }
    focus(cycle(all, all.indexOf(el), delta), true);
  }
  function shoulder(delta) {
    if (!inside) { sectionStep(delta); return; }
    if (choosing) { choose(delta); return; }
    const el = document.activeElement;
    if (el.closest('.pad-row,.page-bar') && section.querySelector('.page-btn')) {
      const pages = within(section, '.page-btn');
      cycle(pages, pages.indexOf(section.querySelector('.page-btn.sel')), delta)?.click();
      return;
    }
    const tabs = el.closest('[role="tablist"]') || el.closest('.osc-tabs')?.querySelector('[role="tablist"]');
    if (tabs) {
      const items = within(tabs, '[role="tab"]');
      const tab = cycle(items, items.indexOf(tabs.querySelector('[aria-selected="true"]')), delta);
      if (tab) { tab.click(); focus(tab, true); }
      return;
    }
    move(delta > 0 ? 'right' : 'left');
  }
  function accept() {
    if (!inside) { entry(); return; }
    const el = document.activeElement;
    if (!section?.contains(el)) { entry(); return; }
    if (el.matches('select')) {
      if (choosing) finishChoice(true);
      else { choosing = { el, original: el.selectedIndex }; el.dataset.padChoosing = ''; }
    } else if (el.matches('[data-note]')) {
      heldNote = Number(el.dataset.note); synth.noteOn(heldNote);
    } else if (el.matches('.perf-pad')) el.dispatchEvent(keyEvent('Enter'));
    else if (el.matches('button,input')) el.click();
  }
  function resetInput() {
    stopExpression(); finishChoice(false); lastMove = ''; flickReady = false; requireNeutral = true;
  }
  function suspended() { hidden = document.hidden; resetInput(); }
  function keyboard(e) {
    if (e.altKey || e.metaKey || e.ctrlKey || e.target.closest?.('input,select,textarea,[contenteditable="true"]')) return;
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      section = e.target.closest?.(modules) || section;
      sectionStep(e.key === 'PageUp' ? -1 : 1);
    } else if (e.target.matches?.(modules) && (e.key === 'Enter' || e.key === ' ')) entry();
    else if (e.target.closest?.('.pad-row') && e.key.startsWith('Arrow')) {
      section = e.target.closest(modules); inside = true;
      if (e.shiftKey && ['ArrowUp','ArrowDown'].includes(e.key)) stepState(e.target, e.key === 'ArrowUp');
      else move(e.key.slice(5).toLowerCase());
    } else return;
    e.preventDefault();
  }
  function pointer() {
    clearFocus(); finishChoice(false); stopExpression();
  }
  function syncFocus(e) {
    if (!e.target.closest || e.target.hasAttribute('data-pad-focus')) return;
    clearFocus(); finishChoice(false); stopExpression();
    section = e.target.closest(modules); inside = !!section && e.target !== section;
  }
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (hidden || document.hidden || window.ArcadeGameClock?.held) return;
    let pad;
    try { pad = Array.from(navigator.getGamepads?.() || []).find(p => p && p.connected !== false); } catch { return; }
    if (!pad) {
      if (previousPad) { resetInput(); previousPad = ''; previous = []; }
      return;
    }
    const id = pad.index + ':' + pad.id;
    if (previousPad && previousPad !== id) resetInput();
    previousPad = id;
    const down = Array.from(pad.buttons, b => !!b?.pressed || b?.value > 0.55);
    const edges = down.flatMap((on, i) => on && !previous[i] ? [i] : []);
    previous = down;
    const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
    if (requireNeutral) {
      if (!down.some(Boolean) && [lx, ly, rx, ry].every(x => Math.abs(x) < 0.35)) { requireNeutral = false; flickReady = true; }
      return;
    }
    const state = map.get();
    if (state.learning != null) {
      if (edges.includes(8)) map.cancelLearn();
      else if (edges.length) map.bind(edges[0]);
      lastMove = ''; return;
    }
    if (edges.includes(8)) {
      stopExpression(); map.performMode(!state.performing); lastMove = '';
      const panel = document.querySelector('.pad-mapping button');
      if (panel && availableSections().includes(panel.closest(modules))) focus(panel, true);
      return;
    }
    if (state.performing) {
      for (const i of edges) {
        const row = state.buttons.indexOf(i);
        if (row >= 0 && pads.getRows()[row]?.src) pads.perform(row);
      }
      lastMove = ''; return;
    }
    if (!down[0]) stopNote();
    if (edges.includes(6) || edges.includes(7)) sectionStep(edges.includes(6) ? -1 : 1);
    else if (edges.includes(4) || edges.includes(5)) shoulder(edges.includes(4) ? -1 : 1);
    else if (edges.includes(1)) {
      if (choosing) finishChoice(false);
      else if (section) focus(section, false);
    } else if (edges.includes(0)) accept();
    else if (edges.includes(3) && section?.matches('.synth-section') && !document.activeElement.matches('[role="slider"],input[type="range"]')) {
      focus(section.querySelector('[data-note]'), true);
    }
    const direction = down[12] ? 'up' : down[13] ? 'down' : down[14] ? 'left' : down[15] ? 'right'
      : Math.max(Math.abs(lx), Math.abs(ly)) < 0.55 ? '' : Math.abs(lx) > Math.abs(ly) ? (lx < 0 ? 'left' : 'right') : (ly < 0 ? 'up' : 'down');
    if (direction && (lastMove !== direction || now >= moveAt)) {
      move(direction); moveAt = now + (lastMove === direction ? 125 : 360);
    }
    lastMove = direction;
    const el = document.activeElement;
    if (Math.abs(ry) < 0.35) flickReady = true;
    if (!inside) return;
    if (el.matches('.step')) {
      if (flickReady && Math.abs(ry) >= 0.78) { stepState(el, ry < 0); flickReady = false; }
      if (edges.includes(2) || edges.includes(3)) stepState(el, edges.includes(3));
    } else if (el.matches('[role="slider"],input[type="range"]')) {
      const axis = Math.abs(ry) >= Math.abs(rx) ? -ry : rx;
      if (edges.includes(2) || edges.includes(3)) adjust(el, edges.includes(3) ? 1 : -1);
      else if (Math.abs(axis) > 0.3 && now >= knobAt) { adjust(el, Math.sign(axis)); knobAt = now + 190 - Math.min(1, Math.abs(axis)) * 112; }
    }
    if (el.closest('.kb')) pitch(zone(rx), Math.max(0, zone(-ry)));
    else pitch(0);
  }
  window.addEventListener('keydown', keyboard);
  document.addEventListener('pointerdown', pointer, true);
  document.addEventListener('focusin', syncFocus);
  document.addEventListener('visibilitychange', suspended);
  window.addEventListener('arcade-visor-hold', resetInput);
  window.addEventListener('blur', resetInput);
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame); resetInput(); clearFocus();
    window.removeEventListener('keydown', keyboard);
    document.removeEventListener('pointerdown', pointer, true);
    document.removeEventListener('focusin', syncFocus);
    document.removeEventListener('visibilitychange', suspended);
    window.removeEventListener('arcade-visor-hold', resetInput);
    window.removeEventListener('blur', resetInput);
  };
}
