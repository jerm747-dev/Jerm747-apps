/* Standard gamepads only. The cabinet owns Start and suspends this frame's clock. */
(() => {
  'use strict';
  const actions = new Map([[0,'accept'],[1,'back'],[2,'alternate'],[3,'tools'],
    [4,'previous'],[5,'next'],[12,'up'],[13,'down'],[14,'left'],[15,'right']]);
  const directions = ['up','down','left','right'];
  const isDirection = action => directions.includes(action);
  function listen(handle) {
    let previous = new Set(), ready = false;
    const repeats = new Map();
    function reset() { ready = false; previous.clear(); repeats.clear(); }
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) { reset(); return; }
      let pads;
      try { pads = Array.from(navigator.getGamepads?.() || []).filter(p => p && p.connected !== false && p.mapping === 'standard'); }
      catch { reset(); return; }
      const help = document.getElementById('controller-guide');
      if (help) help.hidden = pads.length === 0;
      if (!pads.length) { reset(); return; }
      const held = new Set();
      for (const pad of pads) {
        for (const [index,action] of actions) {
          if (pad.buttons[index]?.pressed || pad.buttons[index]?.value > .55) held.add(action);
        }
        const [x = 0, y = 0] = pad.axes;
        if (Math.max(Math.abs(x), Math.abs(y)) >= .6) {
          held.add(Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down'));
        }
      }
      // The press used to enter the game or dismiss the visor must be released first.
      if (!ready) { ready = !held.size; return; }
      for (const action of held) {
        const first = !previous.has(action);
        if (!first && !(isDirection(action) && now >= repeats.get(action))) continue;
        if (isDirection(action)) repeats.set(action, now + (first ? 390 : 135));
        document.documentElement.classList.add('using-gamepad');
        handle(action);
      }
      previous = held;
    }
    addEventListener('arcade-visor-resume', reset);
    addEventListener('pageshow', reset);
    addEventListener('pointerdown', () => document.documentElement.classList.remove('using-gamepad'), true);
    requestAnimationFrame(frame);
  }
  function focus(el) {
    if (!el) return;
    el.focus({preventScroll:true});
    el.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function controls(scope, exclude) {
    return [...scope.querySelectorAll('button, summary, select, input:not([type=hidden])')].filter(el =>
      !el.disabled && !el.closest('[hidden],[inert]') && el.getClientRects().length &&
      !(exclude && el.closest(exclude)));
  }
  function moveInList(items, action) {
    const delta = action === 'left' || action === 'up' ? -1 : 1;
    const index = items.indexOf(document.activeElement);
    focus(items[index < 0 ? 0 : (index + delta + items.length) % items.length]);
  }
  // Selects and sliders stay inline so gamepad input never depends on an OS picker.
  function menu(items, action) {
    if (!items.length) return;
    const current = items.includes(document.activeElement) ? document.activeElement : items[0];
    if (current.tagName === 'SELECT' && ['left','right'].includes(action)) {
      const options = [...current.options].filter(o => !o.disabled);
      if (!options.length) return;
      const index = options.indexOf(current.selectedOptions[0]);
      current.value = options[(index + (action === 'left' ? -1 : 1) + options.length) % options.length].value;
      current.dispatchEvent(new Event('change',{bubbles:true})); focus(current); return;
    }
    if (current.type === 'range' && ['left','right'].includes(action)) {
      if (action === 'left') current.stepDown(); else current.stepUp();
      current.dispatchEvent(new Event('input',{bubbles:true})); focus(current); return;
    }
    if (isDirection(action)) moveInList(items, action);
    else if (action === 'accept') {
      focus(current);
      if (current.tagName === 'SELECT') menu(items,'right');
      else current.click();
    }
  }
  window.Jerm747Pad = Object.freeze({listen, isDirection, focus, controls, menu});
})();
