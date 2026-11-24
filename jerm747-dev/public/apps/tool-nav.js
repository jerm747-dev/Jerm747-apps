/* Patch Bay tool navigation + tap clean, shared by every tool page (web and Android app).
   - A small ‹ arrow sits beside the app nameplate, and tapping the nameplate itself also goes back to the rack.
   - Tools without a nameplate (Beat Room) get a slim tab on the left edge instead.
   - Tap clean: no grey/blue square flashing around buttons on touch, no focus ring after a tap
     (keyboard focus rings stay for desktop). */
(() => {
  const rack = new URL('./', document.currentScript.src).href;
  const goBack = () => {
    const ref = (document.referrer || '').split(/[?#]/)[0].replace(/index\.html$/, '');
    if (ref === rack && history.length > 1) history.back(); else location.href = rack;
  };
  const css = `
    *{-webkit-tap-highlight-color:transparent}
    button,label,[role=button],a,canvas{-webkit-touch-callout:none}
    :focus:not(:focus-visible){outline:none}
    .pb-up{flex:none;display:inline-grid;place-items:center;width:30px;height:30px;margin:0 4px 0 0;padding:0;
      border-radius:50%;border:1px solid color-mix(in srgb,currentColor 35%,transparent);background:color-mix(in srgb,currentColor 8%,transparent);
      color:inherit;font:700 22px/1 system-ui,sans-serif;text-decoration:none;cursor:pointer;vertical-align:middle;opacity:.8}
    .pb-up span{margin-top:-3px}
    @media(max-width:480px){.pb-up{width:26px;height:26px;font-size:19px;margin-right:2px}}
    .pb-up:hover{opacity:1}
    .pb-up:focus-visible{outline:2px solid currentColor;outline-offset:2px}
    .pb-home{cursor:pointer}
    .pb-back{position:fixed;z-index:2147483000;left:0;top:38%;display:flex;align-items:center;gap:6px;
      height:46px;width:22px;padding:0 0 0 4px;overflow:hidden;white-space:nowrap;border-radius:0 12px 12px 0;
      font:700 12px/1 system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;color:#0e233d;
      background:linear-gradient(90deg,#d9b46c,#f3dca9);border:1px solid #8e754a;border-left:0;
      box-shadow:0 2px 8px #0008,inset 0 1px #fff8;opacity:.6;transition:width .15s,opacity .15s}
    .pb-back span{font-size:20px;line-height:0;margin-top:-2px}
    .pb-back:hover,.pb-back:focus-visible{width:72px;opacity:1}
    :fullscreen .pb-back,:root:has(:fullscreen) .pb-back{display:none}
    @media print{.pb-up,.pb-back{display:none}}`;
  const link = (cls, html) => {
    const a = document.createElement('a');
    a.className = cls; a.href = rack; a.title = 'Back to Patch Bay'; a.setAttribute('aria-label', 'Back to Patch Bay');
    a.innerHTML = html;
    a.addEventListener('click', e => { e.preventDefault(); goBack(); });
    return a;
  };
  const add = () => {
    if (document.querySelector('.pb-up,.pb-back')) return;
    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
    const plate = document.querySelector('.app-nameplate');
    if (!plate) { document.body.append(link('pb-back', '<span aria-hidden="true">‹</span>Rack')); return; }
    const anchor = plate.closest('.nameplate-stack') || plate;
    anchor.before(link('pb-up', '<span aria-hidden="true">‹</span>'));
    plate.classList.add('pb-home'); plate.title = 'Back to Patch Bay';
    plate.addEventListener('click', goBack);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
